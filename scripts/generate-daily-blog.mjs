#!/usr/bin/env node
/**
 * Generate a daily Vizag job market blog article via Gemini + optional Firecrawl context.
 *
 * Env:
 *   AUTO_DAILY_BLOG_PUBLISH=true|false     (default true)
 *   AUTO_DAILY_BLOG_MIN_JOBS=1             (skip if fewer jobs today)
 *   AUTO_DAILY_BLOG_SKIP_IF_EXISTS=true    (skip duplicate slug)
 */

import { assertPipelineConfig } from './lib/pipeline-env.mjs';
import { fetchTodaysPublishedJobs, generateDailyBlog } from './lib/pipeline-blog.mjs';

const log = (message) => {
  console.log(`[daily-blog] ${message}`);
};

function envFlag(name, defaultValue = true) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  return !['0', 'false', 'no'].includes(String(raw).toLowerCase());
}

async function main() {
  assertPipelineConfig();

  const publish = envFlag('AUTO_DAILY_BLOG_PUBLISH', true);
  const skipIfExists = envFlag('AUTO_DAILY_BLOG_SKIP_IF_EXISTS', true);
  const minJobs = Math.max(0, Number(process.env.AUTO_DAILY_BLOG_MIN_JOBS || 1));

  const { istDate, jobs } = await fetchTodaysPublishedJobs();
  log(`IST date: ${istDate} — ${jobs.length} published job(s) found today.`);

  const result = await generateDailyBlog({
    jobs,
    date: istDate,
    publish,
    skipIfExists,
    minJobs,
  });

  if (result.skipped) {
    log(`Skipped: ${result.reason}`);
    return;
  }

  log(`Created blog post: ${result.post?.title}`);
  log(`Slug: ${result.post?.slug} (${result.post?.status})`);
  log(`Angle: ${result.angle_id} | Jobs used: ${result.jobs_count} | Web context chars: ${result.web_context_chars ?? 0}`);
  if (result.editorial_notes) {
    log(`Editorial note: ${result.editorial_notes}`);
  }
}

main().catch((error) => {
  console.error('[daily-blog] Fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
