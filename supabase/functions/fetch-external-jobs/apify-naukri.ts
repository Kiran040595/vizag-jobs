/**
 * Apify Store actor for Naukri Vizag jobs (api-empire~naukri-job-scraper).
 * @see https://apify.com/api-empire/naukri-job-scraper
 */

import { apifyRunActor } from './apify-linkedin.ts';

export const DEFAULT_NAUKRI_APIFY_ACTOR = 'api-empire~naukri-job-scraper';

/** Curated Vizag hub — last 24h, city + functional-area filters (matches Firecrawl hub). */
export const NAUKRI_VIZAG_24H_SEARCH_URL =
  'https://www.naukri.com/jobs-in-visakhapatnam?clusters=functionalAreaGid&functionAreaIdGid=1&functionAreaIdGid=2&functionAreaIdGid=3&functionAreaIdGid=5&functionAreaIdGid=6&functionAreaIdGid=7&functionAreaIdGid=8&functionAreaIdGid=11&functionAreaIdGid=13&functionAreaIdGid=14&functionAreaIdGid=18&functionAreaIdGid=24&functionAreaIdGid=25&functionAreaIdGid=36&functionAreaIdGid=37&cityTypeGid=26&jobPostType=1&jobAge=1';

export type ApifyNaukriJob = {
  title: string;
  company: string;
  experience: string;
  location?: string | null;
  apply_url?: string | null;
  posted_at?: string | null;
  summary?: string | null;
  source_url: string;
  source_name?: string | null;
  description_markdown?: string | null;
  scrape_chars?: number;
  scraped_at?: string;
  source_kind?: 'naukri';
  skills?: string[];
  salary?: string | null;
};

export type ApifyNaukriDiscoverResult = {
  naukri_provider: 'apify';
  jobs: ApifyNaukriJob[];
  job_urls: string[];
  naukri_search_url: string;
  apify_naukri_run_id: string | null;
  apify_naukri_count: number;
  apify_naukri_raw_count: number;
  apify_naukri_error: string | null;
};

type FetchBudgetLike = {
  hasTime(ms: number): boolean;
};

export type NaukriProvider = 'apify' | 'firecrawl' | 'apify_then_firecrawl';

export function getApifyTokenForNaukri(): string | null {
  return (
    Deno.env.get('APIFY_API_TOKEN_NAUKRI')?.trim() ??
    Deno.env.get('APIFY_API_TOKEN')?.trim() ??
    null
  );
}

export function getNaukriProvider(): NaukriProvider {
  const raw = Deno.env.get('FETCH_NAUKRI_PROVIDER')?.trim().toLowerCase();
  if (raw === 'firecrawl') {
    return 'firecrawl';
  }
  if (raw === 'apify_then_firecrawl' || raw === 'apify-then-firecrawl') {
    return 'apify_then_firecrawl';
  }
  if (raw === 'apify' || getApifyTokenForNaukri()) {
    return 'apify';
  }
  return 'firecrawl';
}

export function naukriApifyFallbackEnabled(): boolean {
  return (Deno.env.get('FETCH_NAUKRI_FALLBACK_FIRECRAWL') ?? 'true').toLowerCase() !== 'false';
}

/** Visakhapatnam / Vizag spellings only — not generic "Andhra Pradesh". */
const NAUKRI_VIZAG_RE = /\b(visakhapatnam|vishakhapatnam|vizag)\b/i;

/**
 * True when a Naukri listing is anchored in Vizag (location field and/or job URL slug).
 * Rejects Hyderabad, Bangalore, etc. even when the listing URL is a valid job-listings page.
 */
