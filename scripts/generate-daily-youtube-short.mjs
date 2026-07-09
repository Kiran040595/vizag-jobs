#!/usr/bin/env node
/**
 * Generate and upload a daily YouTube Short from today's published Vizag jobs.
 *
 * Env:
 *   YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN
 *   AUTO_YOUTUBE_SHORT_PUBLISH=true|false          (default true)
 *   AUTO_YOUTUBE_SHORT_DRY_RUN=true|false          (default false)
 *   AUTO_YOUTUBE_SHORT_SKIP_IF_EXISTS=true|false   (default true)
 *   AUTO_YOUTUBE_SHORT_MIN_JOBS=1
 *   AUTO_YOUTUBE_SHORT_MAX_JOBS=5
 *   AUTO_YOUTUBE_SHORT_PRIVACY=public|unlisted|private
 */

import { applyLocalEnv, assertYouTubeShortConfig } from './lib/pipeline-env.mjs';
import { generateAndUploadDailyYouTubeShort } from './lib/pipeline-youtube.mjs';

const log = (message) => {
  console.log(`[youtube-short] ${message}`);
};

function envFlag(name, defaultValue = true) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  return !['0', 'false', 'no'].includes(String(raw).toLowerCase());
}

async function main() {
  applyLocalEnv();
  assertYouTubeShortConfig();

  const dryRun = envFlag('AUTO_YOUTUBE_SHORT_DRY_RUN', false);
  const publish = envFlag('AUTO_YOUTUBE_SHORT_PUBLISH', true);
  const skipIfExists = envFlag('AUTO_YOUTUBE_SHORT_SKIP_IF_EXISTS', true);
  const minJobs = Math.max(0, Number(process.env.AUTO_YOUTUBE_SHORT_MIN_JOBS || 1));
  const maxJobs = Math.max(1, Number(process.env.AUTO_YOUTUBE_SHORT_MAX_JOBS || 3));

  const result = await generateAndUploadDailyYouTubeShort({
    dryRun,
    publish,
    skipIfExists,
    minJobs,
    maxJobs,
  });

  log(`IST date: ${result.istDate} — ${result.jobsCount} published job(s) found today.`);

  if (result.skipped) {
    log(`Skipped: ${result.reason}`);
    if (result.existing?.url) {
      log(`Existing Short: ${result.existing.url}`);
    }
    return;
  }

  if (result.dryRun) {
    log(`Dry run complete. Renderer: ${result.renderer || 'pollinations'}`);
    log(`Generated ${result.video.durationSec.toFixed(1)}s video (${result.video.bytes} bytes).`);
    log(`Audio: ${result.video.hasAudio ? 'yes' : 'no'}${result.audioMeta?.type ? ` (${result.audioMeta.type})` : ''}`);
    if (result.audioMeta?.music?.hasMusic) {
      log(`Background music: yes`);
    }
    log(`Title: ${result.metadata.title}`);
    log(`Selected jobs: ${result.selectedJobs.length}`);
    if (result.workDir) {
      log(`Work dir kept at: ${result.workDir}`);
    }
    return;
  }

  log(`Uploaded to ${result.channel.title}`);
  log(`Renderer: ${result.renderer || 'gemini'}`);
  log(`Short URL: ${result.upload.url}`);
  log(`Title: ${result.upload.title}`);
  log(`Jobs in video: ${result.selectedJobs.length}`);
}

main().catch((error) => {
  console.error('[youtube-short] Fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
