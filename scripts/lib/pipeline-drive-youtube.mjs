import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  downloadDriveFile,
  ensureUploadedFolder,
  listWatchFolderVideos,
  moveDriveFile,
} from './google-drive.mjs';
import { generateDriveShortSeo } from './youtube-short-seo.mjs';
import {
  assertDriveOAuthConfig,
  assertYouTubeUploadConfig,
  findRecentShortByDriveFileId,
  getAuthenticatedChannel,
  getDriveAccessToken,
  getYouTubeAccessToken,
  uploadYouTubeShort,
} from './youtube-upload.mjs';

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  return !['0', 'false', 'no'].includes(String(raw).toLowerCase());
}

function safeLocalName(fileName) {
  const base = path.basename(fileName || 'video.mp4').replace(/[^\w.\- ()]+/g, '_');
  return base || 'video.mp4';
}

async function processOneDriveVideo({
  youtubeAccessToken,
  driveAccessToken,
  channel,
  file,
  watchFolderId,
  uploadedFolderId,
  dryRun,
  privacyStatus,
  siteUrl,
}) {
  const existing = await findRecentShortByDriveFileId(
    youtubeAccessToken,
    channel.uploadsPlaylistId,
    file.id,
  );
  if (existing?.videoId) {
    return {
      fileId: file.id,
      fileName: file.name,
      skipped: true,
      reason: 'Already uploaded (drive-file marker found on channel).',
      existing,
    };
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vizag-drive-yt-'));
  const localPath = path.join(workDir, safeLocalName(file.name));

  try {
    const downloaded = await downloadDriveFile(driveAccessToken, file.id, localPath);
    const seo = await generateDriveShortSeo({
      fileName: file.name,
      driveFileId: file.id,
      siteUrl,
    });

    if (dryRun) {
      return {
        fileId: file.id,
        fileName: file.name,
        dryRun: true,
        bytes: downloaded.bytes,
        seo,
        localPath,
      };
    }

    const upload = await uploadYouTubeShort({
      accessToken: youtubeAccessToken,
      videoPath: localPath,
      title: seo.title,
      description: seo.description,
      tags: seo.tags,
      privacyStatus,
    });

    await moveDriveFile(driveAccessToken, file.id, uploadedFolderId, watchFolderId);

    return {
      fileId: file.id,
      fileName: file.name,
      upload,
      seo,
      movedToUploaded: true,
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function uploadDriveVideosAsYouTubeShorts({
  dryRun = envFlag('AUTO_DRIVE_YT_DRY_RUN', false),
  maxFiles = Math.max(1, Number(process.env.AUTO_DRIVE_YT_MAX_FILES || 3)),
  privacyStatus = process.env.AUTO_DRIVE_YT_PRIVACY || 'public',
  watchFolderId = process.env.GOOGLE_DRIVE_WATCH_FOLDER_ID || '',
  siteUrl = process.env.SITE_URL || 'https://jobsinvizag.in',
} = {}) {
  assertYouTubeUploadConfig();
  assertDriveOAuthConfig();

  if (!watchFolderId) {
    throw new Error('GOOGLE_DRIVE_WATCH_FOLDER_ID is required.');
  }

  const youtubeAccessToken = await getYouTubeAccessToken();
  const driveAccessToken = await getDriveAccessToken();
  const channel = await getAuthenticatedChannel(youtubeAccessToken);
  const videos = await listWatchFolderVideos(driveAccessToken, watchFolderId);

  if (videos.length === 0) {
    return {
      channel,
      dryRun,
      found: 0,
      processed: [],
      skippedEmpty: true,
    };
  }

  const queue = videos.slice(0, maxFiles);
  const uploadedFolderId = dryRun
    ? null
    : await ensureUploadedFolder(driveAccessToken, watchFolderId);

  const processed = [];
  for (const file of queue) {
    try {
      const result = await processOneDriveVideo({
        youtubeAccessToken,
        driveAccessToken,
        channel,
        file,
        watchFolderId,
        uploadedFolderId,
        dryRun,
        privacyStatus,
        siteUrl,
      });
      processed.push(result);
    } catch (error) {
      processed.push({
        fileId: file.id,
        fileName: file.name,
        failed: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const failedCount = processed.filter((item) => item.failed).length;
  if (failedCount > 0 && failedCount === processed.length) {
    throw new Error(
      `All ${failedCount} Drive video(s) failed. Last error: ${processed[processed.length - 1]?.error}`,
    );
  }

  return {
    channel,
    dryRun,
    found: videos.length,
    queued: queue.length,
    processed,
    failedCount,
  };
}
