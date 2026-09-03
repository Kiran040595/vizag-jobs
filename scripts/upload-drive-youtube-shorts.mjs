#!/usr/bin/env node
/**
 * Watch a Google Drive folder and upload new videos as YouTube Shorts.
 * Title / description / tags are SEO-optimized via Gemini.
 *
 * Env:
 *   GOOGLE_DRIVE_WATCH_FOLDER_ID   (required)
 *   YOUTUBE_CLIENT_ID / SECRET / REFRESH_TOKEN
 *   GEMINI_API_KEY
 *   AUTO_DRIVE_YT_DRY_RUN=true|false
 *   AUTO_DRIVE_YT_MAX_FILES=3
 *   AUTO_DRIVE_YT_PRIVACY=public|unlisted|private
 */

import { applyLocalEnv, assertDriveYouTubeConfig } from './lib/pipeline-env.mjs';
import { uploadDriveVideosAsYouTubeShorts } from './lib/pipeline-drive-youtube.mjs';

const log = (message) => {
  console.log(`[drive-youtube-short] ${message}`);
};

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  return !['0', 'false', 'no'].includes(String(raw).toLowerCase());
}

async function main() {
  applyLocalEnv();
  assertDriveYouTubeConfig();

  const dryRun = envFlag('AUTO_DRIVE_YT_DRY_RUN', false);
  const maxFiles = Math.max(1, Number(process.env.AUTO_DRIVE_YT_MAX_FILES || 3));
  const privacyStatus = process.env.AUTO_DRIVE_YT_PRIVACY || 'public';

  log(`Watch folder: ${process.env.GOOGLE_DRIVE_WATCH_FOLDER_ID}`);
  log(`Mode: ${dryRun ? 'dry-run' : 'upload'} · max ${maxFiles} · privacy ${privacyStatus}`);

  const result = await uploadDriveVideosAsYouTubeShorts({
    dryRun,
    maxFiles,
    privacyStatus,
  });

  log(`Channel: ${result.channel.title}`);
  log(`Videos in inbox: ${result.found}`);

  if (result.skippedEmpty || result.found === 0) {
    log('No new videos to process.');
    return;
  }

  for (const item of result.processed) {
    if (item.skipped) {
      log(`Skip ${item.fileName}: ${item.reason}`);
      if (item.existing?.url) {
        log(`  Existing: ${item.existing.url}`);
      }
      continue;
    }

    if (item.dryRun) {
      log(`Dry run ${item.fileName} (${item.bytes} bytes)`);
      log(`  Title: ${item.seo.title}`);
      log(`  SEO source: ${item.seo.source}${item.seo.geminiError ? ` (fallback: ${item.seo.geminiError})` : ''}`);
      log(`  Tags: ${item.seo.tags.join(', ')}`);
      continue;
    }

    log(`Uploaded ${item.fileName}`);
    log(`  Short URL: ${item.upload.url}`);
    log(`  Title: ${item.upload.title}`);
    log(`  SEO source: ${item.seo.source}`);
    if (item.movedToUploaded) {
      log('  Moved to Drive Uploaded/ folder');
    }
  }
}

main().catch((error) => {
  console.error('[drive-youtube-short] Fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