export function isNaukriVizagJob(job: {
  location?: string | null;
  source_url?: string;
  apply_url?: string | null;
  summary?: string | null;
  description_markdown?: string | null;
}): boolean {
  const location = job.location?.trim() ?? '';
  if (location) {
    return NAUKRI_VIZAG_RE.test(location);
  }

  const url = (job.apply_url ?? job.source_url ?? '').toLowerCase();
  if (!url.includes('naukri.com')) {
    return false;
  }
  if (NAUKRI_VIZAG_RE.test(url)) {
    return true;
  }
  if (
    /-(?:hyderabad|bangalore|bengaluru|chennai|mumbai|pune|delhi|gurugram|gurgaon|noida|kolkata|kochi|coimbatore|jaipur|ahmedabad|nagpur|bhubaneswar|warangal|vijayawada|guntur|tirupati|khammam|rajahmundry)-\d{9,}/i.test(
      url,
    )
  ) {
    return false;
  }
  return false;
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return null;
}

function parseApifyDate(value: unknown, referenceIso: string): string | null {
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString();
    }
    const low = value.trim().toLowerCase();
    const ref = new Date(referenceIso);
    if (!Number.isNaN(ref.getTime())) {
      const hours = low.match(/(\d+)\s*hours?\s*ago/i);
      if (hours) {
        return new Date(ref.getTime() - Number(hours[1]) * 3_600_000).toISOString();
      }
      const days = low.match(/(\d+)\s*days?\s*ago/i);
      if (days) {
        return new Date(ref.getTime() - Number(days[1]) * 86_400_000).toISOString();
      }
    }
  }
  if (typeof value === 'number' && value > 1_000_000_000) {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  return null;
}

function isUsableNaukriTitle(title: string | null): boolean {
  if (!title?.trim()) {
    return false;
  }
  const low = title.trim().toLowerCase();
  return low.length >= 3 && low.length <= 200 && low !== 'job description' && low !== 'job opening';
}

function normalizeNaukriJobUrl(raw: string | null): string | null {
  if (!raw?.trim()) {
    return null;
  }
  let url = raw.trim();
  if (!url.startsWith('http')) {
    url = `https://www.naukri.com${url.startsWith('/') ? url : `/${url}`}`;
  }
  try {
    const u = new URL(url);
    if (!u.hostname.includes('naukri.com')) {
      return null;
    }
    return u.href;
  } catch {
    return null;
  }
}

function parseSkillsBlob(raw: string | null): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return [...new Set(raw.split(/[,;|]/).map((s) => s.trim()).filter((s) => s.length >= 2 && s.length <= 60))]
    .slice(0, 24);
}

function naukriJobRecordFromFlat(
  flat: Record<string, unknown>,
  scrapedAt: string,
  fallbackSearchUrl: string,
): ApifyNaukriJob | null {
  const title = firstString(flat, ['title', 'jobTitle', 'job_title', 'role']) ?? null;
  if (!isUsableNaukriTitle(title)) {
    return null;
  }
  const company =
    firstString(flat, ['companyName', 'company', 'company_name', 'employer']) ?? 'Unknown';
  const location =
    firstString(flat, ['location', 'jobLocation', 'city', 'place']) ?? null;
  const applyRaw =
    firstString(flat, ['jdURL', 'jdUrl', 'jobUrl', 'job_url', 'url', 'applyUrl', 'apply_url']) ??
    null;
  const applyUrl = normalizeNaukriJobUrl(applyRaw);
  const description =
    firstString(flat, ['jobDescription', 'description', 'descriptionText', 'jd']) ?? '';
  const salary = firstString(flat, ['salary', 'salaryDetail', 'ctc']) ?? null;
  const skills = parseSkillsBlob(
    firstString(flat, ['tagsAndSkills', 'skills', 'keySkills', 'tags_and_skills']),
  );
  const posted_at =
    parseApifyDate(
      flat.createdDate ?? flat.postedDate ?? flat.posted_at ?? flat.postedAt,
      scrapedAt,
    ) ?? null;
  const sourceUrl = applyUrl ?? fallbackSearchUrl;
  const summaryParts = [salary, skills.slice(0, 6).join(', ')].filter(Boolean);
  return {
    title: title!.slice(0, 160),
    company,
    experience: firstString(flat, ['experience', 'experienceText', 'exp']) ?? 'Not specified',
    location: location ?? undefined,
    apply_url: applyUrl ?? sourceUrl,
    source_url: sourceUrl,
    source_name: 'naukri.com',
    posted_at,
    summary: summaryParts.join(' · ') || description.slice(0, 300) || null,
    description_markdown: description || null,
    scrape_chars: description.length,
    scraped_at: scrapedAt,
    source_kind: 'naukri',
    skills,
    salary,
  };
}

