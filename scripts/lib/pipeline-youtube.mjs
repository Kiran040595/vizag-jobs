import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { fetchTodaysPublishedJobs } from './pipeline-blog.mjs';
import { renderGeminiShortSlides } from './youtube-gemini-images.mjs';
import { renderPollinationsShortSlides } from './youtube-pollinations-images.mjs';
import { buildShortVideo } from './youtube-short-video.mjs';
import { buildShortMetadata, DEFAULT_MAX_JOBS, DEFAULT_SECONDS_PER_SLIDE, renderShortSlides } from './youtube-short-slides.mjs';
import {
  buildSlideVoiceScripts,
  buildVoiceAudioPlan,
  isVoiceOverEnabled,
} from './youtube-short-voice.mjs';
import { buildBackgroundMusicTrack, isMusicEnabled } from './youtube-short-music.mjs';
import {
  assertYouTubeUploadConfig,
  findRecentShortByMarker,
  getAuthenticatedChannel,
  getYouTubeAccessToken,
  uploadYouTubeShort,
} from './youtube-upload.mjs';

function envFlag(name, defaultValue = true) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  return !['0', 'false', 'no'].includes(String(raw).toLowerCase());
}

function resolveRenderer() {
  return String(process.env.AUTO_YOUTUBE_SHORT_RENDERER || 'pollinations').toLowerCase();
}

async function renderSlidesForRenderer(renderer, { selectedJobs, istDate, slideOutputDir }) {
  if (renderer === 'slides') {
    return renderShortSlides({ jobs: selectedJobs, istDate, outputDir: slideOutputDir });
  }
  if (renderer === 'gemini') {
    return renderGeminiShortSlides({ jobs: selectedJobs, istDate, outputDir: slideOutputDir });
  }
  if (renderer === 'pollinations') {
    return renderPollinationsShortSlides({ jobs: selectedJobs, istDate, outputDir: slideOutputDir });
  }
  throw new Error(`Unsupported AUTO_YOUTUBE_SHORT_RENDERER: ${renderer}. Use pollinations, slides, or gemini.`);
}

export async function generateAndUploadDailyYouTubeShort({
  dryRun = false,
  publish = true,
  skipIfExists = true,
  minJobs = 1,
  maxJobs = Number(process.env.AUTO_YOUTUBE_SHORT_MAX_JOBS || DEFAULT_MAX_JOBS),
  secondsPerSlide = Number(process.env.AUTO_YOUTUBE_SHORT_SECONDS_PER_SLIDE || DEFAULT_SECONDS_PER_SLIDE),
  siteUrl = process.env.SITE_URL || 'https://jobsinvizag.in',
  privacyStatus = process.env.AUTO_YOUTUBE_SHORT_PRIVACY || 'public',
  renderer = resolveRenderer(),
  withVoice = isVoiceOverEnabled(renderer),
} = {}) {
  const { istDate, jobs } = await fetchTodaysPublishedJobs();

  if (jobs.length < minJobs) {
    return {
      skipped: true,
      reason: `Only ${jobs.length} published job(s) today; minimum is ${minJobs}.`,
      istDate,
      jobsCount: jobs.length,
    };
  }

  const metadata = buildShortMetadata({ istDate, jobs, siteUrl });
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vizag-youtube-short-'));

  try {
    if (!dryRun) {
      assertYouTubeUploadConfig();
      const accessToken = await getYouTubeAccessToken();
      const channel = await getAuthenticatedChannel(accessToken);

      if (skipIfExists) {
        const existing = await findRecentShortByMarker(
          accessToken,
          channel.uploadsPlaylistId,
          istDate,
        );
        if (existing?.videoId) {
          return {
            skipped: true,
            reason: `Short already uploaded for ${istDate}.`,
            istDate,
            jobsCount: jobs.length,
            existing,
            channel,
          };
        }
      }
    }

    const selectedJobs = metadata.selectedJobs.slice(0, maxJobs);
    const slideOutputDir = path.join(workDir, 'slides');
    const slideResult = await renderSlidesForRenderer(renderer, {
      selectedJobs,
      istDate,
      slideOutputDir,
    });
    const { slidePaths } = slideResult;

    let slideDurations = slidePaths.map(() => secondsPerSlide);
    let audioPath = null;
    let audioMeta = null;

    if (withVoice) {
      const scripts = buildSlideVoiceScripts({ istDate, selectedJobs });
      audioMeta = await buildVoiceAudioPlan({
        scripts,
        outputDir: workDir,
        workDir,
        minSlideSec: secondsPerSlide,
      });
      slideDurations = audioMeta.slideDurations;
      audioPath = audioMeta.audioPath;
    } else if (isMusicEnabled()) {
      const totalDurationSec = slideDurations.reduce((sum, value) => sum + value, 0);
      const music = await buildBackgroundMusicTrack({ totalDurationSec, workDir });
      audioPath = music.audioPath;
      audioMeta = { music, hasAudio: true, type: 'music' };
    }

    const videoPath = path.join(workDir, 'vizag-jobs-short.mp4');
    const video = await buildShortVideo({
      slidePaths,
      outputPath: videoPath,
      slideDurations,
      secondsPerSlide,
      workDir,
      audioPath,
    });

    if (dryRun) {
      return {
        skipped: false,
        dryRun: true,
        istDate,
        jobsCount: jobs.length,
        selectedJobs,
        metadata,
        video,
        audioMeta,
        renderer: slideResult.renderer || renderer,
        workDir,
      };
    }

    const accessToken = await getYouTubeAccessToken();
    const channel = await getAuthenticatedChannel(accessToken);
    const upload = await uploadYouTubeShort({
      accessToken,
      videoPath,
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      privacyStatus: publish ? privacyStatus : 'private',
    });

    return {
      skipped: false,
      dryRun: false,
      istDate,
      jobsCount: jobs.length,
      selectedJobs,
      metadata,
      video,
      audioMeta,
      renderer: slideResult.renderer || renderer,
      channel,
      upload,
    };
  } finally {
    if (!envFlag('AUTO_YOUTUBE_SHORT_KEEP_WORKDIR', false)) {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }
}
