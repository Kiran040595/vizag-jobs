#!/usr/bin/env node
/**
 * Automated external fetch pipeline for naukri | linkedin_jobs | linkedin_posts
 *
 * Env:
 *   AUTO_FETCH_CHANNEL=linkedin_jobs     (default: naukri)
 *   AUTO_LINKEDIN_POST_PRESET=general    (linkedin_posts only)
 *   AUTO_LINKEDIN_CUSTOM_SEARCH_URL=... (when preset=custom)
 */

import fs from 'node:fs';
import path from 'node:path';

import { assertPipelineConfig, pipelineConfig } from './lib/pipeline-env.mjs';
import { fetchJobsForChannel, seoOptimizeJob, sleepMs } from './lib/pipeline-edge.mjs';
import {
  fetchExistingJobKeys,
  getJobDedupeKey,
  publishJob,
  shouldSkipJob,
} from './lib/pipeline-publish.mjs';
import { sendAutomationSummaryEmail } from './lib/pipeline-email.mjs';
import { recoverPublishableFieldsFromOriginal } from '../src/lib/jobPublishQuality.js';

const CHANNEL = (process.env.AUTO_FETCH_CHANNEL || process.argv[2] || 'naukri').trim();
const CHANNEL_LABELS = {
  naukri: 'Naukri',
  linkedin_jobs: 'LinkedIn Jobs',
  linkedin_posts: 'LinkedIn Posts',
};

const log = (message) => {
  console.log(`[auto-${CHANNEL}] ${message}`);
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

  if (!CHANNEL_LABELS[CHANNEL]) {
    throw new Error(`Invalid AUTO_FETCH_CHANNEL: ${CHANNEL}. Use naukri, linkedin_jobs, or linkedin_posts.`);
  }

  const fetchOptions =
    CHANNEL === 'linkedin_posts'
      ? {
          preset: process.env.AUTO_LINKEDIN_POST_PRESET || 'general',
          customSearchUrl: process.env.AUTO_LINKEDIN_CUSTOM_SEARCH_URL || '',
        }
      : {};

  const report = {
    channel: CHANNEL,
    channelLabel: CHANNEL_LABELS[CHANNEL],
    runId: `cli-${CHANNEL}-${Date.now().toString(36)}`,
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

  log(`Starting ${CHANNEL_LABELS[CHANNEL]} pipeline`);

  const existing = await fetchExistingJobKeys();
  const { jobs: fetchedJobs, apifyRunId } = await fetchJobsForChannel(CHANNEL, fetchOptions);
  report.stats.fetched = fetchedJobs.length;
  if (apifyRunId) report.apifyRunId = apifyRunId;
  if (fetchOptions.preset) report.linkedinPostPreset = fetchOptions.preset;

  const queue = [];
  const seenKeys = new Set();

  for (const job of fetchedJobs) {
    const dedupeKey = getJobDedupeKey(job);
    if (dedupeKey && seenKeys.has(dedupeKey)) {
      report.stats.skippedBatchDuplicate += 1;
      record(buildEntry(job, 'skipped_batch_duplicate', { reason: 'duplicate in same fetch batch' }));
      continue;
    }
    if (dedupeKey) seenKeys.add(dedupeKey);

    const preCheck = shouldSkipJob(job, existing);
    if (preCheck.skip) {
      report.stats.skippedPreSeo += 1;
      record(buildEntry(job, 'skipped_pre_seo', { reason: preCheck.reason }));
      log(`Skip before SEO: "${job.title}" — ${preCheck.reason}`);
      continue;
    }

    queue.push(job);
    if (queue.length >= pipelineConfig.maxJobs) break;
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
      optimized = recoverPublishableFieldsFromOriginal(job, await seoOptimizeJob(job));
      report.stats.seoOk += 1;
    } catch (error) {
      report.stats.seoFailed += 1;
      const message = error instanceof Error ? error.message : String(error);
      record(buildEntry(job, 'seo_failed', { error: message, reason: 'Make SEO failed' }));
      log(`SEO failed: ${message}`);
      continue;
    }

    const postCheck = shouldSkipJob(optimized, existing);
    if (postCheck.skip) {
      report.stats.skippedPostSeo += 1;
      record(buildEntry(optimized, 'skipped_post_seo', { reason: postCheck.reason }));
      log(`Skip after SEO: "${optimized.title || job.title}" — ${postCheck.reason}`);
      continue;
    }

    try {
      const saved = await publishJob(optimized, 'published');
      report.stats.published += 1;
      const slug = saved?.slug || optimized.slug;
      if (slug) existing.slugs.add(String(slug).toLowerCase());
      const applyLink = saved?.apply_link || optimized.apply_link;
      if (applyLink) existing.applyLinks.add(String(applyLink).toLowerCase());
      record(buildEntry(optimized, 'published', { publishedSlug: slug, reason: 'Published to database' }));
      log(`Published: ${label}`);
    } catch (error) {
      report.stats.publishFailed += 1;
      const message = error instanceof Error ? error.message : String(error);
      record(buildEntry(optimized, 'publish_failed', { error: message, reason: 'Database insert failed' }));
      log(`Publish failed: ${message}`);
    }
  }

  report.finishedAt = new Date().toISOString();

  const reportPath = path.join(
    process.cwd(),
    `${CHANNEL}-automation-report-${report.startedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`,
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`Report saved: ${reportPath}`);

  const sendEmail = !['0', 'false', 'no'].includes(
    String(process.env.AUTO_NAUKRI_SEND_EMAIL ?? process.env.AUTO_SEND_EMAIL ?? 'true').toLowerCase(),
  );
  if (sendEmail) {
    try {
      const emailResult = await sendAutomationSummaryEmail(report);
      log(`Summary emailed to ${emailResult.to}`);
    } catch (error) {
      log(`Email summary failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  log(`Done — published ${report.stats.published} / fetched ${report.stats.fetched}`);

  if (report.stats.seoFailed > 0 || report.stats.publishFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[auto-${CHANNEL}] Fatal:`, error instanceof Error ? error.message : error);
  process.exit(1);
});