/** Map api-empire~naukri-job-scraper dataset rows to site jobs. */
export function apifyItemsToNaukriJobs(
  items: Record<string, unknown>[],
  scrapedAt: string,
  fallbackSearchUrl: string,
): ApifyNaukriJob[] {
  const jobs: ApifyNaukriJob[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const details =
      item.jobDetails && typeof item.jobDetails === 'object'
        ? (item.jobDetails as Record<string, unknown>)
        : item;
    const record = naukriJobRecordFromFlat(details, scrapedAt, fallbackSearchUrl);
    if (!record) {
      continue;
    }
    if (!isNaukriVizagJob(record)) {
      continue;
    }
    const key = (record.apply_url ?? record.source_url).toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    jobs.push(record);
  }

  return jobs;
}

function defaultNaukriMaxJobs(fetchDetails: boolean): number {
  const envRaw =
    Deno.env.get('APIFY_NAUKRI_MAX_JOBS') ?? Deno.env.get('FETCH_NAUKRI_SCRAPE_LIMIT');
  if (envRaw?.trim()) {
    const n = Number(envRaw) || 12;
    return Math.min(100, Math.max(1, n));
  }
  // Full JD fetches are slow (~15–25s each); keep the default batch small unless overridden.
  const fallback = fetchDetails ? 12 : 25;
  return Math.min(100, Math.max(1, fallback));
}

/** Default actor input — keyword + Visakhapatnam city id 26, last 24h, company HR posts. */
export const DEFAULT_NAUKRI_APIFY_INPUT: Record<string, unknown> = {
  cities: ['26'],
  experience: 'all',
  fetchDetails: true,
  freshness: '1',
  keyword: 'vizag',
  maxJobs: 12,
  postedBy: ['1'],
  proxyConfiguration: { useApifyProxy: false },
  sortBy: 'date',
  maxRequestRetries: 2,
};

export function buildNaukriActorInput(): Record<string, unknown> {
  const override = Deno.env.get('APIFY_NAUKRI_INPUT_JSON')?.trim();
  if (override) {
    try {
      return JSON.parse(override) as Record<string, unknown>;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(`APIFY_NAUKRI_INPUT_JSON is not valid JSON (${detail}).`);
    }
  }

  const keyword = Deno.env.get('APIFY_NAUKRI_KEYWORD')?.trim() || 'vizag';
  const postedByRaw = Deno.env.get('APIFY_NAUKRI_POSTED_BY')?.trim();
  const postedBy = postedByRaw
    ? postedByRaw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    : ['1'];

  const fetchDetails =
    (Deno.env.get('APIFY_NAUKRI_FETCH_DETAILS') ?? 'true').toLowerCase() !== 'false';

  return {
    ...DEFAULT_NAUKRI_APIFY_INPUT,
    keyword,
    maxJobs: defaultNaukriMaxJobs(fetchDetails),
    postedBy,
    freshness: Deno.env.get('APIFY_NAUKRI_FRESHNESS')?.trim() || '1',
    sortBy: Deno.env.get('APIFY_NAUKRI_SORT_BY')?.trim() || 'date',
    fetchDetails,
  };
}

export function naukriApifyInputLabel(input: Record<string, unknown>): string {
  const keyword = typeof input.keyword === 'string' ? input.keyword : 'vizag';
  const cities = Array.isArray(input.cities) ? input.cities.join(',') : '26';
  const freshness = typeof input.freshness === 'string' ? input.freshness : '1';
  return `keyword=${keyword};cities=${cities};freshness=${freshness}`;
}

function naukriApifySyncTimeoutSec(budget?: FetchBudgetLike): number {
  const preferred = Number(Deno.env.get('APIFY_NAUKRI_SYNC_TIMEOUT_SEC') ?? '100') || 100;
  if (budget && !budget.hasTime(preferred * 1000 + 12_000)) {
    return Math.max(60, Math.min(preferred, 80));
  }
  return Math.min(120, Math.max(60, preferred));
}

