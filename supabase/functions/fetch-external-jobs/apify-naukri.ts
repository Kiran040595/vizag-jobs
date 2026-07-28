/**
 * Apify Store actor for Naukri Vizag jobs.
 * Default: dineshwadhwani~naukri-job-scrapper (override with APIFY_NAUKRI_ACTOR).
 * @see https://apify.com/dineshwadhwani/naukri-job-scrapper
 */

import { apifyRunActor } from './apify-linkedin.ts';
import {
  naukriApifyScrapePoolSize,
  naukriExperienceSortEnabled,
  naukriFresherCollectionRatio,
  prioritizeNaukriJobsByExperience,
} from '../_shared/naukriExperienceSort.ts';

export const DEFAULT_NAUKRI_APIFY_ACTOR = 'dineshwadhwani~naukri-job-scrapper';

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

function parseSkillsField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length >= 2 && item.length <= 60),
      ),
    ].slice(0, 24);
  }
  if (typeof value === 'string') {
    return parseSkillsBlob(value);
  }
  return [];
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
    firstString(flat, [
      'link',
      'jdURL',
      'jdUrl',
      'jobUrl',
      'job_url',
      'url',
      'applyUrl',
      'apply_url',
    ]) ?? null;
  const applyUrl = normalizeNaukriJobUrl(applyRaw);
  const description =
    firstString(flat, ['jobDescription', 'description', 'descriptionText', 'jd']) ?? '';
  const salary = firstString(flat, ['salary', 'salaryDetail', 'ctc']) ?? null;
  const skills =
    parseSkillsField(flat.skills) ||
    parseSkillsBlob(firstString(flat, ['tagsAndSkills', 'keySkills', 'tags_and_skills']));
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

export type ApifyNaukriMapOptions = {
  /** Cap jobs after fresher-first prioritization (defaults to no cap). */
  maxJobs?: number;
  /** Target fresher+entry share when capping (default 0.75). */
  fresherRatio?: number;
  /** When false, return Vizag jobs in scrape order without experience sorting. */
  experienceSort?: boolean;
};

