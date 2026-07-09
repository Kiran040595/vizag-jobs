/**
 * LinkedIn content-search presets for fetch_channel linkedin_posts.
 * Admin picks a preset (dropdown); optional custom full SERP URL.
 */

export const LINKEDIN_VIZAG_24H_CONTENT_URL =
  'https://www.linkedin.com/search/results/content/?keywords=vizag&origin=CLUSTER_EXPANSION&datePosted=%5B%22past-24h%22%5D&sortBy=%5B%22date_posted%22%5D';

export type LinkedInPostPresetId = 'general' | 'it' | 'bank' | 'custom';

export type ResolvedLinkedInPostPreset = {
  id: LinkedInPostPresetId;
  label: string;
  keywords: string[];
  urls: string[];
  categoryDefault: string;
  /** When true, try URL-based Apify actor (curious_coder) when keywords path returns nothing. */
  preferUrlActor: boolean;
};

const DEFAULT_KEYWORDS = [
  'jobs in vizag',
  'vizag',
  'visakhapatnam hiring',
  'hiring vizag',
];

const BUILTIN_PRESETS: Record<Exclude<LinkedInPostPresetId, 'custom'>, Omit<ResolvedLinkedInPostPreset, 'id'>> = {
  general: {
    label: 'Vizag hiring (general)',
    keywords: DEFAULT_KEYWORDS,
    urls: [LINKEDIN_VIZAG_24H_CONTENT_URL],
    categoryDefault: 'General',
    preferUrlActor: false,
  },
  it: {
    label: 'IT / software',
    keywords: [
      'software jobs vizag',
      'IT hiring visakhapatnam',
      'developer jobs vizag',
      'tech jobs vizag',
    ],
    urls: [],
    categoryDefault: 'IT',
    preferUrlActor: false,
  },
  bank: {
    label: 'Bank / finance',
    keywords: [
      'bank jobs vizag',
      'banking jobs visakhapatnam',
      'finance jobs vizag',
      'bank hiring vizag',
    ],
    urls: [],
    categoryDefault: 'Banking',
    preferUrlActor: false,
  },
};

export function buildLinkedInContentSearchUrl(keywords: string): string {
  const params = new URLSearchParams({
    keywords,
    origin: 'CLUSTER_EXPANSION',
    datePosted: '["past-24h"]',
    sortBy: '["date_posted"]',
  });
  return `https://www.linkedin.com/search/results/content/?${params.toString()}`;
}

function envPresetUrl(suffix: string): string | null {
  const v = Deno.env.get(`FETCH_LINKEDIN_POST_PRESET_${suffix}_URL`)?.trim();
  return v && v.includes('linkedin.com') ? v : null;
}

function parseEnvPresetsJson(): Partial<Record<string, Partial<ResolvedLinkedInPostPreset>>> {
  const raw = Deno.env.get('FETCH_LINKEDIN_POST_PRESETS_JSON')?.trim();
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Array<{
      id?: string;
      label?: string;
      keywords?: string[];
      urls?: string[];
      categoryDefault?: string;
      preferUrlActor?: boolean;
    }>;
    if (!Array.isArray(parsed)) {
      return {};
    }
    const out: Partial<Record<string, Partial<ResolvedLinkedInPostPreset>>> = {};
    for (const row of parsed) {
      if (!row?.id?.trim()) {
        continue;
      }
      out[row.id.trim().toLowerCase()] = {
        id: row.id.trim().toLowerCase() as LinkedInPostPresetId,
        label: row.label?.trim() || row.id,
        keywords: Array.isArray(row.keywords) ? row.keywords.map((k) => String(k).trim()).filter(Boolean) : [],
        urls: Array.isArray(row.urls) ? row.urls.map((u) => String(u).trim()).filter(Boolean) : [],
        categoryDefault: row.categoryDefault?.trim() || 'General',
        preferUrlActor: row.preferUrlActor === true,
      };
    }
    return out;
  } catch {
    console.warn(JSON.stringify({ event: 'linkedin_post_presets_json_invalid' }));
    return {};
  }
}