function getNaukriActorId(): string {
  return Deno.env.get('APIFY_NAUKRI_ACTOR')?.trim() || DEFAULT_NAUKRI_APIFY_ACTOR;
}

const APIFY_API_BASE = 'https://api.apify.com/v2';

/** Admin UI countdown before collecting Apify Naukri results (default 3 minutes). */
export const NAUKRI_ASYNC_COLLECT_WAIT_MS = Math.min(
  600_000,
  Math.max(60_000, Number(Deno.env.get('APIFY_NAUKRI_COLLECT_WAIT_MS') ?? '180000') || 180_000),
);

function normalizeNaukriActorId(actorId: string): string {
  const trimmed = actorId.trim();
  return trimmed.includes('~') ? trimmed : trimmed.replace('/', '~');
}

export type NaukriApifyStartResult = {
  runId: string | null;
  actorId: string;
  input: Record<string, unknown>;
  inputLabel: string;
  error: string | null;
};

export type NaukriApifyCollectResult = {
  status: string;
  pending: boolean;
  jobs: ApifyNaukriJob[];
  apify_naukri_run_id: string;
  apify_naukri_raw_count: number;
  apify_naukri_count: number;
  naukri_search_url: string;
  error: string | null;
};

/** Fire-and-forget Apify actor run — returns immediately with run id. */
export async function startNaukriApifyRunAsync(): Promise<NaukriApifyStartResult> {
  const token = getApifyTokenForNaukri();
  const actorId = getNaukriActorId();
  const input = buildNaukriActorInput();
  const inputLabel = naukriApifyInputLabel(input);
  if (!token) {
    return {
      runId: null,
      actorId,
      input,
      inputLabel,
      error: 'APIFY_API_TOKEN_NAUKRI (or APIFY_API_TOKEN) not set',
    };
  }

  const normalized = normalizeNaukriActorId(actorId);
  const startUrl = `${APIFY_API_BASE}/acts/${normalized}/runs`;
  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const startPayload = await startRes.json().catch(() => null);
  if (!startRes.ok) {
    const msg =
      startPayload?.error?.message ?? startPayload?.error ?? startRes.statusText;
    return { runId: null, actorId, input, inputLabel, error: `Apify run start failed: ${msg}` };
  }
  const runId = startPayload?.data?.id as string | undefined;
  if (!runId) {
    return { runId: null, actorId, input, inputLabel, error: 'Apify run start returned no run id' };
  }

  console.log(
    JSON.stringify({
      event: 'apify_naukri_start',
      actor: actorId,
      run_id: runId,
      apify_input: input,
      input_label: inputLabel,
    }),
  );

  return { runId, actorId, input, inputLabel, error: null };
}

