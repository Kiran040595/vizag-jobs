import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import {
  buildPollinationsBackgroundPrompt,
  buildContentOverlaySvg,
  LOGO_PATH,
  SHORT_HEIGHT,
  SHORT_WIDTH,
} from './youtube-short-overlay.mjs';
import { pickJobsForShort } from './youtube-short-slides.mjs';

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPollinationsUrl(prompt, seed) {
  const params = new URLSearchParams({
    width: String(SHORT_WIDTH),
    height: String(SHORT_HEIGHT),
    model: process.env.AUTO_YOUTUBE_SHORT_POLLINATIONS_MODEL || 'flux',
    seed: String(seed),
    nologo: process.env.AUTO_YOUTUBE_SHORT_POLLINATIONS_NOLOGO || 'true',
    enhance: 'false',
  });

  return `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}?${params.toString()}`;
}

async function fetchBackgroundImage(prompt, seed, timeoutMs = 120_000) {
  const url = buildPollinationsUrl(prompt, seed);
  const maxAttempts = Math.max(1, Number(process.env.AUTO_YOUTUBE_SHORT_POLLINATIONS_RETRIES || 3));
  let lastError = 'Pollinations request failed.';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Pollinations failed (${res.status})`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.byteLength < 1000) {
        throw new Error('Pollinations returned an empty image.');
      }
      return sharp(buffer).resize(SHORT_WIDTH, SHORT_HEIGHT, { fit: 'cover' }).png().toBuffer();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < maxAttempts) {
        await sleep(Math.min(8000, 2000 * attempt));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastError);
}

async function buildFallbackBackground() {
  const { buildFullSlideSvg } = await import('./youtube-short-overlay.mjs');
  const svg = buildFullSlideSvg({ kind: 'intro', istDate: '2026-01-01', jobCount: 1 });
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function compositeSlide({ backgroundBuffer, overlaySvg }) {
  const overlayBuffer = await sharp(Buffer.from(overlaySvg)).png().toBuffer();
  const layers = [
    { input: backgroundBuffer, top: 0, left: 0 },
    { input: overlayBuffer, top: 0, left: 0 },
  ];

  try {
    await fs.access(LOGO_PATH);
    const logo = await sharp(LOGO_PATH)
      .resize(108, 108, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    layers.push({ input: logo, top: 56, left: Math.floor((SHORT_WIDTH - 108) / 2) });
  } catch {
    // logo optional
  }

  return sharp({
    create: {
      width: SHORT_WIDTH,
      height: SHORT_HEIGHT,
      channels: 4,
      background: { r: 3, g: 7, b: 18, alpha: 1 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();
}

export async function renderPollinationsShortSlides({ jobs, istDate, outputDir }) {
  await fs.mkdir(outputDir, { recursive: true });

  const selectedJobs = pickJobsForShort(jobs);
  const slideSpecs = [
    { kind: 'intro', filename: 'pollen-00-intro.png' },
    ...selectedJobs.map((job, index) => ({
      kind: 'job',
      job,
      jobIndex: index + 1,
      jobCount: selectedJobs.length,
      filename: `pollen-${String(index + 1).padStart(2, '0')}-job.png`,
    })),
    { kind: 'outro', filename: `pollen-${String(selectedJobs.length + 1).padStart(2, '0')}-outro.png` },
  ];

  const gapMs = Math.max(0, Number(process.env.AUTO_YOUTUBE_SHORT_POLLINATIONS_GAP_MS || 16_000));
  const baseSeed = Number(process.env.AUTO_YOUTUBE_SHORT_POLLINATIONS_SEED || istDate.replace(/-/g, ''));
  const slidePaths = [];

  for (let index = 0; index < slideSpecs.length; index += 1) {
    const spec = slideSpecs[index];
    const prompt = buildPollinationsBackgroundPrompt({
      kind: spec.kind,
      job: spec.job,
      istDate,
      jobCount: selectedJobs.length,
    });

    let backgroundBuffer;
    try {
      backgroundBuffer = await fetchBackgroundImage(prompt, baseSeed + index);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[pollinations] Background fallback for ${spec.filename}: ${message}`);
      backgroundBuffer = await buildFallbackBackground();
    }

    const overlaySvg = buildContentOverlaySvg({
      kind: spec.kind,
      istDate,
      job: spec.job,
      jobIndex: spec.jobIndex,
      jobCount: spec.jobCount || selectedJobs.length,
      allJobs: selectedJobs,
      withBackground: false,
    });

    const pngBuffer = await compositeSlide({ backgroundBuffer, overlaySvg });
    const outputPath = path.join(outputDir, spec.filename);
    await fs.writeFile(outputPath, pngBuffer);
    slidePaths.push(outputPath);

    if (gapMs > 0 && index < slideSpecs.length - 1) {
      await sleep(gapMs);
    }
  }

  return {
    slidePaths,
    selectedJobs,
    renderer: 'pollinations',
  };
}
