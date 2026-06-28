#!/usr/bin/env node
/**
 * Automated Naukri pipeline:
 *   1. Fetch Naukri jobs (Apify async start → wait → collect)
 *   2. For each new job: Make SEO (3-minute gap between jobs)
 *   3. Publish to Supabase when a valid apply link is available
 *
 * Auth: FETCH_JOBS_CRON_SECRET for the Edge Function; SUPABASE_SERVICE_ROLE_KEY for DB inserts.
 *
 * Env:
 *   AUTO_NAUKRI_DRY_RUN=true          — log actions without DB writes
 *   AUTO_NAUKRI_SEO_GAP_MS=180000     — gap between SEO calls (default 3 min)
 *   AUTO_NAUKRI_MAX_JOBS=30           — cap jobs processed per run
 */

import fs from 'node:fs';
import path from 'node:path';

import { assertPipelineConfig, pipelineConfig } from './lib/pipeline-env.mjs';
import { fetchNaukriJobs, seoOptimizeJob, sleepMs } from './lib/pipeline-edge.mjs';
import {
  fetchExistingJobKeys,
  getJobDedupeKey,
  publishJob,
  shouldSkipJob,
} from './lib/pipeline-publish.mjs';
import { sendAutomationSummaryEmail } from './lib/pipeline-email.mjs';

const log = (message) => {
  console.log(`[auto-naukri] ${message}`);
};

const summarize = (report) => {
  log('--- run summary ---');
  log(`Fetched: ${report.stats.fetched}`);
  log(`Queued: ${report.stats.queued}`);
  log(`Skipped (pre-SEO): ${report.stats.skippedPreSeo}`);
  log(`Skipped (batch duplicate): ${report.stats.skippedBatchDuplicate}`);
  log(`SEO ok: ${report.stats.seoOk}`);
  log(`SEO failed: ${report.stats.seoFailed}`);
  log(`Published: ${report.stats.published}`);
  log(`Skipped (post-SEO): ${report.stats.skippedPostSeo}`);
  log(`Publish failed: ${report.stats.publishFailed}`);
  if (pipelineConfig.dryRun) {
    log('DRY RUN — no jobs were written to the database.');
  }
};

const buildEntry = (job, status, extra = {}) => ({
  key: getJobDedupeKey(job),
  title: job?.title || '',
  company: job?.company || '',
  applyLink: job?.apply_link || job?.source_url || '',
  sourceUrl: job?.source_url || '',
  status,
  reason: extra.reason || '',
  publishedSlug: extra.publishedSlug || '',
  error: extra.error || '',
});

async function main() {
  assertPipelineConfig();

  const report = {
    runId: `cli-${Date.now().toString(36)}`,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    stats: {
      fetched: 0,
      queued: 0,
      skippedPreSeo: 0,
      skippedBatchDuplicate: 0,
      seoOk: 0,
      seoFailed: 0,
      published: 0,
      skippedPostSeo: 0,
      publishFailed: 0,
    },
    jobs: [],
  };

  const record = (entry) => {
    report.jobs.push(entry);
  };

  log(`Starting pipeline (SEO gap: ${Math.round(pipelineConfig.seoGapMs / 1000)}s, max jobs: ${pipelineConfig.maxJobs})`);

  const existing = await fetchExistingJobKeys();
  const { jobs: fetchedJobs } = await fetchNaukriJobs();
  report.stats.fetched = fetchedJobs.length;

  const queue = [];
  const seenKeys = new Set();

  for (const job of fetchedJobs) {
    const dedupeKey = getJobDedupeKey(job);
    if (dedupeKey && seenKeys.has(dedupeKey)) {
      report.stats.skippedBatchDuplicate += 1;
      record(buildEntry(job, 'skipped_batch_duplicate', { reason: 'duplicate in same fetch batch' }));
      log(`Skip duplicate in batch: ${job.title || dedupeKey}`);
      continue;
    }
    if (dedupeKey) seenKeys.add(dedupeKey);

    const preCheck = shouldSkipJob(job, existing);
    if (preCheck.skip) {
      report.stats.skippedPreSeo += 1;
      record(buildEntry(job, 'skipped_pre_seo', { reason: preCheck.reason }));
      log(`Skip "${job.title || 'untitled'}": ${preCheck.reason}`);
      continue;
    }

    queue.push(job);
    if (queue.length >= pipelineConfig.maxJobs) {
      break;
    }
  }

  report.stats.queued = queue.length;
  log(`${queue.length} job(s) queued for SEO + publish.`);

  for (let index = 0; index < queue.length; index += 1) {
    const job = queue[index];
    const label = `"${job.title}" at ${job.company}`;

    if (index > 0) {
      log(`Waiting ${Math.round(pipelineConfig.seoGapMs / 1000)}s before next SEO…`);
      await sleepMs(pipelineConfig.seoGapMs);
    }

    let optimized;
    try {
      log(`SEO (${index + 1}/${queue.length}): ${label}`);
      optimized = await seoOptimizeJob(job);
      report.stats.seoOk += 1;
    } catch (error) {
      report.stats.seoFailed += 1;
      const message = error instanceof Error ? error.message : String(error);
      record(buildEntry(job, 'seo_failed', { error: message, reason: 'Make SEO failed' }));
      log(`SEO failed for ${label}: ${message}`);
      continue;
    }

    const postCheck = shouldSkipJob(optimized, existing);
    if (postCheck.skip) {
      report.stats.skippedPostSeo += 1;
      record(buildEntry(optimized, 'skipped_post_seo', { reason: postCheck.reason }));
      log(`Skip publish for ${label}: ${postCheck.reason}`);
      continue;
    }

    try {
      const saved = await publishJob(optimized, 'published');
      report.stats.published += 1;

      const slug = saved?.slug || optimized.slug;
      const applyLink = saved?.apply_link || optimized.apply_link;
      if (slug) existing.slugs.add(String(slug).toLowerCase());
      if (applyLink) existing.applyLinks.add(String(applyLink).toLowerCase());

      record(buildEntry(optimized, 'published', { publishedSlug: slug, reason: 'Published to database' }));
      log(`Published: ${label} → /jobs/.../${slug}`);
    } catch (error) {
      report.stats.publishFailed += 1;
      const message = error instanceof Error ? error.message : String(error);
      record(buildEntry(optimized, 'publish_failed', { error: message, reason: 'Database insert failed' }));
      log(`Publish failed for ${label}: ${message}`);
    }
  }

  report.finishedAt = new Date().toISOString();
  summarize(report);

  const reportPath = path.join(
    process.cwd(),
    `naukri-automation-report-${report.startedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`,
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`Report saved: ${reportPath}`);

  const sendEmail = !['0', 'false', 'no'].includes(
    String(process.env.AUTO_NAUKRI_SEND_EMAIL ?? 'true').toLowerCase(),
  );
  if (sendEmail) {
    try {
      const emailResult = await sendAutomationSummaryEmail(report);
      log(`Summary emailed to ${emailResult.to} (id: ${emailResult.email_id || 'n/a'})`);
    } catch (error) {
      log(`Email summary failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (report.stats.seoFailed > 0 || report.stats.publishFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[auto-naukri] Fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
