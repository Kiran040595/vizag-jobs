const DEFAULT_MODEL = 'gemini-2.5-flash';
const SITE_URL = 'https://jobsinvizag.in';

const SEO_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['title', 'description', 'tags'],
};

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

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

function cleanFilenameHint(filename = '') {
  return String(filename)
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampTitle(title) {
  let next = String(title || '').replace(/\s+/g, ' ').trim();
  if (!next) {
    next = 'Vizag Jobs Short';
  }
  if (!/#shorts\b/i.test(next)) {
    const suffix = ' #Shorts';
    const maxBase = 100 - suffix.length;
    next = `${next.slice(0, maxBase).trim()}${suffix}`;
  }
  if (next.length > 100) {
    next = next.slice(0, 100).trim();
    if (!/#shorts\b/i.test(next)) {
      next = `${next.slice(0, 92).trim()} #Shorts`;
    }
  }
  return next;
}

function normalizeTags(tags) {
  const list = Array.isArray(tags) ? tags : [];
  const cleaned = [];
  for (const tag of list) {
    const value = String(tag || '')
      .replace(/^#/, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!value) continue;
    if (cleaned.some((item) => item.toLowerCase() === value.toLowerCase())) continue;
    cleaned.push(value.slice(0, 30));
    if (cleaned.length >= 15) break;
  }

  const defaults = [
    'VizagJobs',
    'VisakhapatnamJobs',
    'JobsInVizag',
    'AndhraPradeshJobs',
    'Shorts',
    'YouTubeShorts',
  ];
  for (const tag of defaults) {
    if (cleaned.length >= 15) break;
    if (!cleaned.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      cleaned.push(tag);
    }
  }

  return cleaned.slice(0, 15);
}

export function buildFallbackShortSeo({ fileName, driveFileId, siteUrl = SITE_URL }) {
  const hint = cleanFilenameHint(fileName) || 'Vizag Jobs Today';
  const title = clampTitle(`${hint} | Jobs in Vizag`);
  const description = [
    `${hint}.`,
    '',
    'Latest job openings and career updates for Visakhapatnam.',
    `Browse jobs: ${siteUrl}/jobs`,
    '',
    '#VizagJobs #VisakhapatnamJobs #JobsInVizag #AndhraPradeshJobs #Shorts',
    `drive-file:${driveFileId}`,
  ].join('\n');

  return {
    title,
    description,
    tags: normalizeTags(['Vizag Jobs', 'Visakhapatnam', 'Jobs', 'Shorts', hint]),
    source: 'fallback',
  };
}

function finalizeSeo({ title, description, tags }, { driveFileId, siteUrl = SITE_URL }) {
  const finalTitle = clampTitle(title);
  let finalDescription = String(description || '').trim();
  if (!finalDescription) {
    finalDescription = 'Latest Vizag job updates. Watch till the end and apply today.';
  }
  if (!finalDescription.includes(siteUrl)) {
    finalDescription = `${finalDescription}\n\nBrowse jobs: ${siteUrl}/jobs`;
  }
  if (!/#shorts\b/i.test(finalDescription)) {
    finalDescription = `${finalDescription}\n\n#VizagJobs #VisakhapatnamJobs #JobsInVizag #Shorts`;
  }
  const marker = `drive-file:${driveFileId}`;
  if (!finalDescription.includes(marker)) {
    finalDescription = `${finalDescription}\n${marker}`;
  }
  if (finalDescription.length > 4900) {
    finalDescription = `${finalDescription.slice(0, 4850).trim()}\n${marker}`;
  }

  return {
    title: finalTitle,
    description: finalDescription,
    tags: normalizeTags(tags),
  };
}

function buildSeoPrompt({ fileName, siteUrl }) {
  const hint = cleanFilenameHint(fileName);
  return [
    'You write SEO metadata for YouTube Shorts about jobs in Visakhapatnam (Vizag), India.',
    'Return JSON only matching the schema.',
    '',
    'Rules:',
    '- title: max 90 characters before adding #Shorts; must be catchy and searchable',
    '- title must end with #Shorts (or include it)',
    '- description: 2-4 short paragraphs, include CTA to apply, relevant hashtags',
    '- tags: 8 to 15 SEO tags without # symbols',
    '- Focus on Vizag / Visakhapatnam jobs when relevant; do not invent fake company names',
    `- Mention site ${siteUrl} once in the description`,
    '',
    `Source filename: ${fileName}`,
    `Topic hint from filename: ${hint || '(none)'}`,
  ].join('\n');
}

async function callGeminiSeo({ fileName, siteUrl }) {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY is required for Drive Shorts SEO metadata.');
  }

  const model = process.env.AUTO_DRIVE_YT_GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const prompt = buildSeoPrompt({ fileName, siteUrl });
  let lastError = 'Gemini SEO request failed.';

  for (const apiKey of keys) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
            responseSchema: SEO_RESPONSE_SCHEMA,
          },
        }),
        signal: controller.signal,
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = payload?.error?.message || `Gemini failed (${res.status})`;
        continue;
      }

      const text = extractGeminiText(payload);
      const parsed = JSON.parse(text);
      return {
        title: parsed.title,
        description: parsed.description,
        tags: parsed.tags,
        source: 'gemini',
        model,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastError);
}

/**
 * Generate SEO title / description / tags for a Drive video Short.
 * Falls back to filename-based metadata if Gemini fails.
 */
export async function generateDriveShortSeo({
  fileName,
  driveFileId,
  siteUrl = process.env.SITE_URL || SITE_URL,
}) {
  try {
    const raw = await callGeminiSeo({ fileName, siteUrl });
    return {
      ...finalizeSeo(raw, { driveFileId, siteUrl }),
      source: raw.source,
      model: raw.model,
    };
  } catch (error) {
    const fallback = buildFallbackShortSeo({ fileName, driveFileId, siteUrl });
    return {
      ...fallback,
      geminiError: error instanceof Error ? error.message : String(error),
    };
  }
}
