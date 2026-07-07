import fs from 'node:fs/promises';
import path from 'node:path';

import { assertFfmpegAvailable, runCommand } from './youtube-short-ffmpeg.mjs';
import { DEFAULT_SECONDS_PER_SLIDE } from './youtube-short-slides.mjs';

async function writeConcatList(slidePaths, slideDurations, listPath) {
  const lines = slidePaths.flatMap((slidePath, index) => [
    `file '${slidePath.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`,
    `duration ${slideDurations[index].toFixed(3)}`,
  ]);

  if (slidePaths.length > 0) {
    const last = slidePaths[slidePaths.length - 1].replace(/\\/g, '/').replace(/'/g, "'\\''");
    lines.push(`file '${last}'`);
  }

  await fs.writeFile(listPath, `${lines.join('\n')}\n`, 'utf8');
}

export async function buildShortVideo({
  slidePaths,
  outputPath,
  slideDurations,
  secondsPerSlide = DEFAULT_SECONDS_PER_SLIDE,
  workDir,
  audioPath = null,
}) {
  await assertFfmpegAvailable();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const durations = slideDurations?.length
    ? slideDurations
    : slidePaths.map(() => secondsPerSlide);

  const concatListPath = path.join(workDir, 'ffmpeg-concat.txt');
  await writeConcatList(slidePaths, durations, concatListPath);

  const silentVideoPath = path.join(workDir, 'video-silent.mp4');
  await runCommand('ffmpeg', [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatListPath,
    '-vf',
    'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x050505,format=yuv420p',
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    silentVideoPath,
  ]);

  if (audioPath) {
    await runCommand('ffmpeg', [
      '-y',
      '-i',
      silentVideoPath,
      '-i',
      audioPath,
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-shortest',
      outputPath,
    ]);
  } else {
    await fs.copyFile(silentVideoPath, outputPath);
  }

  const stats = await fs.stat(outputPath);
  return {
    outputPath,
    bytes: stats.size,
    durationSec: durations.reduce((sum, value) => sum + value, 0),
    hasAudio: Boolean(audioPath),
  };
}
