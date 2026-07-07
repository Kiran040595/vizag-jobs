import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

import { getMediaDurationSeconds, runCommand } from './youtube-short-ffmpeg.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const DEFAULT_VOICE = 'en-IN-NeerjaNeural';

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

export function isVoiceOverEnabled(renderer = resolveRenderer()) {
  if (renderer === 'gemini' || renderer === 'pollinations') {
    return envFlag('AUTO_YOUTUBE_SHORT_VOICE', false);
  }
  return envFlag('AUTO_YOUTUBE_SHORT_VOICE', true);
}

function cleanSpeech(value, fallback = '') {
  const text = String(value || fallback).replace(/\s+/g, ' ').trim();
  return text.replace(/jobsinvizag\.in/gi, 'jobs in vizag dot in');
}

function shortJobLine(job) {
  return [job.salary, job.experience].filter(Boolean).join(', ');
}

export function buildSlideVoiceScripts({ istDate, selectedJobs }) {
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${istDate}T12:00:00+05:30`));

  const intro = cleanSpeech(
    `${selectedJobs.length} top Vizag jobs for ${formattedDate}.`,
  );

  const jobs = selectedJobs.map((job, index) => {
    const details = shortJobLine(job);
    return cleanSpeech(
      `${index + 1}. ${job.title}${job.company ? ` at ${job.company}` : ''}${details ? `. ${details}` : ''}. Apply on jobs in vizag dot in.`,
    );
  });

  const outro = cleanSpeech('More listings at jobs in vizag dot in.');

  return [intro, ...jobs, outro];
}

async function synthesizeToFile(text, outputPath, voice = process.env.AUTO_YOUTUBE_SHORT_VOICE_NAME || DEFAULT_VOICE) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = await tts.toStream(text);
  await new Promise((resolve, reject) => {
    const chunks = [];
    audioStream.on('data', (chunk) => chunks.push(chunk));
    audioStream.on('end', async () => {
      try {
        await fs.writeFile(outputPath, Buffer.concat(chunks));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    audioStream.on('error', reject);
  });
}

export async function synthesizeSlideVoiceovers({ scripts, outputDir }) {
  const voicePaths = [];
  for (let index = 0; index < scripts.length; index += 1) {
    const outputPath = path.join(outputDir, `voice-${String(index).padStart(2, '0')}.mp3`);
    await synthesizeToFile(scripts[index], outputPath);
    voicePaths.push(outputPath);
  }
  return voicePaths;
}

export function resolveSlideDurations(voiceDurations, minSlideSec = 2.5, paddingSec = 0.45) {
  return voiceDurations.map((duration) =>
    Math.max(minSlideSec, Number(duration || 0) + paddingSec),
  );
}

export async function buildVoiceOnlyTrack({ voicePaths, slideDurations, outputPath, workDir }) {
  const paddedPaths = [];

  for (let index = 0; index < voicePaths.length; index += 1) {
    const paddedPath = path.join(workDir, `voice-padded-${String(index).padStart(2, '0')}.mp3`);
    await runCommand('ffmpeg', [
      '-y',
      '-i',
      voicePaths[index],
      '-af',
      `apad=pad_dur=${slideDurations[index].toFixed(3)}`,
      '-t',
      slideDurations[index].toFixed(3),
      paddedPath,
    ]);
    paddedPaths.push(paddedPath);
  }

  const concatListPath = path.join(workDir, 'voice-concat.txt');
  const lines = paddedPaths.flatMap((filePath) => [
    `file '${filePath.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`,
  ]);
  await fs.writeFile(concatListPath, `${lines.join('\n')}\n`, 'utf8');

  await runCommand('ffmpeg', [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatListPath,
    '-c',
    'copy',
    outputPath,
  ]);
}

export function resolveBackgroundMusicPath() {
  const custom = process.env.AUTO_YOUTUBE_SHORT_MUSIC_PATH?.trim();
  if (custom) {
    return path.isAbsolute(custom) ? custom : path.join(projectRoot, custom);
  }
  return path.join(projectRoot, 'branding', 'shorts-music.mp3');
}

export async function buildMixedAudioTrack({
  voiceTrackPath,
  outputPath,
  workDir,
  totalDurationSec,
  musicVolume = Number(process.env.AUTO_YOUTUBE_SHORT_MUSIC_VOLUME || 0.14),
}) {
  const musicPath = resolveBackgroundMusicPath();
  let hasMusic = false;
  try {
    await fs.access(musicPath);
    hasMusic = true;
  } catch {
    hasMusic = false;
  }

  if (!hasMusic) {
    await fs.copyFile(voiceTrackPath, outputPath);
    return { hasMusic: false, musicPath: null };
  }

  const loopedMusicPath = path.join(workDir, 'music-looped.mp3');
  await runCommand('ffmpeg', [
    '-y',
    '-stream_loop',
    '-1',
    '-i',
    musicPath,
    '-t',
    totalDurationSec.toFixed(3),
    '-af',
    `volume=${musicVolume}`,
    loopedMusicPath,
  ]);

  await runCommand('ffmpeg', [
    '-y',
    '-i',
    voiceTrackPath,
    '-i',
    loopedMusicPath,
    '-filter_complex',
    '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2',
    '-c:a',
    'libmp3lame',
    outputPath,
  ]);

  return { hasMusic: true, musicPath };
}

export async function buildVoiceAudioPlan({ scripts, outputDir, workDir, minSlideSec = 2.5 }) {
  const voicePaths = await synthesizeSlideVoiceovers({ scripts, outputDir: path.join(outputDir, 'voice') });
  const voiceDurations = [];
  for (const voicePath of voicePaths) {
    voiceDurations.push(await getMediaDurationSeconds(voicePath));
  }
  const slideDurations = resolveSlideDurations(voiceDurations, minSlideSec);
  const voiceTrackPath = path.join(workDir, 'voice-track.mp3');
  await buildVoiceOnlyTrack({ voicePaths, slideDurations, outputPath: voiceTrackPath, workDir });
  const totalDurationSec = slideDurations.reduce((sum, value) => sum + value, 0);
  const mixedAudioPath = path.join(workDir, 'mixed-audio.mp3');
  const music = await buildMixedAudioTrack({
    voiceTrackPath,
    outputPath: mixedAudioPath,
    workDir,
    totalDurationSec,
  });

  return {
    voicePaths,
    voiceDurations,
    slideDurations,
    totalDurationSec,
    audioPath: mixedAudioPath,
    music,
  };
}
