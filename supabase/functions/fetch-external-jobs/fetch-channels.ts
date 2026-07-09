/**
 * Per-source fetch channels — each button on the admin page maps to one channel.
 * Secrets can be split to spread load: FIRECRAWL_API_KEY_NAUKRI, GEMINI_API_KEY_LINKEDIN_POSTS, etc.
 */

export const FETCH_CHANNELS = [
  'naukri',
  'linkedin_jobs',
  'linkedin_posts',
  'vizag_it',
  'indeed',
] as const;

export type FetchChannel = (typeof FETCH_CHANNELS)[number];

const CHANNEL_ENV_SUFFIX: Record<FetchChannel, string> = {
  naukri: 'NAUKRI',
  linkedin_jobs: 'LINKEDIN_JOBS',
  linkedin_posts: 'LINKEDIN_POSTS',
  vizag_it: 'VIZAG_IT',
  indeed: 'INDEED',
};

export function parseFetchChannel(raw: unknown): FetchChannel | null {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  const normalized = raw.trim().toLowerCase().replace(/-/g, '_');
  if (normalized === 'linkedin' || normalized === 'linkedin_job') {
    return 'linkedin_jobs';
  }
  if (normalized === 'linkedin_post' || normalized === 'posts') {
    return 'linkedin_posts';
  }
  if (normalized === 'vizag_it_companies' || normalized === 'it_companies') {
    return 'vizag_it';
  }
  return (FETCH_CHANNELS as readonly string[]).includes(normalized)
    ? (normalized as FetchChannel)
    : null;
}

/** Channel-specific secret, then global fallback (e.g. FIRECRAWL_API_KEY_NAUKRI → FIRECRAWL_API_KEY). */
export function resolveChannelSecret(
  baseName: string,
  channel: FetchChannel,
  useGlobalFallback = true,
): string | null {
  const suffix = CHANNEL_ENV_SUFFIX[channel];
  const specific = Deno.env.get(`${baseName}_${suffix}`)?.trim();
  if (specific) {
    return specific;
  }
  if (useGlobalFallback) {
    return Deno.env.get(baseName)?.trim() ?? null;
  }
  return null;
}

/** All Firecrawl keys for a channel: channel-specific, FIRECRAWL_API_KEY, then FIRECRAWL_API_KEYS. */
export function getFirecrawlApiKeys(channel: FetchChannel | null): string[] {
  const keys: string[] = [];
  if (channel) {
    const specific = Deno.env.get(`FIRECRAWL_API_KEY_${CHANNEL_ENV_SUFFIX[channel]}`)?.trim();
    if (specific) {
      keys.push(specific);
    }
  }
  const primary = Deno.env.get('FIRECRAWL_API_KEY')?.trim();
  if (primary) {
    keys.push(primary);
  }
  const extra = Deno.env.get('FIRECRAWL_API_KEYS')?.trim();
  if (extra) {
    for (const part of extra.split(/[,\n]+/)) {
      const k = part.trim();
      if (k) {
        keys.push(k);
      }
    }
  }
  return [...new Set(keys)];
}

export function channelLabel(channel: FetchChannel): string {
  const labels: Record<FetchChannel, string> = {
    naukri: 'Naukri',
    linkedin_jobs: 'LinkedIn Jobs',
    linkedin_posts: 'LinkedIn Posts',
    vizag_it: 'Vizag IT companies',
    indeed: 'Indeed',
  };
  return labels[channel];
}

export const VIZAG_IT_SEARCH_QUERIES = [
  'site:www.naukri.com/job-listings Visakhapatnam software developer',
  'site:www.naukri.com/job-listings Vizag IT',
  'site:in.linkedin.com/jobs/view Visakhapatnam software engineer',
  'site:in.linkedin.com/jobs/view Vizag developer',
  'Visakhapatnam IT company hiring site:linkedin.com/jobs/view',
];

export const INDEED_SEARCH_QUERIES = [
  'site:in.indeed.com viewjob Visakhapatnam',
  'site:in.indeed.com viewjob Vizag',
  'site:indeed.com vizag jobs',
];