/** Map api-empire~naukri-job-scraper dataset rows to site jobs. */
export function apifyItemsToNaukriJobs(
  items: Record<string, unknown>[],
  scrapedAt: string,
  fallbackSearchUrl: string,
  mapOptions: ApifyNaukriMapOptions = {},
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

  const experienceSort = mapOptions.experienceSort ?? naukriExperienceSortEnabled();
  if (!experienceSort) {
    return jobs;
  }

  return prioritizeNaukriJobsByExperience(jobs, {
    maxJobs: mapOptions.maxJobs,
    fresherRatio: mapOptions.fresherRatio ?? naukriFresherCollectionRatio(),
  });
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

/**
 * Default inputs for dineshwadhwani~naukri-job-scrapper — Vizag, last 24h.
 * Roles must be words that appear in job titles (actor title-filters on them).
 * Actor allows max 3 roles per run, so we run two scrapes: fresher + important roles.
 */
export const DEFAULT_NAUKRI_FRESHER_INPUT: Record<string, unknown> = {
  roles: ['Fresher', 'Trainee', 'Intern'],
  locations: ['Visakhapatnam'],
  skills: [],
  timeFrame: '1',
};

export const DEFAULT_NAUKRI_ROLES_INPUT: Record<string, unknown> = {
  roles: ['Developer', 'Associate', 'Executive'],
  locations: ['Visakhapatnam'],
  skills: [],
  timeFrame: '1',
};

/** @deprecated Prefer listNaukriActorInputs(); kept as roles-batch default. */
export const DEFAULT_NAUKRI_APIFY_INPUT: Record<string, unknown> = {
  ...DEFAULT_NAUKRI_ROLES_INPUT,
};

function parseNaukriInputJson(
  raw: string | undefined,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const override = raw?.trim();
  if (!override) {
    return { ...fallback };
  }
  try {
    return JSON.parse(override) as Record<string, unknown>;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.warn(
      JSON.stringify({
        event: 'apify_naukri_input_json_invalid',
        error: detail,
        fallback: 'built-in default',
      }),
    );
    return { ...fallback };
  }
}

export function naukriApifyInputLabel(input: Record<string, unknown>): string {
  if (Array.isArray(input.roles) || Array.isArray(input.locations)) {
    const roles = Array.isArray(input.roles) ? input.roles.map(String).join('+') : '';
    const locs = Array.isArray(input.locations) ? input.locations.map(String).join('+') : '';
    const tf = typeof input.timeFrame === 'string' ? input.timeFrame : '1';
    return `roles=${roles};locations=${locs};timeFrame=${tf}`;
  }
  const keyword = typeof input.keyword === 'string' ? input.keyword : 'vizag';
  const cities = Array.isArray(input.cities) ? input.cities.join(',') : '26';
  const freshness = typeof input.freshness === 'string' ? input.freshness : '1';
  return `keyword=${keyword};cities=${cities};freshness=${freshness}`;
}

export type NaukriActorInputBatch = {
  key: 'fresher' | 'roles' | 'default';
  label: string;
  input: Record<string, unknown>;
};

/** Dual-run by default: fresher batch then important-roles batch (max 3 roles each). */
export function naukriDualRunEnabled(): boolean {
  return (Deno.env.get('APIFY_NAUKRI_DUAL_RUN') ?? 'true').toLowerCase() !== 'false';
}

export function listNaukriActorInputs(): NaukriActorInputBatch[] {
  if (!naukriDualRunEnabled()) {
    const singleOverride = Deno.env.get('APIFY_NAUKRI_INPUT_JSON');
    const input = parseNaukriInputJson(singleOverride, DEFAULT_NAUKRI_APIFY_INPUT);
    return [{ key: 'default', label: naukriApifyInputLabel(input), input }];
  }

  const fresher = parseNaukriInputJson(
    Deno.env.get('APIFY_NAUKRI_FRESHER_INPUT_JSON') ?? Deno.env.get('APIFY_NAUKRI_INPUT_JSON_FRESHER'),
    DEFAULT_NAUKRI_FRESHER_INPUT,
  );
  const roles = parseNaukriInputJson(
    Deno.env.get('APIFY_NAUKRI_ROLES_INPUT_JSON') ?? Deno.env.get('APIFY_NAUKRI_INPUT_JSON'),
    DEFAULT_NAUKRI_ROLES_INPUT,
  );

  return [
    { key: 'fresher', label: naukriApifyInputLabel(fresher), input: fresher },
    { key: 'roles', label: naukriApifyInputLabel(roles), input: roles },
  ];
}

export function buildNaukriActorInput(): Record<string, unknown> {
  return { ...listNaukriActorInputs()[0].input };
}

/** Jobs returned to admin/automation after fresher-first prioritization. */
export function naukriOutputJobLimit(): number {
  const fetchDetails =
    (Deno.env.get('APIFY_NAUKRI_FETCH_DETAILS') ?? 'true').toLowerCase() !== 'false';
  return defaultNaukriMaxJobs(fetchDetails);
}

function naukriMapOptions(): ApifyNaukriMapOptions {
  return {
    maxJobs: naukriOutputJobLimit(),
    fresherRatio: naukriFresherCollectionRatio(),
    experienceSort: naukriExperienceSortEnabled(),
  };
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
  runIds: string[];
  actorId: string;
  input: Record<string, unknown>;
  inputLabel: string;
  batchLabels: string[];
  error: string | null;
};

export type NaukriApifyCollectResult = {
  status: string;
  pending: boolean;
  jobs: ApifyNaukriJob[];
  apify_naukri_run_id: string;
  apify_naukri_run_ids: string[];
  apify_naukri_raw_count: number;
  apify_naukri_count: number;
  naukri_search_url: string;
  error: string | null;
};

function parseNaukriRunIds(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) {
    return raw.map((id) => String(id).trim()).filter(Boolean);
  }
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }
  return raw
    .split(/[,|\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

async function startSingleNaukriApifyRun(
  token: string,
  actorId: string,
  input: Record<string, unknown>,
  batchKey: string,
): Promise<{ runId: string | null; error: string | null }> {
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
    return { runId: null, error: `Apify run start failed (${batchKey}): ${msg}` };
  }
  const runId = startPayload?.data?.id as string | undefined;
  if (!runId) {
    return { runId: null, error: `Apify run start returned no run id (${batchKey})` };
  }

  console.log(
    JSON.stringify({
      event: 'apify_naukri_start',
      batch: batchKey,
      actor: actorId,
      run_id: runId,
      apify_input: input,
      input_label: naukriApifyInputLabel(input),
    }),
  );

  return { runId, error: null };
}

/** Fire-and-forget Apify actor run(s) — dual fresher + roles by default. */
export async function startNaukriApifyRunAsync(): Promise<NaukriApifyStartResult> {
  const token = getApifyTokenForNaukri();
  const actorId = getNaukriActorId();
  const batches = listNaukriActorInputs();
  const primaryInput = batches[0]?.input ?? DEFAULT_NAUKRI_APIFY_INPUT;
  const inputLabel = batches.map((b) => `${b.key}:{${b.label}}`).join(' | ');
  const batchLabels = batches.map((b) => `${b.key}: ${b.label}`);

  if (!token) {
    return {
      runId: null,
      runIds: [],
      actorId,
      input: primaryInput,
      inputLabel,
      batchLabels,
      error: 'APIFY_API_TOKEN_NAUKRI (or APIFY_API_TOKEN) not set',
    };
  }

  const runIds: string[] = [];
  const errors: string[] = [];

  // Start batches one after another so Apify billing/concurrency stays predictable.
  for (const batch of batches) {
    const started = await startSingleNaukriApifyRun(token, actorId, batch.input, batch.key);
    if (started.runId) {
      runIds.push(started.runId);
    }
    if (started.error) {
      errors.push(started.error);
    }
  }

  if (runIds.length === 0) {
    return {
      runId: null,
      runIds: [],
      actorId,
      input: primaryInput,
      inputLabel,
      batchLabels,
      error: errors.join('; ') || 'Failed to start Naukri Apify run(s).',
    };
  }

  return {
    runId: runIds.join(','),
    runIds,
    actorId,
    input: primaryInput,
    inputLabel,
    batchLabels,
    error: errors.length > 0 ? `Partial start: ${errors.join('; ')}` : null,
  };
}

/** Collect one Apify run without applying the final output cap (used for dual-merge). */
async function collectNaukriApifyRunRaw(
  runId: string,
  scrapedAt?: string,
): Promise<{
  status: string;
  pending: boolean;
  jobs: ApifyNaukriJob[];
  rawCount: number;
  error: string | null;
}> {
  const token = getApifyTokenForNaukri();
  const fallbackHubUrl =
    Deno.env.get('APIFY_NAUKRI_SEARCH_URL')?.trim() || NAUKRI_VIZAG_24H_SEARCH_URL;

  if (!token) {
    return {
      status: 'MISSING_TOKEN',
      pending: false,
      jobs: [],
      rawCount: 0,
      error: 'APIFY_API_TOKEN_NAUKRI (or APIFY_API_TOKEN) not set',
    };
  }

  const statusRes = await fetch(`${APIFY_API_BASE}/actor-runs/${runId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const statusPayload = await statusRes.json().catch(() => null);
  if (!statusRes.ok) {
    const msg =
      statusPayload?.error?.message ?? statusPayload?.error ?? statusRes.statusText;
    return {
      status: 'ERROR',
      pending: false,
      jobs: [],
      rawCount: 0,
      error: `Apify run lookup failed: ${msg}`,
    };
  }

  const status = String(statusPayload?.data?.status ?? 'UNKNOWN');
  const datasetId = statusPayload?.data?.defaultDatasetId as string | undefined;

  if (status === 'RUNNING' || status === 'READY') {
    return { status, pending: true, jobs: [], rawCount: 0, error: null };
  }

  if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
    return {
      status,
      pending: false,
      jobs: [],
      rawCount: 0,
      error: `Apify run ended with status ${status}`,
    };
  }

  if (!datasetId) {
    return {
      status,
      pending: false,
      jobs: [],
      rawCount: 0,
      error: 'Apify run has no dataset',
    };
  }

  const itemsUrl = `${APIFY_API_BASE}/datasets/${datasetId}/items?format=json&clean=true`;
  const itemsRes = await fetch(itemsUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const items = await itemsRes.json().catch(() => []);
  if (!itemsRes.ok || !Array.isArray(items)) {
    return {
      status,
      pending: false,
      jobs: [],
      rawCount: 0,
      error: 'Failed to read Apify dataset items',
    };
  }

  const instant = scrapedAt ?? new Date().toISOString();
  // Map without capping — final limit applied after dual-run merge.
  const jobs = apifyItemsToNaukriJobs(
    items as Record<string, unknown>[],
    instant,
    fallbackHubUrl,
    { experienceSort: false },
  );

  return {
    status,
    pending: false,
    jobs,
    rawCount: items.length,
    error: null,
  };
}

function mergeNaukriJobs(jobs: ApifyNaukriJob[]): ApifyNaukriJob[] {
  const seen = new Set<string>();
  const merged: ApifyNaukriJob[] = [];
  for (const job of jobs) {
    const key = (job.apply_url ?? job.source_url).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(job);
  }
  return prioritizeNaukriJobsByExperience(merged, naukriMapOptions());
}

/** Read dataset items from finished Apify run(s). Supports comma-joined dual run ids. */
export async function collectNaukriApifyRun(
  runId: string,
  scrapedAt?: string,
): Promise<NaukriApifyCollectResult> {
  const runIds = parseNaukriRunIds(runId);
  const fallbackHubUrl =
    Deno.env.get('APIFY_NAUKRI_SEARCH_URL')?.trim() || NAUKRI_VIZAG_24H_SEARCH_URL;
  const joined = runIds.join(',') || runId;

  if (runIds.length === 0) {
    return {
      status: 'ERROR',
      pending: false,
      jobs: [],
      apify_naukri_run_id: runId,
      apify_naukri_run_ids: [],
      apify_naukri_raw_count: 0,
      apify_naukri_count: 0,
      naukri_search_url: fallbackHubUrl,
      error: 'Missing apify_naukri_run_id',
    };
  }

  const parts = await Promise.all(runIds.map((id) => collectNaukriApifyRunRaw(id, scrapedAt)));
  if (parts.some((p) => p.pending)) {
    const pendingStatus = parts.find((p) => p.pending)?.status ?? 'RUNNING';
    return {
      status: pendingStatus,
      pending: true,
      jobs: [],
      apify_naukri_run_id: joined,
      apify_naukri_run_ids: runIds,
      apify_naukri_raw_count: 0,
      apify_naukri_count: 0,
      naukri_search_url: fallbackHubUrl,
      error: null,
    };
  }

  const allJobs = parts.flatMap((p) => p.jobs);
  const rawCount = parts.reduce((sum, p) => sum + p.rawCount, 0);
  const errors = parts.map((p) => p.error).filter(Boolean) as string[];
  const statuses = [...new Set(parts.map((p) => p.status))];
  const jobs = mergeNaukriJobs(allJobs);

  console.log(
    JSON.stringify({
      event: 'apify_naukri_collect',
      run_ids: runIds,
      status: statuses.join(','),
      raw_items: rawCount,
      mapped_before_cap: allJobs.length,
      mapped_jobs: jobs.length,
      batches: runIds.length,
    }),
  );

  return {
    status: statuses.join(',') || 'SUCCEEDED',
    pending: false,
    jobs,
    apify_naukri_run_id: joined,
    apify_naukri_run_ids: runIds,
    apify_naukri_raw_count: rawCount,
    apify_naukri_count: jobs.length,
    naukri_search_url: listNaukriActorInputs()
      .map((b) => `${b.key}:{${b.label}}`)
      .join(' | '),
    error:
      jobs.length > 0
        ? errors.length
          ? `Partial collect: ${errors.join('; ')}`
          : null
        : errors.join('; ') || 'No Vizag Naukri jobs in Apify dataset yet',
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
  const batches = listNaukriActorInputs();
  const inputLabel = batches.map((b) => `${b.key}:{${b.label}}`).join(' | ');
  const allItems: Record<string, unknown>[] = [];
  const runIds: string[] = [];
  const errors: string[] = [];

  for (const batch of batches) {
    if (budget && !budget.hasTime(55_000)) {
      errors.push(`Skipped ${batch.key} batch — insufficient time budget`);
      break;
    }
    const run = await apifyRunActor(actorId, batch.input, token, budget, {
      timeoutSec: naukriApifySyncTimeoutSec(budget),
      syncOnly: true,
    });
    if (run.runId) runIds.push(run.runId);
    allItems.push(...run.items);
    if (run.error) errors.push(`${batch.key}: ${run.error}`);
    console.log(
      JSON.stringify({
        event: 'apify_naukri_jobs',
        batch: batch.key,
        actor: actorId,
        run_id: run.runId,
        apify_input: batch.input,
        input_label: batch.label,
        raw_items: run.items.length,
        error: run.error,
      }),
    );
  }

  const jobs = mergeNaukriJobs(
    apifyItemsToNaukriJobs(allItems, instant, fallbackHubUrl, { experienceSort: false }),
  );

  const job_urls = jobs
    .map((j) => j.apply_url ?? j.source_url)
    .filter((u): u is string => Boolean(u && u.includes('naukri.com')));

  return {
    naukri_provider: 'apify',
    jobs,
    job_urls,
    naukri_search_url: inputLabel,
    apify_naukri_run_id: runIds.join(',') || null,
    apify_naukri_count: jobs.length,
    apify_naukri_raw_count: allItems.length,
    apify_naukri_error:
      jobs.length > 0
        ? errors.length
          ? `Partial Apify run (${jobs.length} Vizag jobs): ${errors.join('; ')}`
          : null
        : errors.join('; ') || 'Naukri Apify actor returned no mappable jobs',
  };
}
