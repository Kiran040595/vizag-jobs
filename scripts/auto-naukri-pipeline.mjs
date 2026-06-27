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

import { assertPipelineConfig, pipelineConfig } from './lib/pipeline-env.mjs';
import { fetchNaukriJobs, seoOptimizeJob, sleepMs } from './lib/pipeline-edge.mjs';
import {
  fetchExistingJobKeys,
  getJobDedupeKey,
  publishJob,
  shouldSkipJob,
} from './lib/pipeline-publish.mjs';

const log = (message) => {
  console.log(`[auto-naukri] ${message}`);
};

const summarize = (results) => {
  log('--- run summary ---');
  log(`Fetched: ${results.fetched}`);
  log(`Skipped (pre-SEO): ${results.skippedPreSeo}`);
  log(`SEO ok: ${results.seoOk}`);
  log(`SEO failed: ${results.seoFailed}`);
  log(`Published: ${results.published}`);
  log(`Skipped (post-SEO / no apply link): ${results.skippedPostSeo}`);
  log(`Publish failed: ${results.publishFailed}`);
  if (pipelineConfig.dryRun) {
    log('DRY RUN — no jobs were written to the database.');
  }
};

async function main() {
  assertPipelineConfig();

  const results = {
    fetched: 0,
    skippedPreSeo: 0,
    seoOk: 0,
    seoFailed: 0,
    published: 0,
    skippedPostSeo: 0,
    publishFailed: 0,
  };

  log(`Starting pipeline (SEO gap: ${Math.round(pipelineConfig.seoGapMs / 1000)}s, max jobs: ${pipelineConfig.maxJobs})`);

  const existing = await fetchExistingJobKeys();
  const { jobs: fetchedJobs } = await fetchNaukriJobs();
  results.fetched = fetchedJobs.length;

  const queue = [];
  const seenKeys = new Set();

  for (const job of fetchedJobs) {
    const dedupeKey = getJobDedupeKey(job);
    if (dedupeKey && seenKeys.has(dedupeKey)) {
      results.skippedPreSeo += 1;
      log(`Skip duplicate in batch: ${job.title || dedupeKey}`);
      continue;
    }
    if (dedupeKey) seenKeys.add(dedupeKey);

    const preCheck = shouldSkipJob(job, existing);
    if (preCheck.skip) {
      results.skippedPreSeo += 1;
      log(`Skip "${job.title || 'untitled'}": ${preCheck.reason}`);
      continue;
    }

    queue.push(job);
    if (queue.length >= pipelineConfig.maxJobs) {
      break;
    }
  }

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
      results.seoOk += 1;
    } catch (error) {
      results.seoFailed += 1;
      log(`SEO failed for ${label}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const postCheck = shouldSkipJob(optimized, existing);
    if (postCheck.skip) {
      results.skippedPostSeo += 1;
      log(`Skip publish for ${label}: ${postCheck.reason}`);
      continue;
    }

    try {
      const saved = await publishJob(optimized, 'published');
      results.published += 1;

      const slug = saved?.slug || optimized.slug;
      const applyLink = saved?.apply_link || optimized.apply_link;
      if (slug) existing.slugs.add(String(slug).toLowerCase());
      if (applyLink) existing.applyLinks.add(String(applyLink).toLowerCase());

      log(`Published: ${label} → /jobs/.../${slug}`);
    } catch (error) {
      results.publishFailed += 1;
      log(`Publish failed for ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  summarize(results);

  if (results.seoFailed > 0 || results.publishFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[auto-naukri] Fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