function mergePreset(
  base: Omit<ResolvedLinkedInPostPreset, 'id'>,
  id: LinkedInPostPresetId,
  override?: Partial<ResolvedLinkedInPostPreset>,
): ResolvedLinkedInPostPreset {
  const keywords =
    override?.keywords?.length ? override.keywords : base.keywords;
  const urlsFromKeywords =
    keywords.length > 0 && (!override?.urls?.length && !base.urls.length)
      ? keywords.slice(0, 5).map(buildLinkedInContentSearchUrl)
      : [];
  const urls = override?.urls?.length
    ? override.urls
    : base.urls.length
      ? base.urls
      : urlsFromKeywords;

  return {
    id,
    label: override?.label?.trim() || base.label,
    keywords,
    urls,
    categoryDefault: override?.categoryDefault?.trim() || base.categoryDefault,
    preferUrlActor: override?.preferUrlActor === true || base.preferUrlActor,
  };
}

export function normalizeLinkedInPostPresetId(raw: unknown): LinkedInPostPresetId {
  if (typeof raw !== 'string' || !raw.trim()) {
    return 'general';
  }
  const id = raw.trim().toLowerCase().replace(/-/g, '_');
  if (id === 'it' || id === 'linkedin_posts_it' || id === 'it_jobs') {
    return 'it';
  }
  if (id === 'bank' || id === 'banking' || id === 'linkedin_posts_bank') {
    return 'bank';
  }
  if (id === 'custom' || id === 'url' || id === 'custom_url') {
    return 'custom';
  }
  return 'general';
}

export function resolveLinkedInPostPreset(
  presetIdRaw: unknown,
  customSearchUrlRaw?: unknown,
): ResolvedLinkedInPostPreset {
  const envOverrides = parseEnvPresetsJson();
  const id = normalizeLinkedInPostPresetId(presetIdRaw);

  if (id === 'custom') {
    const customUrl =
      typeof customSearchUrlRaw === 'string' ? customSearchUrlRaw.trim() : '';
    const singleEnv = Deno.env.get('FETCH_LINKEDIN_CONTENT_URL')?.trim();
    const url = customUrl || singleEnv || '';
    return {
      id: 'custom',
      label: 'Custom search URL',
      keywords: [],
      urls: url && url.includes('linkedin.com') ? [url] : [],
      categoryDefault: 'General',
      preferUrlActor: true,
    };
  }

  const base = BUILTIN_PRESETS[id];
  const envOverride = envOverrides[id];
  let merged = mergePreset(base, id, envOverride);

  if (id === 'it') {
    const urlOverride = envPresetUrl('IT');
    if (urlOverride) {
      merged = { ...merged, urls: [urlOverride, ...merged.urls] };
    }
  }
  if (id === 'bank') {
    const urlOverride = envPresetUrl('BANK');
    if (urlOverride) {
      merged = { ...merged, urls: [urlOverride, ...merged.urls] };
    }
  }
  if (id === 'general') {
    const single = Deno.env.get('FETCH_LINKEDIN_CONTENT_URL')?.trim();
    if (single) {
      merged = { ...merged, urls: [single] };
    }
    const rawKw = Deno.env.get('FETCH_LINKEDIN_CONTENT_KEYWORDS');
    if (rawKw?.trim()) {
      const keywords = rawKw.split(',').map((k) => k.trim()).filter(Boolean);
      merged = {
        ...merged,
        keywords,
        urls: keywords.map(buildLinkedInContentSearchUrl),
      };
    }
  }

  return merged;
}

export function getLinkedInContentSearchUrlsForPreset(
  preset: ResolvedLinkedInPostPreset,
): string[] {
  if (preset.urls.length > 0) {
    return [...new Set(preset.urls)];
  }
  const maxUrls = Math.min(
    5,
    Math.max(1, Number(Deno.env.get('FETCH_LINKEDIN_CONTENT_SEARCH_URLS') ?? '3') || 3),
  );
  return preset.keywords.slice(0, maxUrls).map(buildLinkedInContentSearchUrl);
}
