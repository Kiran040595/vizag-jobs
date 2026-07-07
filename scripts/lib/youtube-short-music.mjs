import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getMediaDurationSeconds, runCommand } from './youtube-short-ffmpeg.mjs';
import { resolveBackgroundMusicPath } from './youtube-short-voice.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function envFlag(name, defaultValue = true) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  return !['0', 'false', 'no'].includes(String(raw).toLowerCase());
}

export function isMusicEnabled() {
  return envFlag('AUTO_YOUTUBE_SHORT_MUSIC', true);
}

async function generateAmbientMusic(outputPath, durationSec) {
  const duration = Math.max(3, Number(durationSec) || 10).toFixed(3);
  const volume = Number(process.env.AUTO_YOUTUBE_SHORT_MUSIC_VOLUME || 0.12);

  await runCommand('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=261.63:sample_rate=44100:duration=${duration}`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=329.63:sample_rate=44100:duration=${duration}`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=392:sample_rate=44100:duration=${duration}`,
    '-filter_complex',
    `[0:a][1:a][2:a]amix=inputs=3:duration=first:dropout_transition=0,volume=${volume},afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(0, Number(duration) - 1.5).toFixed(3)}:d=1.5`,
    '-c:a',
    'libmp3lame',
    '-b:a',
    '128k',
    outputPath,
  ]);
}

async function loopMusicFile(musicPath, outputPath, durationSec) {
  const volume = Number(process.env.AUTO_YOUTUBE_SHORT_MUSIC_VOLUME || 0.14);
  await runCommand('ffmpeg', [
    '-y',
    '-stream_loop',
    '-1',
    '-i',
    musicPath,
    '-t',
    durationSec.toFixed(3),
    '-af',
    `volume=${volume},afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, durationSec - 1.5).toFixed(3)}:d=1.5`,
    '-c:a',
    'libmp3lame',
    '-b:a',
    '192k',
    outputPath,
  ]);
}

export async function buildBackgroundMusicTrack({ totalDurationSec, workDir }) {
  const outputPath = path.join(workDir, 'background-music.mp3');
  const musicPath = resolveBackgroundMusicPath();
  let source = 'generated';

  try {
    await fs.access(musicPath);
    await loopMusicFile(musicPath, outputPath, totalDurationSec);
    source = 'file';
  } catch {
    await generateAmbientMusic(outputPath, totalDurationSec);
  }

  const durationSec = await getMediaDurationSeconds(outputPath);
  return {
    audioPath: outputPath,
    durationSec,
    source,
    musicPath: source === 'file' ? musicPath : null,
  };
}