/** Read dataset items from a finished (or in-progress) Apify run. */
export async function collectNaukriApifyRun(
  runId: string,
  scrapedAt?: string,
): Promise<NaukriApifyCollectResult> {
  const token = getApifyTokenForNaukri();
  const fallbackHubUrl =
    Deno.env.get('APIFY_NAUKRI_SEARCH_URL')?.trim() || NAUKRI_VIZAG_24H_SEARCH_URL;
  const empty = (status: string, pending: boolean, error: string | null): NaukriApifyCollectResult => ({
    status,
    pending,
    jobs: [],
    apify_naukri_run_id: runId,
    apify_naukri_raw_count: 0,
    apify_naukri_count: 0,
    naukri_search_url: fallbackHubUrl,
    error,
  });

  if (!token) {
    return empty('MISSING_TOKEN', false, 'APIFY_API_TOKEN_NAUKRI (or APIFY_API_TOKEN) not set');
  }

  const statusRes = await fetch(`${APIFY_API_BASE}/actor-runs/${runId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const statusPayload = await statusRes.json().catch(() => null);
  if (!statusRes.ok) {
    const msg =
      statusPayload?.error?.message ?? statusPayload?.error ?? statusRes.statusText;
    return empty('ERROR', false, `Apify run lookup failed: ${msg}`);
  }

  const status = String(statusPayload?.data?.status ?? 'UNKNOWN');
  const datasetId = statusPayload?.data?.defaultDatasetId as string | undefined;

  if (status === 'RUNNING' || status === 'READY') {
    return empty(status, true, null);
  }

  if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
    return empty(status, false, `Apify run ended with status ${status}`);
  }

  if (!datasetId) {
    return empty(status, false, 'Apify run has no dataset');
  }

  const itemsUrl = `${APIFY_API_BASE}/datasets/${datasetId}/items?format=json&clean=true`;
  const itemsRes = await fetch(itemsUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const items = await itemsRes.json().catch(() => []);
  if (!itemsRes.ok || !Array.isArray(items)) {
    return empty(status, false, 'Failed to read Apify dataset items');
  }

  const instant = scrapedAt ?? new Date().toISOString();
  const jobs = apifyItemsToNaukriJobs(items as Record<string, unknown>[], instant, fallbackHubUrl);

  console.log(
    JSON.stringify({
      event: 'apify_naukri_collect',
      run_id: runId,
      status,
      raw_items: items.length,
      mapped_jobs: jobs.length,
    }),
  );

  return {
    status,
    pending: false,
    jobs,
    apify_naukri_run_id: runId,
    apify_naukri_raw_count: items.length,
    apify_naukri_count: jobs.length,
    naukri_search_url: naukriApifyInputLabel(buildNaukriActorInput()),
    error: jobs.length > 0 ? null : 'No Vizag Naukri jobs in Apify dataset yet',
  };
}

export async function discoverNaukriViaApify(
  budget?: FetchBudgetLike,
  scrapedAt?: string,
): Promise<ApifyNaukriDiscoverResult> {
  const token = getApifyTokenForNaukri();
  const fallbackHubUrl =
    Deno.env.get('APIFY_NAUKRI_SEARCH_URL')?.trim() || NAUKRI_VIZAG_24H_SEARCH_URL;
  const empty: ApifyNaukriDiscoverResult = {
    naukri_provider: 'apify',
    jobs: [],
    job_urls: [],
    naukri_search_url: fallbackHubUrl,
    apify_naukri_run_id: null,
    apify_naukri_count: 0,
    apify_naukri_raw_count: 0,
    apify_naukri_error: token ? null : 'APIFY_API_TOKEN_NAUKRI (or APIFY_API_TOKEN) not set',
  };

  if (!token) {
    return empty;
  }
  if (budget && !budget.hasTime(105_000)) {
    return { ...empty, apify_naukri_error: 'Skipped Naukri Apify — insufficient time budget' };
  }

  const instant = scrapedAt ?? new Date().toISOString();
  const actorId = getNaukriActorId();
  const input = buildNaukriActorInput();
  const inputLabel = naukriApifyInputLabel(input);
  const run = await apifyRunActor(actorId, input, token, budget, {
    timeoutSec: naukriApifySyncTimeoutSec(budget),
    syncOnly: true,
  });
  const jobs = apifyItemsToNaukriJobs(run.items, instant, fallbackHubUrl);

  console.log(
    JSON.stringify({
      event: 'apify_naukri_jobs',
      actor: actorId,
      run_id: run.runId,
      apify_input: input,
      input_label: inputLabel,
      raw_items: run.items.length,
      mapped_jobs: jobs.length,
      error: run.error,
    }),
  );

  const job_urls = jobs
    .map((j) => j.apply_url ?? j.source_url)
    .filter((u): u is string => Boolean(u && u.includes('naukri.com')));

  return {
    naukri_provider: 'apify',
    jobs,
    job_urls,
    naukri_search_url: inputLabel,
    apify_naukri_run_id: run.runId,
    apify_naukri_count: jobs.length,
    apify_naukri_raw_count: run.items.length,
    apify_naukri_error:
      jobs.length > 0
        ? run.error
          ? `Partial Apify run (${jobs.length} Vizag jobs): ${run.error}`
          : null
        : run.error ?? 'Naukri Apify actor returned no mappable jobs',
  };
}
