import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_MODELS = ['gemini-2.5-flash-image'];

function getGeminiApiKeys() {
  const keys = [];
  const primary =
    process.env.GEMINI_API_KEY_SHORT?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    '';
  if (primary) {
    keys.push(primary);
  }

  const extras = (process.env.GEMINI_API_KEYS || '')
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  for (const key of extras) {
    if (!keys.includes(key)) {
      keys.push(key);
    }
  }

  return keys;
}

export function assertGeminiImageConfig() {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error(
      'GEMINI_API_KEY or GEMINI_API_KEY_SHORT is required for Nano Banana image Shorts.',
    );
  }
}

function extractGeminiImage(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      return {
        mimeType: inline.mimeType || inline.mime_type || 'image/png',
        data: inline.data,
      };
    }
  }
  return null;
}

function extractInteractionImage(payload) {
  const direct = payload?.output_image || payload?.outputImage;
  if (direct?.data) {
    return {
      mimeType: direct.mime_type || direct.mimeType || 'image/png',
      data: direct.data,
    };
  }

  const outputs = payload?.outputs || payload?.output || [];
  const list = Array.isArray(outputs) ? outputs : [outputs];
  for (const item of list) {
    if (item?.type === 'image' && item?.data) {
      return {
        mimeType: item.mime_type || item.mimeType || 'image/png',
        data: item.data,
      };
    }
  }

  return null;
}

function extensionForMime(mimeType) {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    return 'jpg';
  }
  if (mimeType.includes('webp')) {
    return 'webp';
  }
  return 'png';
}

function buildIntroPrompt({ istDate, jobCount }) {
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${istDate}T12:00:00+05:30`));

  return `Create a vertical 9:16 YouTube Short intro poster for job openings in Visakhapatnam (Vizag), Andhra Pradesh, India.

Headline text (large, readable): "Today's Top Vizag Jobs"
Subheadline: "${jobCount} openings • ${formattedDate}"
Footer text: "JobsInVizag.in"

Visual style: modern Indian recruitment social media graphic, coastal Vizag city vibe, professional and energetic, bold typography, blue and cyan accents, cinematic lighting. Digital illustration / poster art. No copyrighted company logos.`;
}

function buildJobPrompt(job, jobIndex, jobCount) {
  const details = [
    job?.title ? `Job title: ${job.title}` : null,
    job?.company ? `Company: ${job.company}` : null,
    job?.salary ? `Salary: ${job.salary}` : null,
    job?.experience ? `Experience: ${job.experience}` : null,
    job?.work_mode || job?.location
      ? `Work: ${[job.work_mode, job.location].filter(Boolean).join(', ')}`
      : null,
    job?.category ? `Category: ${job.category}` : null,
    job?.is_fresher ? 'Fresher friendly role' : null,
  ].filter(Boolean);

  return `Create a vertical 9:16 YouTube Short slide for one job opening in Visakhapatnam, India.

Show these details as clear readable English text on the image:
${details.map((line) => `- ${line}`).join('\n')}

Top label: "Job ${jobIndex} of ${jobCount}"
Include a prominent "Apply Now" call-to-action button graphic.
Footer text: "JobsInVizag.in"

Visual style: premium Indian job poster for ${job?.category || 'general'} roles, modern workplace aesthetic, vibrant colors, clean layout, no real brand logos, recruitment ad design.`;
}

function buildOutroPrompt() {
  return `Create a vertical 9:16 YouTube Short outro poster.

Main text: "More Jobs on JobsInVizag.in"
Secondary text: "Link in Description"
Visual style: Visakhapatnam city skyline, modern recruitment graphic, bold CTA, blue/cyan theme, professional social media outro card. No copyrighted logos.`;
}

export function buildGeminiSlidePrompts({ istDate, selectedJobs }) {
  return [
    { kind: 'intro', filename: 'gemini-00-intro', prompt: buildIntroPrompt({ istDate, jobCount: selectedJobs.length }) },
    ...selectedJobs.map((job, index) => ({
      kind: 'job',
      filename: `gemini-${String(index + 1).padStart(2, '0')}-job`,
      prompt: buildJobPrompt(job, index + 1, selectedJobs.length),
      job,
    })),
    { kind: 'outro', filename: `gemini-${String(selectedJobs.length + 1).padStart(2, '0')}-outro`, prompt: buildOutroPrompt() },
  ];
}

async function generateWithGenerateContent({ prompt, apiKey, model, timeoutMs = 120_000 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
          imageConfig: {
            aspectRatio: '9:16',
          },
        },
      }),
      signal: controller.signal,
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = payload?.error?.message || res.statusText;
      throw new Error(`Gemini image failed (${res.status}): ${message}`);
    }

    const image = extractGeminiImage(payload);
    if (!image) {
      throw new Error(`Gemini model ${model} returned no image data.`);
    }

    return image;
  } finally {
    clearTimeout(timer);
  }
}

async function generateWithInteractions({ prompt, apiKey, model, timeoutMs = 120_000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model,
        input: [{ type: 'text', text: prompt }],
        response_format: {
          type: 'image',
          aspect_ratio: '9:16',
          image_size: process.env.AUTO_YOUTUBE_SHORT_GEMINI_IMAGE_SIZE || '1K',
        },
      }),
      signal: controller.signal,
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = payload?.error?.message || res.statusText;
      throw new Error(`Gemini interactions image failed (${res.status}): ${message}`);
    }

    const image = extractInteractionImage(payload);
    if (!image) {
      throw new Error(`Gemini interactions ${model} returned no image data.`);
    }

    return image;
  } finally {
    clearTimeout(timer);
  }
}

async function generateOneImage(prompt) {
  const keys = getGeminiApiKeys();
  const configuredModels = (process.env.AUTO_YOUTUBE_SHORT_GEMINI_MODEL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const models = configuredModels.length > 0 ? configuredModels : DEFAULT_MODELS;
  let lastError = 'Gemini image generation failed.';

  for (const apiKey of keys) {
    for (const model of models) {
      try {
        return await generateWithGenerateContent({ prompt, apiKey, model });
      } catch (generateError) {
        lastError = generateError instanceof Error ? generateError.message : String(generateError);
        try {
          return await generateWithInteractions({ prompt, apiKey, model });
        } catch (interactionError) {
          lastError =
            interactionError instanceof Error ? interactionError.message : String(interactionError);
        }
      }
    }
  }

  throw new Error(lastError);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function renderGeminiShortSlides({ jobs, istDate, outputDir }) {
  assertGeminiImageConfig();
  await fs.mkdir(outputDir, { recursive: true });

  const { pickJobsForShort } = await import('./youtube-short-slides.mjs');
  const selectedJobs = pickJobsForShort(jobs);
  const specs = buildGeminiSlidePrompts({ istDate, selectedJobs });
  const slidePaths = [];
  const gapMs = Math.max(0, Number(process.env.AUTO_YOUTUBE_SHORT_GEMINI_GAP_MS || 2500));

  for (const spec of specs) {
    const image = await generateOneImage(spec.prompt);
    const ext = extensionForMime(image.mimeType);
    const outputPath = path.join(outputDir, `${spec.filename}.${ext}`);
    await fs.writeFile(outputPath, Buffer.from(image.data, 'base64'));
    slidePaths.push(outputPath);
    if (gapMs > 0) {
      await sleep(gapMs);
    }
  }

  return {
    slidePaths,
    selectedJobs,
    renderer: 'gemini',
  };
}
