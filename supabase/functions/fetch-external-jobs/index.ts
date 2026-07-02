import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import {
  apifyErrorsBlockFirecrawlFallback,
  discoverLinkedInViaApify,
  getApifyToken,
  getApifyTokenForRole,
  getLinkedInContentSearchUrls,
  getLinkedInProvider,
  isApifyRentOrMissingError,
  linkedInApifyFallbackEnabled,
  linkedInApifyPostsFallbackEnabled,
  linkedInContentPostsLimit,
  resolvePostSearchQueries,
  shouldUseFirecrawlLinkedInPostsFallback,
  validateApifyEnvJsonSecrets,
} from './apify-linkedin.ts';
import {
  collectNaukriApifyRun,
  discoverNaukriViaApify,
  getApifyTokenForNaukri,
  getNaukriProvider,
  isNaukriVizagJob,
  NAUKRI_ASYNC_COLLECT_WAIT_MS,
  naukriApifyFallbackEnabled,
  startNaukriApifyRunAsync,
} from './apify-naukri.ts';
import {
  LINKEDIN_VIZAG_24H_CONTENT_URL,
  resolveLinkedInPostPreset,
  type ResolvedLinkedInPostPreset,
} from './linkedin-post-presets.ts';
import {
  channelLabel,
  type FetchChannel,
  getFirecrawlApiKeys,
  INDEED_SEARCH_QUERIES,
  parseFetchChannel,
  VIZAG_IT_SEARCH_QUERIES,
} from './fetch-channels.ts';
import {
  classifyJobRecord,
  normalizeJobCategory,
} from '../_shared/jobCategoryTaxonomy.ts';
import { isUsableCompanyName } from '../_shared/jobRecordInference.ts';
import {
  companyNameForSlug,
  sanitizeJobSeoRecord,
  sanitizeJsonLdJobPosting,
} from '../_shared/jobDisplayLabels.ts';
import {
  buildGeminiSeoEditorPrompt,
  buildGeminiSeoLinkedInPostPrompt,
  buildGeminiSeoSingleJobPrompt,
  extractSeoExtrasFromPayload,
  GEMINI_SEO_RESPONSE_SCHEMA,
  MAX_SEO_CUSTOM_INSTRUCTIONS_CHARS,
  type SeoGeminiPayload,
} from './gemini-seo-prompt.ts';

type RawHit = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
  content?: string;
};

type ExtractedJob = {
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
  /** Set when URL came from LinkedIn content search (past-24h feed). */
  from_linkedin_content_24h?: boolean;
  source_kind?: 'linkedin_post' | 'linkedin_job' | 'naukri';
  /** Full LinkedIn feed post text (hiring posts, not /jobs/view/). */
  linkedin_post_text?: string | null;
  needs_review?: boolean;
  is_likely_hiring_post?: boolean;
  linkedin_post_preset?: string | null;
  linkedin_post_preset_label?: string | null;
  category?: string | null;
};

type LinkedInContentPost = {
  post_text: string;
  post_url: string | null;
  author_hint: string | null;
  /** True when post text came from LinkedIn content search with datePosted=past-24h. */
  from_content_feed_24h?: boolean;
};

type FetchSummary = {
  total: number;
  with_posted_at_within_24h: number;
  without_usable_date: number;
  filtered_out_older_than_24h: number;
};

/** Matches `public.jobs` / admin `serializeJobForm` shape for import preview. */
type SiteJobRecord = {
  slug: string;
  title: string;
  company: string;
  location: string;
  category: string;
  job_type: string;
  work_mode: string | null;
  experience: string;
  is_fresher: boolean;
  salary: string | null;
  apply_link: string;
  short_description: string;
  description: string;
  responsibilities: string[];
  eligibility: string[];
  warning: string;
  posted_at: string | null;
  expires_at: string | null;
  source_name: string;
  source_url: string;
  skills: string[];
  company_logo_url: string | null;
  status: 'draft';
  is_featured: boolean;
  source_kind?: 'linkedin_post' | 'linkedin_job' | 'naukri';
  linkedin_post_text?: string | null;
  needs_review?: boolean;
  is_likely_hiring_post?: boolean;
  linkedin_post_preset?: string | null;
  linkedin_post_preset_label?: string | null;
  json_ld?: Record<string, unknown> | null;
  seo_meta?: {
    json_ld?: Record<string, unknown> | null;
    hashtags?: string[];
    keyword_density?: { keyword: string; count: number }[];
    gemini_model?: string;
    runtime_ms?: number;
    seo_profile?: string;
    had_custom_instructions?: boolean;
  } | null;
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-fetch-jobs-cron-secret, x-debug-session-id',
  'Access-Control-Max-Age': '86400',
};

const FIRECRAWL_SEARCH_URL = 'https://api.firecrawl.dev/v1/search';
const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v1/scrape';
const SCRAPFLY_SCRAPE_URL = 'https://api.scrapfly.io/scrape';
/** Only LinkedIn + Naukri (filtered again by hostname after search). */
/** Firecrawl searches aimed at single-job URLs (not city hubs). */
/** Fallback Firecrawl search when content-feed scrape yields few job links. */
const LINKEDIN_DETAIL_SEARCH_QUERIES = [
  'site:in.linkedin.com/jobs/view Visakhapatnam',
  'site:in.linkedin.com/jobs/view Vizag',
];

/** Web search for public LinkedIn posts (works when feed scrape is login-walled). */
const LINKEDIN_HIRING_SEARCH_QUERIES = [
  'site:linkedin.com/posts vizag hiring',
  'site:linkedin.com "Visakhapatnam" "hiring"',
  '"WE ARE HIRING" vizag site:linkedin.com',
  'site:linkedin.com feed update vizag jobs',
  'site:linkedin.com posts "jobs in vizag"',
];

const NAUKRI_DETAIL_SEARCH_QUERIES = [
  'site:www.naukri.com/job-listings Visakhapatnam',
  'site:www.naukri.com/job-listings Vizag',
  'site:www.naukri.com/job-listings "Visakhapatnam" developer',
  'site:www.naukri.com/job-listings Vizag IT',
  'site:www.naukri.com/job-listings Andhra Pradesh Visakhapatnam',
];

/** Naukri city hub — unfiltered fallback used only when the 24h hub returns nothing. */
const NAUKRI_VIZAG_HUB_URL = 'https://www.naukri.com/jobs-in-visakhapatnam';

/**
 * Naukri Vizag jobs feed filtered server-side to **last 24 hours** (`jobAge=1`),
 * Visakhapatnam city (`cityTypeGid=26`), active postings (`jobPostType=1`), and
 * the curated set of functional areas the operator wants. This is the primary
 * source for the Naukri channel — Naukri's own freshness filter is far more
 * accurate than parsing relative phrases out of detail-page markdown.
 */
const NAUKRI_VIZAG_24H_HUB_URL =
  'https://www.naukri.com/jobs-in-visakhapatnam?clusters=functionalAreaGid&functionAreaIdGid=1&functionAreaIdGid=2&functionAreaIdGid=3&functionAreaIdGid=5&functionAreaIdGid=6&functionAreaIdGid=7&functionAreaIdGid=8&functionAreaIdGid=11&functionAreaIdGid=13&functionAreaIdGid=14&functionAreaIdGid=18&functionAreaIdGid=24&functionAreaIdGid=25&functionAreaIdGid=36&functionAreaIdGid=37&cityTypeGid=26&jobPostType=1&jobAge=1';

/** Add `&pageNo=N` for paginating the Naukri Vizag 24h hub. Page 1 stays as-is. */
function naukriHubUrlForPage(baseUrl: string, page: number): string {
  if (page <= 1) {
    return baseUrl;
  }
  try {
    const u = new URL(baseUrl);
    u.searchParams.set('pageNo', String(page));
    return u.toString();
  } catch {
    return baseUrl;
  }
}

const DEFAULT_NAUKRI_SCRAPE_LIMIT = 12;

const DETAIL_SEARCH_QUERIES = [...LINKEDIN_DETAIL_SEARCH_QUERIES, ...NAUKRI_DETAIL_SEARCH_QUERIES];

/** LinkedIn Jobs SERP — Vishakhapatnam, past 24 hours (f_TPR=r86400). */
const LINKEDIN_VIZAG_24H_JOBS_LISTING_URL =
  'https://in.linkedin.com/jobs/jobs-in-vishakhapatnam?keywords=&location=Vishakhapatnam&geoId=106055329&distance=25&f_TPR=r86400&position=1&pageNum=0';

/** Extra keyword variants only when FETCH_LINKEDIN_CONTENT_KEYWORDS is set. */
const LINKEDIN_CONTENT_KEYWORDS = ['vizag'];

const DEFAULT_SEARCH_QUERIES = [
  ...DETAIL_SEARCH_QUERIES,
  'site:in.linkedin.com jobs Visakhapatnam',
  'site:www.naukri.com jobs-in-visakhapatnam',
];

const MAX_GEMINI_CHUNK_CHARS = 36_000;
/** Max listing URLs to fully scrape (full markdown beats SERP snippets for extracting individual roles). */
const DEFAULT_SCRAPE_PAGE_LIMIT = 10;
/** Max Gemini calls per request (each processes one chunk of pages). */
const DEFAULT_MAX_GEMINI_CHUNKS = 4;
const MS_24H = 24 * 60 * 60 * 1000;

function jsonResponse(body: unknown, status = 200): Response {
  let text: string;
  try {
    text = JSON.stringify(body);
  } catch {
    text = JSON.stringify({ ok: false, error: 'Response could not be serialized to JSON.' });
    status = 500;
  }
  return new Response(text, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Parse model JSON; tolerate ```json fences and truncated Gemini output. */
function tryParseJson<T>(text: string, label: string): T | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch (firstError) {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    if (fenced) {
      try {
        return JSON.parse(fenced) as T;
      } catch {
        /* fall through */
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    console.warn(
      JSON.stringify({
        event: 'json_parse_failed',
        label,
        message: firstError instanceof Error ? firstError.message : String(firstError),
        preview: trimmed.slice(0, 200),
      }),
    );
    return null;
  }
}

/** Close truncated Gemini JSON (common when maxOutputTokens cuts off mid-description). */
function tryRepairTruncatedJson(raw: string): string | null {
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = s.indexOf('{');
  if (start < 0) {
    return null;
  }
  s = s.slice(start);

  s = s.replace(/,\s*"[a-z_]+"\s*:\s*$/i, '');
  s = s.replace(/,\s*$/g, '');

  const quoteCount = (s.match(/"/g) ?? []).length;
  if (quoteCount % 2 === 1) {
    s += '"';
  }

  let depthBrace = 0;
  let depthBracket = 0;
  for (const ch of s) {
    if (ch === '{') {
      depthBrace += 1;
    } else if (ch === '}') {
      depthBrace -= 1;
    } else if (ch === '[') {
      depthBracket += 1;
    } else if (ch === ']') {
      depthBracket -= 1;
    }
  }
  while (depthBracket > 0) {
    s += ']';
    depthBracket -= 1;
  }
  while (depthBrace > 0) {
    s += '}';
    depthBrace -= 1;
  }

  try {
    JSON.parse(s);
    return s;
  } catch {
    return null;
  }
}

function unescapeJsonString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function extractJsonStringField(source: string, key: string): string | null {
  const strict = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 's');
  const strictMatch = source.match(strict);
  if (strictMatch?.[1]) {
    return unescapeJsonString(strictMatch[1]);
  }
  const loose = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"\\s*,\\s*"`, 'm');
  const looseMatch = source.match(loose);
  if (looseMatch?.[1]) {
    return unescapeJsonString(looseMatch[1]);
  }
  const lastField = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"\\s*\\}\\s*$`, 'm');
  const lastMatch = source.match(lastField);
  if (lastMatch?.[1]) {
    return unescapeJsonString(lastMatch[1]);
  }
  return null;
}

function extractJsonStringArray(source: string, key: string): string[] {
  const block = source.match(new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'm'))?.[1];
  if (!block?.trim()) {
    return [];
  }
  const items: string[] = [];
  for (const m of block.matchAll(/"((?:\\.|[^"\\])*)"/g)) {
    const item = unescapeJsonString(m[1] ?? '').trim();
    if (item) {
      items.push(item);
    }
  }
  return items;
}

function fillSeoPayloadFromFallback(payload: SeoGeminiPayload, fallback: SiteJobRecord): SeoGeminiPayload {
  const postBody = (fallback.linkedin_post_text ?? fallback.description ?? '').trim();
  const title =
    (typeof payload.title === 'string' && payload.title.trim()) || fallback.title?.trim() || 'Job opening';
  const short_description =
    (typeof payload.short_description === 'string' && payload.short_description.trim()) ||
    fallback.short_description?.trim() ||
    postBody.slice(0, 160);
  const description =
    (typeof payload.description === 'string' && payload.description.trim()) ||
    fallback.description?.trim() ||
    postBody.slice(0, 1_100);
  return {
    ...payload,
    title,
    short_description,
    description,
    responsibilities:
      normalizeSeoStringList(payload.responsibilities).length > 0
        ? normalizeSeoStringList(payload.responsibilities)
        : fallback.responsibilities ?? [],
    eligibility:
      normalizeSeoStringList(payload.eligibility).length > 0
        ? normalizeSeoStringList(payload.eligibility)
        : fallback.eligibility ?? [],
    skills:
      normalizeSeoStringList(payload.skills).length > 0
        ? normalizeSeoStringList(payload.skills)
        : fallback.skills ?? [],
  };
}

function parseSeoGeminiPayload(text: string, fallback: SiteJobRecord): SeoGeminiPayload {
  let parsed = tryParseJson<SeoGeminiPayload>(text, 'gemini_seo');
  if (parsed?.title?.trim()) {
    return fillSeoPayloadFromFallback(parsed, fallback);
  }

  const repaired = tryRepairTruncatedJson(text);
  if (repaired) {
    parsed = tryParseJson<SeoGeminiPayload>(repaired, 'gemini_seo_repaired');
    if (parsed?.title?.trim()) {
      return fillSeoPayloadFromFallback(parsed, fallback);
    }
  }

  const title = extractJsonStringField(text, 'title') ?? fallback.title;
  const short_description =
    extractJsonStringField(text, 'short_description') ?? fallback.short_description;
  const description = extractJsonStringField(text, 'description') ?? fallback.description;

  if (title.trim() && (short_description.trim() || description.trim())) {
    console.warn(
      JSON.stringify({
        event: 'gemini_seo_lenient_parse',
        preview: text.slice(0, 120),
      }),
    );
    return fillSeoPayloadFromFallback(
      {
        title,
        slug: extractJsonStringField(text, 'slug') ?? undefined,
        short_description,
        description,
        responsibilities: extractJsonStringArray(text, 'responsibilities'),
        eligibility: extractJsonStringArray(text, 'eligibility'),
        skills: extractJsonStringArray(text, 'skills'),
        category: extractJsonStringField(text, 'category') ?? undefined,
        company: extractJsonStringField(text, 'company') ?? undefined,
        job_type: extractJsonStringField(text, 'job_type') ?? undefined,
        work_mode: extractJsonStringField(text, 'work_mode') ?? undefined,
        experience: extractJsonStringField(text, 'experience') ?? undefined,
        is_fresher: extractJsonBooleanField(text, 'is_fresher'),
      },
      fallback,
    );
  }

  const postBody = (fallback.linkedin_post_text ?? fallback.description ?? '').trim();
  if (fallback.title?.trim() && postBody.length > 60) {
    console.warn(
      JSON.stringify({
        event: 'gemini_seo_fallback_from_post',
        title: fallback.title,
        post_chars: postBody.length,
      }),
    );
    return fillSeoPayloadFromFallback(
      {
        title: fallback.title,
        slug: extractJsonStringField(text, 'slug') ?? undefined,
        short_description: fallback.short_description ?? postBody.slice(0, 160),
        description: fallback.description ?? postBody.slice(0, 1_100),
      },
      fallback,
    );
  }

  throw new Error(
    'Gemini SEO returned invalid JSON. Retry once; if it persists, shorten the job description or linkedin_post_text before Make SEO.',
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePostedAt(value?: string | null): number | null {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const t = Date.parse(`${trimmed}T23:59:59.999+05:30`);
    return Number.isNaN(t) ? null : t;
  }
  const t = Date.parse(trimmed);
  return Number.isNaN(t) ? null : t;
}

function isLinkedInOrNaukriUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, '').toLowerCase();
    return h.endsWith('linkedin.com') || h.endsWith('naukri.com');
  } catch {
    return false;
  }
}

function isIndeedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase().includes('indeed.');
  } catch {
    return false;
  }
}

function looksLikeIndeedJobUrl(url: string): boolean {
  if (!isIndeedUrl(url)) {
    return false;
  }
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (/\/viewjob/i.test(path) || /\/rc\/clk/i.test(path)) {
      return true;
    }
    return u.searchParams.has('jk') || u.searchParams.has('vjk');
  } catch {
    return false;
  }
}

/** Real job posting detail URLs only (exclude city hub pages). */
function looksLikeIndividualJobApplyUrl(applyUrl: string | null | undefined): boolean {
  if (!applyUrl?.trim()) {
    return false;
  }
  try {
    const u = new URL(applyUrl.trim());
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const path = u.pathname;

    if (host.endsWith('linkedin.com')) {
      return /\/jobs\/view\//i.test(path);
    }
    if (host.endsWith('naukri.com')) {
      const low = path.toLowerCase();
      if (/^\/jobs-in-visakhapatnam\/?$/i.test(low)) {
        return false;
      }
      if (/^\/jobs-in-[^/]+\/?$/i.test(low) && !low.includes('job-listings')) {
        return false;
      }
      return low.includes('job-listings');
    }
    return false;
  } catch {
    return false;
  }
}

/** Per-source scrape slots when using single-channel or legacy combined fetch. */
function resolveDetailScrapeCaps(
  fetchChannel: string | null | undefined,
  sourceMode: 'linkedin' | 'naukri' | 'both',
  maxScrape: number,
): { linkedinCap: number; naukriCap: number; indeedCap: number } {
  if (fetchChannel === 'naukri') {
    return { linkedinCap: 0, naukriCap: maxScrape, indeedCap: 0 };
  }
  if (fetchChannel === 'linkedin_jobs' || fetchChannel === 'linkedin_posts') {
    return { linkedinCap: maxScrape, naukriCap: 0, indeedCap: 0 };
  }
  if (fetchChannel === 'indeed') {
    return { linkedinCap: 0, naukriCap: 0, indeedCap: maxScrape };
  }
  if (fetchChannel === 'vizag_it') {
    const linkedinCap = Math.max(3, Math.ceil(maxScrape * 0.5));
    return { linkedinCap, naukriCap: Math.max(0, maxScrape - linkedinCap), indeedCap: 0 };
  }
  if (!fetchChannel && sourceMode === 'both') {
    const linkedinCap = Math.max(4, Math.ceil(maxScrape * 0.6));
    return { linkedinCap, naukriCap: Math.max(0, maxScrape - linkedinCap), indeedCap: maxScrape };
  }
  if (sourceMode === 'naukri') {
    return { linkedinCap: 0, naukriCap: maxScrape, indeedCap: 0 };
  }
  if (sourceMode === 'linkedin') {
    return { linkedinCap: maxScrape, naukriCap: 0, indeedCap: 0 };
  }
  return { linkedinCap: maxScrape, naukriCap: maxScrape, indeedCap: maxScrape };
}

function humanizeSlugPart(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Normalize LinkedIn/Naukri URL slugs (unicode dashes, stray punctuation). */
function normalizeJobSlug(slug: string): string {
  return slug
    .replace(/[\u2010-\u2015\u2212\u00ad]/g, '-')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const PARSER_VERSION = 'site-record-v12-linkedin-seo-keys';

const DEFAULT_JOB_WARNING =
  'Verify job details on the employer site before sharing personal documents or payments. Never pay a fee to apply.';

function slugify(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function createJobSlug(title: string, company: string, postedAt?: string | null): string {
  const baseSlug =
    [title, company]
      .map(slugify)
      .filter(Boolean)
      .join('-') || 'vizag-job';
  const suffix = postedAt ? slugify(postedAt.split('T')[0]) : '';
  return suffix ? `${baseSlug}-${suffix}` : baseSlug;
}

/** SEO slug: role-jobs-vizag-company (no dates, lowercase, hyphens only). */
function createSeoJobSlug(title: string, company: string): string {
  const rolePart = slugify(
    title
      .replace(/\s*\|.*$/i, '')
      .replace(/\s+jobs?\s+in\s+vizag/gi, ' ')
      .replace(/\s+at\s+.+$/i, '')
      .replace(/\s*-\s*vizag\s*jobs.*$/i, '')
      .trim() || 'job',
  );
  const companyPart = companyNameForSlug(company) ? slugify(companyNameForSlug(company)) : '';
  return [rolePart, 'jobs', 'vizag', companyPart].filter(Boolean).join('-').replace(/-+/g, '-').slice(0, 140);
}

function normalizeSeoSlug(raw: string | undefined, title: string, company: string): string {
  if (typeof raw === 'string' && raw.trim()) {
    const cleaned = slugify(raw.trim().replace(/^\//, ''));
    if (cleaned.length > 8) {
      return cleaned.slice(0, 140);
    }
  }
  return createSeoJobSlug(title, company);
}

function inferSeoMainKeyword(record: SiteJobRecord): string {
  const role = record.title
    .replace(/job opening|job description/gi, '')
    .replace(/\s+jobs?\s+in\s+vizag.*/gi, '')
    .trim();
  const base = role || record.category || 'Job';
  if (record.is_fresher) {
    return `${base} Fresher Jobs in Vizag`;
  }
  const cat = (record.category ?? '').toLowerCase();
  if (cat.includes('it') || cat.includes('software') || cat.includes('tech')) {
    return `${base} Jobs in Vizag`;
  }
  return `${base} Jobs in Vizag`;
}

function inferSeoSupportingKeywords(record: SiteJobRecord): string[] {
  const keys = new Set<string>([
    'jobs in vizag',
    'latest jobs in vizag',
    'jobs in visakhapatnam',
  ]);
  if (record.is_fresher) {
    keys.add('fresher jobs in vizag');
    keys.add('jobs for freshers in visakhapatnam');
  }
  const cat = (record.category ?? '').toLowerCase();
  const titleLow = record.title.toLowerCase();
  if (cat.includes('it') || cat.includes('software') || titleLow.includes('developer') || titleLow.includes('engineer')) {
    keys.add('it jobs in vizag');
    keys.add('software jobs in vizag');
  }
  if (cat.includes('bpo') || titleLow.includes('bpo')) {
    keys.add('bpo jobs in vizag');
  }
  if (titleLow.includes('walk') || titleLow.includes('walk-in')) {
    keys.add('walkin jobs in vizag');
  }
  if (titleLow.includes('night')) {
    keys.add('night shift jobs in vizag');
  }
  if (record.company && record.company !== 'Unknown') {
    keys.add(`${record.company.toLowerCase()} jobs in vizag`);
  }
  keys.add('private jobs in vizag');
  return [...keys].slice(0, 8);
}

const GEMINI_SEO_INTERNAL_LINKS = [
  { label: 'Latest Jobs in Vizag', path: '/jobs-in-vizag' },
  { label: 'Fresher Jobs in Vizag', path: '/fresher-jobs-in-vizag' },
  { label: 'IT Jobs in Vizag', path: '/it-jobs-in-vizag' },
  { label: 'Part-time Jobs in Vizag', path: '/jobs/part-time' },
];

function parseRelativePostedAt(phrase: string | null | undefined, referenceIso: string): string | null {
  if (!phrase?.trim()) {
    return null;
  }
  const ref = new Date(referenceIso);
  if (Number.isNaN(ref.getTime())) {
    return null;
  }
  const low = phrase.trim().toLowerCase();
  const msDay = 86_400_000;

  if (/\bjust now\b|\btoday\b/i.test(low)) {
    return ref.toISOString();
  }
  if (/\byesterday\b/i.test(low)) {
    return new Date(ref.getTime() - msDay).toISOString();
  }

  // ORDER MATTERS: month/year before day/week, otherwise "1 month ago"
  // matches the day/week branch via the leading number on different patterns.
  const years = low.match(/(\d+)\s*(?:y|yr|yrs|years?)\s*ago/i);
  if (years) {
    return new Date(ref.getTime() - Number(years[1]) * 365 * msDay).toISOString();
  }
  const months = low.match(/(\d+)\s*(?:mo|mos|months?)\s*ago/i);
  if (months) {
    return new Date(ref.getTime() - Number(months[1]) * 30 * msDay).toISOString();
  }
  if (/\b30\+\s*days?\s*ago\b/i.test(low) || /\bover\s+a\s+month\s*ago\b/i.test(low)) {
    return new Date(ref.getTime() - 31 * msDay).toISOString();
  }

  const days = low.match(/(\d+)\s*days?\s*ago/i);
  if (days) {
    return new Date(ref.getTime() - Number(days[1]) * msDay).toISOString();
  }
  const weeks = low.match(/(\d+)\s*weeks?\s*ago/i);
  if (weeks) {
    return new Date(ref.getTime() - Number(weeks[1]) * 7 * msDay).toISOString();
  }
  if (/\b1\s*week\s*ago\b/i.test(low)) {
    return new Date(ref.getTime() - 7 * msDay).toISOString();
  }
  const hours = low.match(/(\d+)\s*hours?\s*ago/i);
  if (hours) {
    return new Date(ref.getTime() - Number(hours[1]) * 3_600_000).toISOString();
  }
  const minutes = low.match(/(\d+)\s*(?:m|min|mins|minutes?)\s*ago/i);
  if (minutes) {
    return new Date(ref.getTime() - Number(minutes[1]) * 60_000).toISOString();
  }
  const hoursShort = low.match(/^(\d+)\s*h$/);
  if (hoursShort) {
    return new Date(ref.getTime() - Number(hoursShort[1]) * 3_600_000).toISOString();
  }
  const daysShort = low.match(/^(\d+)\s*d$/);
  if (daysShort) {
    return new Date(ref.getTime() - Number(daysShort[1]) * msDay).toISOString();
  }
  return null;
}

/** Pull "2 hours ago", "1d", "3 weeks ago" from LinkedIn post body or search snippet. */
function extractPostedPhraseFromLinkedInPost(text: string): string | null {
  if (!text?.trim()) {
    return null;
  }
  const patterns = [
    /\b(\d+\s*(?:m|min|mins|minutes?)\s*ago)\b/i,
    /\b(\d+\s*(?:h|hr|hrs|hours?)\s*ago)\b/i,
    /\b(\d+\s*d(?:ays?)?\s*ago)\b/i,
    /\b(\d+\s*\+\s*weeks?\s*ago)\b/i,
    /\b(\d+\s*weeks?\s*ago)\b/i,
    /\b(\d+\s*days?\s*ago)\b/i,
    /\b(just\s+now|today|yesterday)\b/i,
    /\bposted\s+(today|yesterday|\d+\s+(?:hours?|days?|weeks?)\s+ago)\b/i,
    /\b(\d+[hd])\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function resolveLinkedInPostPostedAt(
  postText: string,
  referenceIso: string,
  fromContentFeed24h: boolean,
): string | null {
  const phrase = extractPostedPhraseFromLinkedInPost(postText);
  const parsed = parseRelativePostedAt(phrase, referenceIso);
  if (parsed) {
    return parsed;
  }
  if (fromContentFeed24h) {
    return referenceIso;
  }
  return null;
}

function isPostedWithinCutoff(postedAt: string | null | undefined, cutoffMs: number): boolean {
  const ts = parsePostedAt(postedAt ?? null);
  return ts !== null && ts >= cutoffMs;
}

const LINKEDIN_HIRING_SIGNAL_RE =
  /\b(we are hiring|we're hiring|#hiring|hiring now|urgent hiring|walk[- ]?in|walkin|job opening|vacancies|immediate hiring|hiring for|join our team)\b/i;
const LINKEDIN_JOB_DETAIL_SIGNAL_RE =
  /\b(position|designation|role|ctc|lpa|₹|lacs|experience|years experience|whatsapp|apply now|send cv|share cv|eligibility|interview)\b/i;

function looksLikeLinkedInHiringPost(text: string): boolean {
  if (!text || text.length < 80) {
    return false;
  }
  return LINKEDIN_HIRING_SIGNAL_RE.test(text) && LINKEDIN_JOB_DETAIL_SIGNAL_RE.test(text);
}

function mentionsVizagInPost(text: string): boolean {
  return /\b(vizag|visakhapatnam|vishakhapatnam)\b|#vizag|#visakhapatnam/i.test(text);
}

function shouldIncludeLinkedInContentPost(text: string): boolean {
  if (!text || text.length < 80) {
    return false;
  }
  // Past-24h Vizag content SERP: keep hiring posts and any job-related Vizag mention.
  const from24hFeed = (Deno.env.get('FETCH_LINKEDIN_CONTENT_24H') ?? 'true').toLowerCase() !== 'false';
  if (from24hFeed) {
    if (mentionsVizagInPost(text) && /\b(hiring|jobs?|vacanc|opening|recruit|apply|ctc|lpa|position|role)\b/i.test(text)) {
      return true;
    }
    if (looksLikeLinkedInHiringPost(text)) {
      return true;
    }
    return (
      text.length >= 100 &&
      /\b(hiring|walk[- ]?in|vacanc|opening|recruit|whatsapp|ctc|lpa)\b/i.test(text)
    );
  }
  if (!looksLikeLinkedInHiringPost(text)) {
    return false;
  }
  return mentionsVizagInPost(text);
}

function getLinkedInJobsListingUrl(): string {
  return Deno.env.get('FETCH_LINKEDIN_JOBS_LISTING_URL')?.trim() || LINKEDIN_VIZAG_24H_JOBS_LISTING_URL;
}

function linkedInJobsListingEnabled(): boolean {
  return (Deno.env.get('FETCH_LINKEDIN_JOBS_LISTING_24H') ?? 'true').toLowerCase() !== 'false';
}

/** Public jobs SERP with card titles (often visible without full login). */
function looksLikeLinkedInJobsListingMarkdown(md: string): boolean {
  if (!md || md.length < 350) {
    return false;
  }
  const hasLocation =
    /jobs in\s+vishakhapatnam|jobs in\s+visakhapatnam|jobs-in-vishakhapatnam|jobs-in-visakhapatnam/i.test(
      md,
    );
  const hasCards =
    /(?:^|\n)###\s+[^\n]+/m.test(md) ||
    /linkedin\.com\/jobs\/view\/\d{7,}/i.test(md);
  const hasRecency = /\d+\s+(?:hours?|minutes?|mins?|days?)\s+ago/i.test(md) || /f_TPR=r86400/i.test(md);
  return hasLocation && hasCards && hasRecency;
}

function isLinkedInLoginWallMarkdown(md: string): boolean {
  if (looksLikeLinkedInJobsListingMarkdown(md)) {
    return false;
  }
  if (!md || md.length > 2_500) {
    return false;
  }
  const low = md.toLowerCase();
  return (
    (/sign in|log in|join linkedin|authwall|login to view/i.test(low) &&
      !looksLikeLinkedInHiringPost(md)) ||
    (md.length < 120 && /linkedin/i.test(low))
  );
}

function normalizeLinkedInJobsViewUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const absolute = trimmed.startsWith('http')
    ? trimmed
    : `https://www.linkedin.com${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
  return normalizeExtractedJobUrl(absolute);
}

/**
 * Parse LinkedIn Jobs listing markdown (### title, #### company, "N hours ago").
 */
function parseLinkedInJobsListingMarkdown(
  md: string,
  listingUrl: string,
  scrapedAt: string,
): ExtractedJob[] {
  if (!looksLikeLinkedInJobsListingMarkdown(md)) {
    return [];
  }

  const maxJobs = Math.min(
    25,
    Math.max(5, Number(Deno.env.get('FETCH_LINKEDIN_JOBS_LISTING_LIMIT') ?? '20') || 20),
  );
  const jobs: ExtractedJob[] = [];
  const seen = new Set<string>();

  const pushJob = (partial: {
    title: string;
    company: string;
    location?: string | null;
    postedPhrase?: string | null;
    apply_url?: string | null;
    summary?: string | null;
  }) => {
    if (!isUsableJobTitle(partial.title)) {
      return;
    }
    const company = partial.company?.trim() || 'Unknown';
    const key = `${partial.title.toLowerCase()}|${company.toLowerCase()}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const applyUrl = partial.apply_url ? normalizeLinkedInJobsViewUrl(partial.apply_url) : null;
    const posted_at =
      parseRelativePostedAt(partial.postedPhrase ?? null, scrapedAt) ??
      parseRelativePostedAt(extractPostedPhraseFromLinkedInPost(partial.postedPhrase ?? ''), scrapedAt);
    const sourceUrl = applyUrl ?? listingUrl;
    jobs.push({
      title: partial.title.trim().slice(0, 160),
      company,
      experience: 'Not specified',
      location: partial.location?.trim() || 'Visakhapatnam / Vizag',
      apply_url: applyUrl ?? sourceUrl,
      source_url: sourceUrl,
      source_name: 'linkedin.com',
      posted_at: posted_at ?? scrapedAt,
      summary: partial.summary?.trim() ?? null,
      description_markdown: [
        `# ${partial.title.trim()}`,
        `**Company:** ${company}`,
        partial.location ? `**Location:** ${partial.location.trim()}` : '',
        partial.postedPhrase ? `**Posted:** ${partial.postedPhrase}` : '',
        partial.summary ?? '',
      ]
        .filter(Boolean)
        .join('\n'),
      scrape_chars: md.length,
      scraped_at: scrapedAt,
      from_linkedin_content_24h: true,
      source_kind: 'linkedin_job',
      needs_review: true,
      is_likely_hiring_post: false,
    });
    if (jobs.length >= maxJobs) {
      return;
    }
  };

  const linkCardRe =
    /\[([^\]]+)\]\((https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/jobs\/view\/\d{7,}[^)]*)\)/gi;
  for (const match of md.matchAll(linkCardRe)) {
    const title = stripMarkdownInline(match[1] ?? '');
    const apply_url = match[2] ?? '';
    const after = md.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + 900);
    const company = after.match(/(?:^|\n)####\s+(.+?)(?:\n|$)/)?.[1]?.trim();
    const location = after.match(
      /(?:^|\n)(Greater\s+Visakhapatnam[^.\n]*|Visakhapatnam[^.\n]*|Vishakhapatnam[^.\n]*|Pendurthi[^.\n]*|Visakhapatnam Rural[^.\n]*)/i,
    )?.[1]?.trim();
    const postedPhrase = after.match(/\b(\d+\s+(?:hours?|minutes?|mins?|days?)\s+ago)\b/i)?.[1];
    pushJob({
      title,
      company: company ?? 'Unknown',
      location,
      postedPhrase,
      apply_url,
    });
    if (jobs.length >= maxJobs) {
      return jobs;
    }
  }

  const sections = md.split(/\n(?=###\s+)/);
  for (const section of sections) {
    const title = section.match(/^###\s+(.+?)\s*$/m)?.[1]?.trim();
    if (!title || !isUsableJobTitle(title)) {
      continue;
    }
    const company = section.match(/^####\s+(.+?)\s*$/m)?.[1]?.trim() ?? 'Unknown';
    const location =
      section.match(
        /(?:^|\n)((?:Greater\s+)?Visakhapatnam[^.\n]*|Vishakhapatnam[^.\n]*|Pendurthi[^.\n]*|Visakhapatnam Rural[^.\n]*)/im,
      )?.[1]?.trim() ?? null;
    const postedPhrase =
      section.match(/\b(\d+\s+(?:hours?|minutes?|mins?|days?)\s+ago)\b/i)?.[1] ??
      section.match(/\b(just\s+now|today|yesterday)\b/i)?.[1];
    const viewInSection =
      section.match(/https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/jobs\/view\/\d{7,}[^\s"'<>)\]]*/i)?.[0] ??
      section.match(/\/jobs\/view\/\d{7,}[^\s"'<>)\]]*/i)?.[0];
    pushJob({
      title,
      company,
      location,
      postedPhrase,
      apply_url: viewInSection ?? undefined,
      summary: section.slice(0, 280).replace(/\s+/g, ' ').trim(),
    });
    if (jobs.length >= maxJobs) {
      break;
    }
  }

  return jobs;
}

async function discoverLinkedInJobsListing(
  firecrawlApiKeys: string[],
  budget?: FetchBudget,
  scrapedAt?: string,
): Promise<{
  url: string;
  jobs: ExtractedJob[];
  job_urls: string[];
  scrape_chars: number;
  login_wall: boolean;
}> {
  const url = getLinkedInJobsListingUrl();
  const empty = { url, jobs: [], job_urls: [], scrape_chars: 0, login_wall: false };

  if (!linkedInJobsListingEnabled()) {
    return empty;
  }
  if (budget && !budget.hasTime(25_000)) {
    return empty;
  }

  const instant = scrapedAt ?? new Date().toISOString();
  const md = await firecrawlScrapeUrl(url, firecrawlApiKeys, { linkedInJobsListing: true });
  const login_wall = isLinkedInLoginWallMarkdown(md) && !looksLikeLinkedInJobsListingMarkdown(md);

  if (login_wall || md.length < 200) {
    return { ...empty, scrape_chars: md.length, login_wall };
  }

  const jobs = parseLinkedInJobsListingMarkdown(md, url, instant);
  const job_urls = extractIndividualJobUrlsFromText(md);
  for (const job of jobs) {
    const apply = job.apply_url ?? '';
    if (apply.includes('/jobs/view/')) {
      const n = normalizeExtractedJobUrl(apply);
      if (n) {
        job_urls.push(n);
      }
    }
  }

  return {
    url,
    jobs,
    job_urls: [...new Set(job_urls)],
    scrape_chars: md.length,
    login_wall: false,
  };
}

function isLinkedInSearchResultUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (!host.endsWith('linkedin.com')) {
      return false;
    }
    const path = u.pathname.toLowerCase();
    if (path.includes('/search') || path.includes('/login') || path.includes('/authwall')) {
      return false;
    }
    return (
      path.includes('/posts/') ||
      path.includes('/feed/update/') ||
      path.includes('/jobs/view/') ||
      path.includes('/pulse/')
    );
  } catch {
    return false;
  }
}

function shouldIncludeLinkedInSearchHit(text: string, url: string): boolean {
  if (text.length < 50) {
    return false;
  }
  if (looksLikeLinkedInHiringPost(text)) {
    return shouldIncludeLinkedInContentPost(text) || mentionsVizagInPost(text);
  }
  if (isLinkedInSearchResultUrl(url) && /\/posts\//i.test(url)) {
    return (
      /\b(hiring|vacancy|opening|walk[- ]?in)\b/i.test(text) &&
      (mentionsVizagInPost(text) || /\b(jobs?|career)\b/i.test(text))
    );
  }
  return false;
}

function linkedInPostFromSearchHit(hit: RawHit): LinkedInContentPost | null {
  const url = hit.url?.trim() ?? '';
  if (!url || !isLinkedInSearchResultUrl(url)) {
    return null;
  }
  const blob = [hit.title, hit.description, hit.markdown, hit.content]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join('\n\n')
    .trim();
  if (!shouldIncludeLinkedInSearchHit(blob, url)) {
    return null;
  }
  const postUrl = url.match(/linkedin\.com\/(?:posts\/|feed\/update\/)/i) ? url : null;
  return {
    post_text: blob,
    post_url: postUrl,
    author_hint: hit.title?.trim() ?? null,
  };
}

function mergeLinkedInPosts(posts: LinkedInContentPost[], more: LinkedInContentPost[]): LinkedInContentPost[] {
  const seen = new Set(posts.map((p) => (p.post_url ?? p.post_text.slice(0, 200)).toLowerCase()));
  const out = [...posts];
  for (const post of more) {
    const key = (post.post_url ?? post.post_text.slice(0, 200)).toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(post);
  }
  return out;
}

function isInvalidApplyToken(value: string | null | undefined): boolean {
  if (!value?.trim()) {
    return true;
  }
  return /^(null|undefined|none|n\/a|na)$/i.test(value.trim());
}

/** Gemini sometimes returns the literal string "null" for apply_url — never use that as a dedupe key. */
function resolveApplyLinkForJob(
  applyUrl: string | null | undefined,
  sourceUrl: string | null | undefined,
  postText?: string | null,
): string {
  const apply = applyUrl?.trim() ?? '';
  if (apply && !isInvalidApplyToken(apply)) {
    if (/^https?:\/\//i.test(apply) || /^mailto:/i.test(apply)) {
      return apply;
    }
    if (apply.includes('@') && apply.includes('.')) {
      return apply.startsWith('mailto:') ? apply : `mailto:${apply}`;
    }
    return apply;
  }
  const parsed = postText?.trim() ? parseLinkedInHiringPost(postText) : {};
  if (parsed.apply_url?.trim()) {
    return parsed.apply_url.trim();
  }
  const src = sourceUrl?.trim() ?? '';
  return src || '';
}

function siteJobDedupeKey(job: SiteJobRecord): string {
  const applyOrSource = resolveApplyLinkForJob(job.apply_link, job.source_url, job.linkedin_post_text);
  if (applyOrSource && !/^mailto:$/i.test(applyOrSource)) {
    return applyOrSource.toLowerCase();
  }
  if (job.source_kind === 'linkedin_post') {
    const postUrl = job.source_url?.trim();
    if (postUrl && postUrl.includes('linkedin.com')) {
      return postUrl.toLowerCase();
    }
    const snippet = job.linkedin_post_text?.trim().slice(0, 220) ?? '';
    if (snippet) {
      return `li-post:${snippet.toLowerCase()}`;
    }
  }
  if (job.source_url?.trim()) {
    return job.source_url.trim().toLowerCase();
  }
  return job.slug.toLowerCase();
}

function normalizeWhatsAppApplyLink(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) {
    return null;
  }
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}

function parseLinkedInHiringPost(text: string): Partial<ExtractedJob> {
  const clean = stripMarkdownBlocks(text).trim();

  let title = 'Job opening';
  const positionMatch = clean.match(
    /(?:Position|Designation|Role)\s*[:：]\s*([^\n#🏢💰🎯📲|]+)/i,
  );
  const hiringPipe = clean.match(
    /(?:WE ARE HIRING|WE'RE HIRING|HIRING)\s*\|\s*([^|\n#]+)/i,
  );
  if (positionMatch?.[1]?.trim() && isUsableJobTitle(positionMatch[1].trim())) {
    title = positionMatch[1].trim().slice(0, 160);
  } else if (hiringPipe?.[1]?.trim() && isUsableJobTitle(hiringPipe[1].trim())) {
    title = hiringPipe[1].trim().slice(0, 160);
  }

  let company = 'Unknown';
  const emojiCompany = clean.match(/🏢\s*([^\n]+)/)?.[1]?.trim();
  const leadingCo = clean.match(
    /(?:^|\n)\s*(?:Leading|Top|Renowned|MNC)\s+([^\n#🏢]+)/im,
  )?.[1]?.trim();
  if (emojiCompany && isUsableCompanyName(emojiCompany)) {
    company = emojiCompany.slice(0, 120);
  } else if (leadingCo && isUsableCompanyName(leadingCo)) {
    company = leadingCo.slice(0, 120);
  }

  let salary: string | null = null;
  const ctcLine = clean.match(/CTC\s*[:：]\s*([^\n#🏢]+)/i)?.[1]?.trim();
  if (ctcLine) {
    salary = ctcLine.slice(0, 80);
  } else {
    const lac = clean.match(/(₹\s*[\d.,]+\s*(?:LPA|Lacs?(?:\s*PA)?))/i)?.[1];
    if (lac) {
      salary = lac.trim();
    }
  }

  let experience = 'Not specified';
  const expRange = clean.match(/(\d+\s*[–-]\s*\d+)\s*Years?\s+(?:of\s+)?Experience/i);
  const expSingle = clean.match(/(\d+)\s*\+?\s*Years?\s+(?:of\s+)?Experience/i);
  if (expRange?.[1]) {
    experience = `${expRange[1].replace(/\s+/g, ' ')} years`;
  } else if (expSingle?.[1]) {
    experience = `${expSingle[1]} years`;
  }

  const hashtagLocs = [...clean.matchAll(/#([A-Za-z][A-Za-z0-9_]{2,30})/g)]
    .map((m) => m[1])
    .filter((tag) => !/^(hiring|jobs|jobopening|applynow|career|immediatehiring)$/i.test(tag));
  const locParts: string[] = [];
  if (mentionsVizagInPost(clean)) {
    locParts.push('Visakhapatnam / Vizag');
  }
  for (const tag of hashtagLocs.slice(0, 6)) {
    if (/vizag|visakhapatnam/i.test(tag)) {
      continue;
    }
    locParts.push(humanizeSlugPart(tag.replace(/_/g, '-')));
  }
  const location = locParts.length > 0 ? [...new Set(locParts)].join(', ') : 'Visakhapatnam / Vizag';

  let apply_url: string | null = null;
  const waLine = clean.match(/(?:WhatsApp|WA)\s*(?:CV)?\s*[:：]?\s*([+\d][\d\s-]{8,16})/i);
  if (waLine?.[1]) {
    apply_url = normalizeWhatsAppApplyLink(waLine[1]);
  }
  const linkMatch = clean.match(
    /https?:\/\/(?:lnkd\.in|linkedin\.com|wa\.me)[^\s"'<>)\]]+/i,
  );
  if (!apply_url && linkMatch?.[0]) {
    apply_url = linkMatch[0];
  }

  const postUrl = clean.match(
    /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/(?:posts\/|feed\/update\/)[^\s"'<>)\]]+/i,
  )?.[0];

  return {
    title,
    company,
    experience,
    location,
    apply_url,
    source_url: postUrl ?? null,
    source_name: 'linkedin.com',
    summary: clean.slice(0, 400),
    description_markdown: clean,
  };
}

function splitContentMarkdownIntoPostBlocks(md: string): string[] {
  const blocks: string[] = [];
  const seen = new Set<string>();

  const pushBlock = (raw: string) => {
    const text = stripMarkdownBlocks(raw).trim();
    if (text.length < 80 || text.length > 14_000) {
      return;
    }
    const key = text.slice(0, 200).toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    blocks.push(text);
  };

  const byActivity = md.split(
    /(?=https?:\/\/[^\s]*linkedin\.com\/(?:posts\/|feed\/update\/))/gi,
  );
  for (const part of byActivity) {
    pushBlock(part);
  }

  const byHeading = md.split(/\n(?=##\s+(?!Job description|Similar jobs|Jobs you might))/i);
  for (const part of byHeading) {
    pushBlock(part);
  }

  if (blocks.length < 3) {
    for (const para of md.split(/\n{2,}/)) {
      pushBlock(para);
    }
  }

  return blocks;
}

function extractLinkedInPostsFromContentMarkdown(md: string): LinkedInContentPost[] {
  if (!md || md.length < 100) {
    return [];
  }
  if ((Deno.env.get('FETCH_LINKEDIN_CONTENT_POSTS') ?? 'true').toLowerCase() === 'false') {
    return [];
  }

  const posts: LinkedInContentPost[] = [];
  const seen = new Set<string>();

  for (const block of splitContentMarkdownIntoPostBlocks(md)) {
    if (!shouldIncludeLinkedInContentPost(block)) {
      continue;
    }
    const postUrl =
      block.match(
        /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/(?:posts\/|feed\/update\/)[^\s"'<>)\]]+/i,
      )?.[0] ?? null;
    const key = (postUrl ?? block.slice(0, 200)).toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    posts.push({
      post_text: block,
      post_url: postUrl,
      author_hint: block.match(/^##\s+(.+)/m)?.[1]?.trim() ?? null,
      from_content_feed_24h: true,
    });
  }

  return posts;
}

function linkedInPostToExtractedJob(
  post: LinkedInContentPost,
  scrapedAt: string,
  fallbackSearchUrl: string,
): ExtractedJob {
  const parsed = parseLinkedInHiringPost(post.post_text);
  const sourceUrl = post.post_url ?? parsed.source_url ?? fallbackSearchUrl;
  const applyUrl = parsed.apply_url ?? post.post_url ?? sourceUrl;
  const fromFeed24h = post.from_content_feed_24h === true;
  const posted_at = resolveLinkedInPostPostedAt(post.post_text, scrapedAt, fromFeed24h);

  return {
    title: parsed.title ?? 'Job opening',
    company: parsed.company ?? 'Unknown',
    experience: parsed.experience ?? 'Not specified',
    location: parsed.location ?? 'Visakhapatnam / Vizag',
    apply_url: applyUrl,
    source_url: sourceUrl,
    source_name: 'linkedin.com',
    posted_at,
    summary: parsed.summary ?? post.post_text.slice(0, 400),
    description_markdown: post.post_text,
    scrape_chars: post.post_text.length,
    scraped_at: scrapedAt,
    from_linkedin_content_24h: fromFeed24h,
    source_kind: 'linkedin_post',
    linkedin_post_text: post.post_text,
    needs_review: true,
    is_likely_hiring_post: true,
  };
}

function linkedinParseWithGeminiEnabled(): boolean {
  return (Deno.env.get('FETCH_LINKEDIN_PARSE_WITH_GEMINI') ?? 'true').toLowerCase() !== 'false';
}

function linkedinSearchFallbackEnabled(): boolean {
  return Deno.env.get('FETCH_LINKEDIN_SEARCH_POSTS')?.trim().toLowerCase() === 'true';
}

function defaultLinkedInContentPostsLimit(): number {
  return linkedInContentPostsLimit();
}

async function geminiParseLinkedInPostBatch(
  posts: LinkedInContentPost[],
  apiKey: string,
  referenceTimeUtc: string,
  fallbackSearchUrl: string,
  scrapedAt: string,
  indexOffset: number,
): Promise<ExtractedJob[]> {
  const items = posts.map((p, i) => ({
    index: indexOffset + i,
    post_url: p.post_url,
    from_past_24h_feed: p.from_content_feed_24h === true,
    text: p.post_text.slice(0, 6_000),
  }));

  const instruction =
    `Parse LinkedIn feed posts from a Visakhapatnam (Vizag) content search (past 24 hours).\n` +
    `REFERENCE_TIME_UTC: ${referenceTimeUtc}\n\n` +
    `For each post return ONE job object with:\n` +
    `- title: role name only (not "Job opening")\n` +
    `- company: employer; "Unknown" if missing\n` +
    `- experience, location (emphasize Vizag when post lists many cities)\n` +
    `- salary: CTC/LPA text if present, else null\n` +
    `- summary: one line with skills and apply method (WhatsApp/phone/link)\n` +
    `- apply_url: HTTPS post URL when given, else null\n` +
    `- posted_at: ISO 8601 UTC from relative age in text, or REFERENCE_TIME when from_past_24h_feed is true and no age is visible\n` +
    `Omit posts that are not job/hiring related.\n\n` +
    `POSTS_JSON:\n${JSON.stringify(items)}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: instruction }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          jobs: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                index: { type: 'NUMBER' },
                title: { type: 'STRING' },
                company: { type: 'STRING' },
                experience: { type: 'STRING' },
                location: { type: 'STRING' },
                salary: { type: 'STRING' },
                summary: { type: 'STRING' },
                apply_url: { type: 'STRING' },
                posted_at: { type: 'STRING' },
              },
              required: ['index', 'title', 'company'],
            },
          },
        },
        required: ['jobs'],
      },
    },
  };

  const payload = await geminiGenerateContent(body, apiKey, 'Gemini LinkedIn posts');
  const candidates = payload.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  const text = candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) {
    return [];
  }

  const parsed = tryParseJson<{
    jobs?: Array<{
      index?: number;
      title?: string;
      company?: string;
      experience?: string;
      location?: string;
      salary?: string;
      summary?: string;
      apply_url?: string;
      posted_at?: string;
    }>;
  }>(text, 'gemini_linkedin_posts');
  if (!parsed) {
    return [];
  }
  const rows = Array.isArray(parsed.jobs) ? parsed.jobs : [];
  const out: ExtractedJob[] = [];

  for (const row of rows) {
    const idx = typeof row.index === 'number' ? row.index - indexOffset : -1;
    if (idx < 0 || idx >= posts.length) {
      continue;
    }
    const post = posts[idx]!;
    const title = typeof row.title === 'string' && row.title.trim() ? row.title.trim() : null;
    if (!title || /^job opening$/i.test(title)) {
      continue;
    }
    const fromFeed24h = post.from_content_feed_24h === true;
    const posted_at =
      (typeof row.posted_at === 'string' && row.posted_at.trim()
        ? row.posted_at.trim()
        : null) ?? resolveLinkedInPostPostedAt(post.post_text, scrapedAt, fromFeed24h);
    const sourceUrl = post.post_url ?? fallbackSearchUrl;
    const applyRaw = typeof row.apply_url === 'string' ? row.apply_url.trim() : '';
    const applyUrl = resolveApplyLinkForJob(applyRaw, post.post_url ?? sourceUrl, post.post_text);
    const salary = typeof row.salary === 'string' && row.salary.trim() ? row.salary.trim() : null;

    out.push({
      title,
      company: typeof row.company === 'string' && row.company.trim() ? row.company.trim() : 'Unknown',
      experience:
        typeof row.experience === 'string' && row.experience.trim()
          ? row.experience.trim()
          : 'Not specified',
      location:
        typeof row.location === 'string' && row.location.trim()
          ? row.location.trim()
          : 'Visakhapatnam / Vizag',
      apply_url: applyUrl,
      source_url: sourceUrl,
      source_name: 'linkedin.com',
      posted_at,
      summary:
        [typeof row.summary === 'string' ? row.summary.trim() : '', salary].filter(Boolean).join(' · ') ||
        post.post_text.slice(0, 400),
      description_markdown: post.post_text,
      scrape_chars: post.post_text.length,
      scraped_at: scrapedAt,
      from_linkedin_content_24h: fromFeed24h,
      source_kind: 'linkedin_post',
      linkedin_post_text: post.post_text,
      needs_review: true,
      is_likely_hiring_post: true,
    });
  }

  return out;
}

async function geminiParseLinkedInPosts(
  posts: LinkedInContentPost[],
  referenceTimeUtc: string,
  fallbackSearchUrl: string,
  scrapedAt: string,
): Promise<ExtractedJob[]> {
  const keys = getGeminiApiKeys('linkedin_posts');
  if (keys.length === 0 || posts.length === 0) {
    return [];
  }
  const apiKey = keys[0]!;
  const limit = Math.min(defaultLinkedInContentPostsLimit(), posts.length);
  const slice = posts.slice(0, limit);
  const batchSize = Math.min(5, Math.max(2, Number(Deno.env.get('FETCH_LINKEDIN_GEMINI_BATCH_SIZE') ?? '5') || 5));
  const results: ExtractedJob[] = [];

  for (let i = 0; i < slice.length; i += batchSize) {
    const batch = slice.slice(i, i + batchSize);
    const batchJobs = await geminiParseLinkedInPostBatch(
      batch,
      apiKey,
      referenceTimeUtc,
      fallbackSearchUrl,
      scrapedAt,
      i,
    );
    results.push(...batchJobs);
  }

  return results;
}

function applyLinkedInPostPresetToJobs(
  jobs: ExtractedJob[],
  preset: ResolvedLinkedInPostPreset,
): ExtractedJob[] {
  return jobs.map((job) => ({
    ...job,
    linkedin_post_preset: preset.id,
    linkedin_post_preset_label: preset.label,
    category: preset.categoryDefault,
  }));
}

async function convertLinkedInPostsToJobs(
  posts: LinkedInContentPost[],
  fetchInstant: string,
  fallbackSearchUrl: string,
  cutoffMs: number,
): Promise<{ jobs: ExtractedJob[]; parse_mode: 'gemini' | 'regex' }> {
  if (posts.length === 0) {
    return { jobs: [], parse_mode: 'regex' };
  }

  if (linkedinParseWithGeminiEnabled() && getGeminiApiKeys('linkedin_posts').length > 0) {
    try {
      const geminiJobs = await geminiParseLinkedInPosts(posts, fetchInstant, fallbackSearchUrl, fetchInstant);
      if (geminiJobs.length > 0) {
        const within24h = geminiJobs.filter((j) => isPostedWithinCutoff(j.posted_at, cutoffMs));
        const coveredUrls = new Set(
          within24h.map((j) => (j.source_url ?? '').trim().toLowerCase()).filter(Boolean),
        );
        const regexExtras = posts
          .map((post) => linkedInPostToExtractedJob(post, fetchInstant, fallbackSearchUrl))
          .filter((j) => {
            const key = (j.source_url ?? '').trim().toLowerCase();
            return isPostedWithinCutoff(j.posted_at, cutoffMs) && key && !coveredUrls.has(key);
          });
        return {
          jobs: dedupeJobs([...within24h, ...regexExtras]),
          parse_mode: 'gemini',
        };
      }
    } catch (e) {
      console.warn(
        JSON.stringify({
          event: 'linkedin_gemini_parse_fallback',
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  }

  return {
    jobs: posts
      .map((post) => linkedInPostToExtractedJob(post, fetchInstant, fallbackSearchUrl))
      .filter((j) => isPostedWithinCutoff(j.posted_at, cutoffMs)),
    parse_mode: 'regex',
  };
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkdownBlocks(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractMarkdownSection(md: string, heading: string): string {
  const pattern = new RegExp(
    `##\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
    'i',
  );
  const match = md.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function extractPostedPhrase(md: string, summary: string | null | undefined): string | null {
  const jobBlock = md.split(/##\s*Job description/i)[1]?.slice(0, 4_000) ?? md.slice(0, 4_000);
  const blob = `${jobBlock}\n${summary ?? ''}`;
  const posted =
    blob
      .match(/Posted:\s*([^O\n]+?)(?:Openings:|Applicants:|Register to apply|Continue with|$)/i)?.[1]
      ?.replace(/Openings$/i, '')
      .trim() ??
    // Explicit "Posted: <phrase>" — covers month/year wording Naukri actually uses.
    blob
      .match(
        /\bPosted:\s*(\d+\s+(?:hours?|days?|weeks?|months?|mos?|years?|yrs?|y)\s+ago|just\s+now|today|yesterday|\d+\s*[hd]|over\s+a\s+month\s+ago|30\+\s+days?\s+ago)\b/i,
      )
      ?.[1]
      ?.trim() ??
    blob.match(/\b(\d+\s*(?:mo|mos|months?|y|yr|yrs|years?)\s*ago)\b/i)?.[1]?.trim() ??
    blob.match(/\b(\d+\s*(?:m|min|mins|minutes?|h|hr|hrs|hours?)\s*ago)\b/i)?.[1]?.trim() ??
    blob
      .match(
        /\b(Just\s+now|Today|Yesterday|\d+\s*days?\s*ago|\d+\s*weeks?\s*ago|over\s+a\s+month\s+ago|30\+\s*days?\s*ago)\b/i,
      )
      ?.[1]
      ?.trim();
  return posted ?? null;
}

function isNaukriSearchResultsMarkdown(md: string): boolean {
  if (!md || md.length < 200) {
    return false;
  }
  return (
    /#\s+[^#\n]+\s+Jobs\s+In\s+Visakhapatnam/i.test(md) ||
    /\b1\s*-\s*\d+\s+of\s+\d+\b/i.test(md) ||
    /Job you are looking for is expired/i.test(md) ||
    /Apply to \d+ .+ Jobs In Visakhapatnam/i.test(md) ||
    (/All Filters/i.test(md) && /Freshness/i.test(md) && !/##\s*Job description/i.test(md))
  );
}

function isNaukriJobDetailMarkdown(md: string): boolean {
  return md.length > 200 && /##\s*Job description/i.test(md) && !isNaukriSearchResultsMarkdown(md);
}

function getFetchSourcesMode(): 'linkedin' | 'naukri' | 'both' {
  const raw = Deno.env.get('FETCH_JOB_SOURCES')?.trim().toLowerCase();
  if (raw === 'linkedin' || raw === 'naukri' || raw === 'both') {
    return raw;
  }
  return 'both';
}

function inferCategory(md: string): string {
  const department = md.match(/Department:\s*\[([^\]]+)\]/i)?.[1]?.trim();
  if (department) {
    return department;
  }
  const industry = md.match(/Industry Type:\s*\[([^\]]+)\]/i)?.[1]?.trim();
  if (industry) {
    return industry;
  }
  const roleCategory = md.match(/Role Category:\s*([^\n]+)/i)?.[1]?.trim();
  if (roleCategory) {
    return roleCategory;
  }
  return 'General';
}

function inferJobType(md: string): string {
  const employment = md.match(/Employment Type:\s*([^\n]+)/i)?.[1]?.trim();
  if (!employment) {
    return 'Full-time';
  }
  const low = employment.toLowerCase();
  if (low.includes('part')) {
    return 'Part-time';
  }
  if (low.includes('intern')) {
    return 'Internship';
  }
  if (low.includes('contract')) {
    return 'Contract';
  }
  return 'Full-time';
}

function inferWorkMode(md: string): string | null {
  const low = md.toLowerCase();
  if (/work location assignment:\s*on premise|on-site|on site\b/i.test(low)) {
    return 'On-site';
  }
  if (/\bhybrid\b/i.test(low)) {
    return 'Hybrid';
  }
  if (/\bremote\b|work from home|\bwfh\b/i.test(low)) {
    return 'Remote';
  }
  return null;
}

function extractNaukriSalary(md: string): string | null {
  const lacs = md.match(/(\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?)\s*Lacs?\s*P\.?A\.?/i);
  if (lacs) {
    return `${lacs[1].replace(/\s+/g, '')} LPA`;
  }
  const singleLac = md.match(/(\d+(?:\.\d+)?)\s*Lacs?\s*P\.?A\.?/i);
  if (singleLac) {
    return `${singleLac[1]} LPA`;
  }
  if (/\bNot Disclosed\b/i.test(md)) {
    return 'Not disclosed';
  }
  return null;
}

function extractNaukriSkills(md: string): string[] {
  const section =
    extractMarkdownSection(md, 'Key Skills') ||
    md.split(/##\s*Key Skills/i)[1]?.split(/\n##\s/)[0] ||
    '';
  const skills = new Set<string>();
  for (const match of section.matchAll(/\[([^\]]+)\]\(https:\/\/www\.naukri\.com\/[^)]+\)/gi)) {
    const skill = match[1]?.trim();
    if (skill && skill.length >= 2 && skill.length <= 60) {
      skills.add(skill);
    }
  }
  return [...skills].slice(0, 24);
}

function extractBulletPoints(block: string, max = 14): string[] {
  const lines = block.split(/\n/);
  const bullets: string[] = [];
  for (const line of lines) {
    const trimmed = line.replace(/^[-*•]\s+/, '').trim();
    if (trimmed.length >= 12 && trimmed.length <= 400 && !/^https?:\/\//i.test(trimmed)) {
      bullets.push(stripMarkdownInline(trimmed));
    }
  }
  return bullets.slice(0, max);
}

function extractNaukriEligibility(md: string): string[] {
  const items: string[] = [];
  const ug = md.match(/UG:\s*([^\n]+)/i)?.[1]?.trim();
  const pg = md.match(/PG:\s*([^\n]+)/i)?.[1]?.trim();
  if (ug) {
    items.push(`UG: ${ug}`);
  }
  if (pg) {
    items.push(`PG: ${pg}`);
  }
  const eduBlock = md.match(/Education\s*\n+([\s\S]*?)(?=\nread more|\nKey Skills|\n##\s)/i)?.[1];
  if (eduBlock) {
    for (const line of eduBlock.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && trimmed.length <= 120 && !/^education$/i.test(trimmed)) {
        items.push(stripMarkdownInline(trimmed));
      }
    }
  }
  return [...new Set(items)].slice(0, 10);
}

function buildNaukriDescription(md: string): string {
  let body = extractMarkdownSection(md, 'Job description');
  if (!body) {
    const idx = md.indexOf('## Job description');
    body = idx >= 0 ? md.slice(idx + '## Job description'.length) : md;
  }
  body =
    body.split(
      /\n(?:Role:|Key Skills|## Jobs you might be interested|## Similar jobs|## Pfizer|## TATA|## Paytm|Beware of imposters)/i,
    )[0] ?? body;
  return stripMarkdownBlocks(body).slice(0, 12_000);
}

function extractCompanyLogoUrl(md: string): string | null {
  const match =
    md.match(/!\[[^\]]*Company Logo[^\]]*\]\((https:\/\/img\.naukimg\.com[^)]+)\)/i) ??
    md.match(/!\[[^\]]*\]\((https:\/\/img\.naukimg\.com\/logo_images[^)]+)\)/i);
  return match?.[1] ?? null;
}

function cleanCompanyName(company: string, md: string): string {
  const postedBy = md.match(/\[Posted by ([^\]]+)\]/i)?.[1]?.trim();
  if (postedBy) {
    return postedBy;
  }
  let name = company.trim();
  if (/^posted by\s+/i.test(name)) {
    name = name.replace(/^posted by\s+/i, '').trim();
  }
  if (name.length > 80) {
    const linkName = md.match(
      /\[([^\]]{2,80})\]\(https:\/\/www\.naukri\.com\/(?!naukri)[a-z0-9-]+-jobs-careers/gi,
    )?.[1];
    if (linkName && isUsableCompanyName(linkName)) {
      return linkName.trim();
    }
  }
  return name || 'Unknown';
}

function inferDisplayTitle(raw: ExtractedJob, md: string): string {
  const role = md.match(/Role:\s*\[([^\]]{2,160})\]/i)?.[1]?.trim();
  if (role && isUsableJobTitle(role)) {
    return role;
  }
  const designation =
    md.match(/\*\*Designation:\*\*\s*([^\n*]+)/i)?.[1]?.trim() ||
    md.match(/Designation\s*:\s*([^\n]+)/i)?.[1]?.trim();
  if (designation && isUsableJobTitle(designation)) {
    return designation;
  }
  return raw.title;
}

function inferIsFresher(experience: string, title: string, md: string): boolean {
  const exp = experience.toLowerCase();
  if (
    /^0\s*[-–]/.test(exp) ||
    /\bfresher\b/i.test(exp) ||
    /^0\s+to\s+/i.test(exp) ||
    /\b0\s*(?:yr|yrs|year|years)\b/i.test(exp) ||
    /\bentry[\s-]?level\b/i.test(exp) ||
    /\btrainee\b/i.test(exp) ||
    /\bintern(?:ship)?\b/i.test(exp)
  ) {
    return true;
  }
  if (/\bfresher\b|\btrainee\b|\bintern\b/i.test(title)) {
    return true;
  }
  const ug = md.match(/UG:\s*([^\n]+)/i)?.[1]?.toLowerCase() ?? '';
  if (ug.includes('2024') || ug.includes('2025 pass')) {
    return true;
  }
  return false;
}

function isBoilerplateSummary(summary: string | null | undefined): boolean {
  if (!summary?.trim()) {
    return true;
  }
  return (
    summary.includes('Naukri Logo') ||
    summary.includes('Search jobs here') ||
    summary.includes('For employers') ||
    summary.length < 50
  );
}

function buildShortDescription(description: string, title: string): string {
  const plain = description.replace(/\n+/g, ' ').trim();
  if (!plain) {
    return title;
  }
  if (plain.length <= 280) {
    return plain;
  }
  const cut = plain.slice(0, 280);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 120 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function extractLinkedInPostSalary(text: string): string | null {
  const ctc = text.match(/CTC\s*[:：]\s*([^\n#🏢]+)/i)?.[1]?.trim();
  if (ctc) {
    return ctc.slice(0, 80);
  }
  const lac = text.match(/(₹\s*[\d.,]+\s*(?:LPA|Lacs?(?:\s*PA)?))/i)?.[1];
  return lac?.trim() ?? null;
}

function toSiteJobRecord(raw: ExtractedJob, referenceIso: string): SiteJobRecord {
  const md = raw.description_markdown ?? raw.linkedin_post_text ?? '';
  const isLinkedInPost = raw.source_kind === 'linkedin_post';
  const parsedPost = isLinkedInPost && md ? parseLinkedInHiringPost(md) : null;

  let title = inferDisplayTitle(raw, md);
  if (isLinkedInPost && parsedPost?.title && isUsableJobTitle(parsedPost.title)) {
    title = parsedPost.title;
  }
  let company = cleanCompanyName(raw.company, md);
  if (isLinkedInPost && parsedPost?.company && isUsableCompanyName(parsedPost.company)) {
    company = parsedPost.company;
  }
  const postedPhrase = extractPostedPhrase(md, raw.summary);
  const postedAt =
    raw.posted_at ??
    parseRelativePostedAt(postedPhrase, referenceIso) ??
    parseRelativePostedAt(raw.summary, referenceIso) ??
    null;

  let description = isLinkedInPost ? stripMarkdownBlocks(md).slice(0, 8000) : buildNaukriDescription(md);
  if (!description && !isBoilerplateSummary(raw.summary)) {
    description = stripMarkdownBlocks(raw.summary ?? '').slice(0, 8000);
  }
  if (!description && md.length > 200) {
    description = stripMarkdownBlocks(md).slice(0, 8000);
  }

  const responsibilities = isLinkedInPost
    ? extractBulletPoints(md).slice(0, 14)
    : extractBulletPoints(description);
  const eligibility = isLinkedInPost ? extractBulletPoints(md).slice(0, 10) : extractNaukriEligibility(md);
  const sourceName = raw.source_name ?? (raw.source_url.includes('naukri.com') ? 'naukri.com' : 'linkedin.com');
  const salary =
    (isLinkedInPost ? extractLinkedInPostSalary(md) : null) ?? extractNaukriSalary(md);
  const experience =
    raw.experience?.trim() || parsedPost?.experience?.trim() || 'Not specified';

  const draft: SiteJobRecord = {
    slug: createJobSlug(title, company, postedAt ?? referenceIso),
    title,
    company,
    location: raw.location?.trim() || parsedPost?.location?.trim() || 'Visakhapatnam',
    category:
      normalizeJobCategory(raw.category?.trim()) ||
      (isLinkedInPost ? 'General' : normalizeJobCategory(inferCategory(md)) || inferCategory(md)),
    job_type: inferJobType(md),
    work_mode: isLinkedInPost ? null : inferWorkMode(md),
    experience,
    is_fresher: inferIsFresher(experience === 'Not specified' ? '' : experience, title, md),
    salary,
    apply_link: resolveApplyLinkForJob(
      raw.apply_url,
      raw.source_url,
      raw.linkedin_post_text ?? (isLinkedInPost ? md : null),
    ),
    short_description: buildShortDescription(description, title),
    description,
    responsibilities: responsibilities.length > 0 ? responsibilities : [],
    eligibility,
    warning: DEFAULT_JOB_WARNING,
    posted_at: postedAt,
    expires_at: null,
    source_name: sourceName,
    source_url: raw.source_url,
    skills: isLinkedInPost ? [] : extractNaukriSkills(md),
    company_logo_url: isLinkedInPost ? null : extractCompanyLogoUrl(md),
    status: 'draft',
    is_featured: false,
    source_kind: raw.source_kind ?? (sourceName === 'naukri.com' ? 'naukri' : 'linkedin_job'),
    linkedin_post_text: raw.linkedin_post_text ?? (isLinkedInPost ? md : null),
    needs_review: raw.needs_review ?? isLinkedInPost,
    is_likely_hiring_post: raw.is_likely_hiring_post ?? isLinkedInPost,
    linkedin_post_preset: raw.linkedin_post_preset ?? null,
    linkedin_post_preset_label: raw.linkedin_post_preset_label ?? null,
  };

  const classified = classifyJobRecord(draft);
  return {
    ...draft,
    company: classified.company,
    category: classified.category,
    is_fresher: classified.is_fresher,
    experience: classified.experience,
  };
}

function dedupeSiteJobs(jobs: SiteJobRecord[]): SiteJobRecord[] {
  const seen = new Set<string>();
  const out: SiteJobRecord[] = [];
  for (const job of jobs) {
    const key = siteJobDedupeKey(job);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(job);
  }
  return out;
}

const NAUKRI_LOCATION_TOKENS = [
  'visakhapatnam',
  'vishakhapatnam',
  'vizag',
  'vijayawada',
  'guntur',
  'hyderabad',
  'rajahmundry',
  'khammam',
];

function parseNaukriJobListingUrl(url: string): Partial<ExtractedJob> | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('naukri.com')) {
      return null;
    }
    let body = u.pathname.replace(/^\//, '');
    if (!body.startsWith('job-listings-')) {
      return null;
    }
    body = body.slice('job-listings-'.length);

    const idMatch = body.match(/-(\d{9,})$/);
    if (!idMatch) {
      return null;
    }
    body = body.slice(0, -idMatch[0].length);

    let experience = 'Not specified';
    const expRange = body.match(/-(\d+)-to-(\d+)-years$/i);
    const expFresher = body.match(/-0-to-(\d+)-years$/i);
    if (expRange) {
      experience = `${expRange[1]} to ${expRange[2]} years`;
      body = body.slice(0, -expRange[0].length);
    } else if (expFresher) {
      experience = `0 to ${expFresher[1]} years`;
      body = body.slice(0, -expFresher[0].length);
    }

    const parts = body.split('-').filter(Boolean);
    let locIdx = -1;
    let locToken = 'visakhapatnam';
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i].toLowerCase();
      const hit = NAUKRI_LOCATION_TOKENS.find((k) => p.includes(k) || k.includes(p));
      if (hit) {
        locIdx = i;
        locToken = hit;
        break;
      }
    }

    let title = 'Job opening';
    let company = 'Unknown';
    const location =
      locToken === 'vizag' ? 'Vizag / Visakhapatnam' : humanizeSlugPart(locToken);

    if (locIdx >= 0) {
      const beforeLoc = parts.slice(0, locIdx);
      const split = splitNaukriTitleCompanyFromSlugParts(beforeLoc);
      title = split.title;
      company = split.company;
    } else if (parts.length > 0) {
      title = humanizeSlugPart(parts.slice(0, Math.min(5, parts.length)).join('-'));
      company = humanizeSlugPart(parts.slice(Math.min(5, parts.length)).join('-')) || company;
    }

    return {
      title,
      company,
      experience,
      location,
      apply_url: u.href,
      source_url: u.href,
      source_name: 'naukri.com',
    };
  } catch {
    return null;
  }
}

const NAUKRI_TITLE_BOUNDARY_WORDS = new Set([
  'associate',
  'executive',
  'engineer',
  'manager',
  'analyst',
  'officer',
  'specialist',
  'consultant',
  'developer',
  'lead',
  'head',
  'intern',
  'trainee',
  'representative',
  'supervisor',
  'coordinator',
  'iii',
  'ii',
  'iv',
  'i',
]);

const NAUKRI_COMPANY_SUFFIX_TOKENS = new Set([
  'llp',
  'ltd',
  'limited',
  'pvt',
  'private',
  'inc',
  'corp',
  'llc',
  'gmbh',
  'bank',
  'finance',
  'india',
  'services',
  'solutions',
  'technologies',
  'technology',
  'enterprises',
  'group',
  'pharma',
  'healthcare',
  'motors',
  'paints',
  'consultancy',
  'consulting',
]);

const GARBAGE_JOB_TITLES = new Set([
  'job opening',
  'job description',
  'search jobs here',
  'naukri logo',
  'login',
  'register',
]);

function splitNaukriTitleCompanyFromSlugParts(
  beforeLoc: string[],
): { title: string; company: string } {
  if (beforeLoc.length === 0) {
    return { title: 'Job opening', company: 'Unknown' };
  }

  let suffixIdx = -1;
  for (let i = beforeLoc.length - 1; i >= 0; i -= 1) {
    const p = beforeLoc[i].toLowerCase();
    if (NAUKRI_COMPANY_SUFFIX_TOKENS.has(p) || [...NAUKRI_COMPANY_SUFFIX_TOKENS].some((s) => p.includes(s))) {
      suffixIdx = i;
      break;
    }
  }

  if (suffixIdx >= 0) {
    let companyStart = suffixIdx;
    for (let j = suffixIdx - 1; j >= 0; j -= 1) {
      const p = beforeLoc[j].toLowerCase();
      if (NAUKRI_TITLE_BOUNDARY_WORDS.has(p)) {
        companyStart = j + 1;
        break;
      }
      companyStart = j;
    }
    return {
      title: humanizeSlugPart(beforeLoc.slice(0, companyStart).join('-')) || 'Job opening',
      company: humanizeSlugPart(beforeLoc.slice(companyStart).join('-')) || 'Unknown',
    };
  }

  const splitAt = Math.max(1, beforeLoc.length - 2);
  return {
    title: humanizeSlugPart(beforeLoc.slice(0, splitAt).join('-')) || 'Job opening',
    company: humanizeSlugPart(beforeLoc.slice(splitAt).join('-')) || 'Unknown',
  };
}

function parseLinkedInJobViewUrl(url: string): Partial<ExtractedJob> | null {
  try {
    const u = new URL(url);
    if (!u.hostname.replace(/^www\./, '').toLowerCase().endsWith('linkedin.com')) {
      return null;
    }
    if (!/\/jobs\/view\//i.test(u.pathname)) {
      return null;
    }

    const pathMatch = u.pathname.match(/\/jobs\/view\/(.+)$/i);
    if (!pathMatch?.[1]) {
      return null;
    }

    let slug = normalizeJobSlug(decodeURIComponent(pathMatch[1]).replace(/\/$/, ''));
    slug = slug.replace(/-(\d{8,})$/, '');

    let titleSlug = slug;
    let companySlug = '';
    const atIdx = slug.lastIndexOf('-at-');
    if (atIdx > 0) {
      titleSlug = slug.slice(0, atIdx);
      companySlug = slug.slice(atIdx + 4);
    }

    const title = humanizeSlugPart(titleSlug) || 'Job opening';
    const company = companySlug ? humanizeSlugPart(companySlug) : 'Unknown';

    const blob = `${title} ${company} ${slug}`.toLowerCase();
    const location = blob.includes('vizag') || blob.includes('visakhapatnam')
      ? 'Visakhapatnam / Vizag'
      : 'Visakhapatnam / Vizag';

    return {
      title,
      company,
      experience: 'Not specified',
      location,
      apply_url: u.href,
      source_url: u.href,
      source_name: 'linkedin.com',
    };
  } catch {
    return null;
  }
}

function isUsableJobTitle(value: string | null | undefined): boolean {
  if (!value?.trim()) {
    return false;
  }
  const low = value.trim().toLowerCase();
  if (GARBAGE_JOB_TITLES.has(low)) {
    return false;
  }
  if (low.length < 3 || low.length > 200) {
    return false;
  }
  if (/^https?:\/\//i.test(low) || low.includes('naukri.com')) {
    return false;
  }
  return true;
}

function isUsableCompanyName(value: string | null | undefined): boolean {
  if (!value?.trim()) {
    return false;
  }
  const low = value.trim().toLowerCase();
  return low !== 'unknown' && low !== 'job opening' && low.length >= 2;
}

function extractNaukriFieldsFromMarkdown(markdown: string): Partial<ExtractedJob> {
  const out: Partial<ExtractedJob> = {};

  const companyMatches = [
    ...markdown.matchAll(
      /\[([^\]]{2,120})\]\(https:\/\/www\.naukri\.com\/(?!naukri)[a-z0-9-]+-jobs-careers/gi,
    ),
  ];
  for (const match of companyMatches) {
    const name = match[1]?.trim();
    if (name && !/^naukri$/i.test(name) && isUsableCompanyName(name)) {
      out.company = name;
      break;
    }
  }

  const roleMatch = markdown.match(/Role:\s*\[([^\]]{2,160})\]/i);
  if (roleMatch?.[1] && isUsableJobTitle(roleMatch[1])) {
    out.title = roleMatch[1].trim();
  }

  const designationMatch =
    markdown.match(/\*\*Designation:\*\*\s*([^\n*]+)/i) ||
    markdown.match(/Designation\s*:\s*([^\n]+)/i);
  if (designationMatch?.[1] && isUsableJobTitle(designationMatch[1])) {
    out.title = designationMatch[1].trim();
  }

  const postedMatch = markdown.match(/Posted:\s*([^O\n]+?)(?:Openings:|Applicants:|$)/i);
  if (postedMatch?.[1]) {
    const phrase = postedMatch[1].trim();
    if (/ago|yesterday|today|just now/i.test(phrase)) {
      out.summary = `Posted: ${phrase}`;
    }
  }

  const expLine = markdown.match(/\n(\d+\s*-\s*\d+\s+years?)\n/i);
  if (expLine?.[1]) {
    out.experience = expLine[1].replace(/\s+/g, ' ').trim();
  } else {
    const expAlt =
      markdown.match(/Experience:?\s*([^\n]+)/i)?.[1]?.trim() ||
      markdown.match(/\b(\d+\s*-\s*\d+\s+years?)\b/i)?.[1]?.trim() ||
      markdown.match(/\b(\d+)\s*\+\s*years?\b/i)?.[1]?.trim();
    if (expAlt) {
      out.experience = expAlt.replace(/\s+/g, ' ').trim();
    }
  }

  const postedBy = markdown.match(/\[Posted by ([^\]]+)\]/i)?.[1]?.trim();
  if (postedBy && isUsableCompanyName(postedBy)) {
    out.company = postedBy;
  }

  return out;
}

function parseJobFieldsFromUrl(url: string): Partial<ExtractedJob> | null {
  if (!looksLikeIndividualJobApplyUrl(url)) {
    return null;
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (host.endsWith('naukri.com')) {
      return parseNaukriJobListingUrl(url);
    }
    if (host.endsWith('linkedin.com')) {
      return parseLinkedInJobViewUrl(url);
    }
  } catch {
    return null;
  }
  return null;
}

function extractTitleFromMarkdown(markdown: string): string | null {
  const h1 = markdown.match(/^#\s+(.+)$/m);
  if (h1?.[1] && isUsableJobTitle(h1[1])) {
    return h1[1].trim().slice(0, 200);
  }
  const h2 = markdown.match(/^##\s+(.+)$/m);
  if (h2?.[1] && isUsableJobTitle(h2[1])) {
    return h2[1].trim().slice(0, 200);
  }
  return null;
}

function sortDetailUrlsForScrape(urls: string[]): string[] {
  const rank = (url: string): number => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes('naukri.com')) {
        return 0;
      }
      if (host.includes('linkedin.com')) {
        return 2;
      }
    } catch {
      return 1;
    }
    return 1;
  };
  return [...urls].sort((a, b) => rank(a) - rank(b));
}

function extractSummaryFromMarkdown(markdown: string): string | null {
  const cleaned = markdown.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 40) {
    return null;
  }
  return cleaned.slice(0, 400);
}

function mergeJobRecord(
  url: string,
  slugFields: Partial<ExtractedJob> | null,
  markdown: string,
  scrapedAt: string,
): ExtractedJob | null {
  const fromUrl = slugFields ?? parseJobFieldsFromUrl(url);
  if (!fromUrl) {
    return null;
  }

  const md = markdown.trim();
  const isNaukri = url.includes('naukri.com');
  const isLinkedIn = url.includes('linkedin.com');
  const naukriMd = isNaukri && md ? extractNaukriFieldsFromMarkdown(md) : {};
  const titleFromMd = md && !isNaukri ? extractTitleFromMarkdown(md) : null;
  const scrapeThin = md.length < 120;

  let title = fromUrl.title || 'Job opening';
  if (isLinkedIn) {
    if (isUsableJobTitle(fromUrl.title)) {
      title = fromUrl.title!;
    } else if (!scrapeThin && isUsableJobTitle(titleFromMd)) {
      title = titleFromMd!;
    }
  } else if (isNaukri) {
    if (isUsableJobTitle(fromUrl.title)) {
      title = fromUrl.title!;
    }
    if (isUsableJobTitle(naukriMd.title)) {
      title = naukriMd.title!;
    }
  } else if (isUsableJobTitle(titleFromMd)) {
    title = titleFromMd!;
  } else if (isUsableJobTitle(fromUrl.title)) {
    title = fromUrl.title!;
  }

  let company = fromUrl.company || 'Unknown';
  if (isLinkedIn) {
    if (isUsableCompanyName(fromUrl.company)) {
      company = fromUrl.company!;
    }
  } else if (isNaukri) {
    if (isUsableCompanyName(naukriMd.company)) {
      company = naukriMd.company!;
    } else if (isUsableCompanyName(fromUrl.company)) {
      company = fromUrl.company!;
    }
  } else if (isUsableCompanyName(fromUrl.company)) {
    company = fromUrl.company!;
  }

  let experience = fromUrl.experience || 'Not specified';
  if (naukriMd.experience?.trim()) {
    experience = naukriMd.experience;
  }

  const summaryFromMd = md ? extractSummaryFromMarkdown(md) : null;

  let posted_at = fromUrl.posted_at ?? null;
  if (isNaukri && md) {
    const phrase = extractPostedPhrase(md, naukriMd.summary ?? summaryFromMd);
    const parsed = phrase ? parseRelativePostedAt(phrase, scrapedAt) : null;
    if (parsed) {
      posted_at = parsed;
    }
  }

  return {
    title,
    company,
    experience,
    location: fromUrl.location ?? 'Visakhapatnam / Vizag',
    apply_url: url,
    source_url: url,
    source_name: fromUrl.source_name ?? null,
    posted_at,
    summary: naukriMd.summary || summaryFromMd || fromUrl.summary || null,
    description_markdown: md.length > 0 ? md : null,
    scrape_chars: md.length,
    scraped_at: scrapedAt,
  };
}

function buildJobRecordFromScrape(
  url: string,
  markdown: string,
  scrapedAt: string,
): ExtractedJob | null {
  return mergeJobRecord(url, parseJobFieldsFromUrl(url), markdown, scrapedAt);
}

const MAX_SEO_SOURCE_CONTEXT_CHARS = 8000;
const MAX_SEO_SHORT_DESCRIPTION_CHARS = 320;
const MAX_SEO_DESCRIPTION_CHARS = 8000;
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_GEMINI_SEO_MODEL = 'gemini-2.5-flash';
const DEFAULT_GEMINI_SEO_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
/** Tried last — often has no free-tier quota left on new Google AI projects. */
const DEPRIORITIZED_SEO_MODELS = ['gemini-2.0-flash-lite'];
const GEMINI_SEO_MAX_RETRIES = 2;
const GEMINI_SEO_REQUEST_TIMEOUT_MS = 72_000;
const GEMINI_SEO_HARD_CAP_MS = 118_000;
/** One Gemini call budget for LinkedIn post SEO (avoid stacked 58s × retries). */
const GEMINI_SEO_LINKEDIN_POST_TIMEOUT_MS = 78_000;
const GEMINI_SEO_LINKEDIN_HARD_CAP_MS = 112_000;
const MAX_SEO_SOURCE_FOR_SINGLE_JOB = 1_800;
const DEFAULT_SEO_BATCH_SIZE = 4;
const DEFAULT_MAX_SCRAPE_URLS = 12;

type FetchRequestBody = {
  mode?: 'fetch' | 'seo' | 'seo_keys';
  /** Single-source fetch: naukri | linkedin_jobs | linkedin_posts | vizag_it | indeed */
  fetch_channel?: string;
  source?: string;
  gemini_channel?: string;
  debug_trace?: boolean;
  job?: SiteJobRecord & { seo_source_context?: string };
  seo_source_context?: string;
  /** Admin-only hints appended to the Make SEO Gemini prompt (max ~1200 chars). */
  seo_custom_instructions?: string;
  /** Make SEO: 1-based key pool index from `seo_keys` mode. Omit or 0 = auto shuffle. */
  gemini_key_index?: number;
  /** seo_keys mode: use LinkedIn-post key pool when true. */
  linkedin_post?: boolean;
  /** linkedin_posts only: general | it | bank | custom */
  linkedin_post_preset?: string;
  /** Required when linkedin_post_preset is custom */
  linkedin_custom_search_url?: string;
  /** Naukri async Apify: start (fire-and-forget) | collect (read dataset by run id) */
  naukri_action?: 'start' | 'collect';
  apify_naukri_run_id?: string;
};

type GeminiKeyChannel = 'linkedin_posts' | 'seo' | 'default';

function stripClientReviewFields(
  job: SiteJobRecord & {
    seo_source_context?: string;
    seo_optimized?: boolean;
    seo_custom_instructions?: string | null;
    seo_meta?: unknown;
    seo_show_preview?: boolean;
  },
): SiteJobRecord {
  const {
    seo_source_context: _ctx,
    seo_optimized: _opt,
    seo_custom_instructions: _instr,
    seo_meta: _meta,
    seo_show_preview: _preview,
    ...record
  } = job;
  return record;
}
const DEFAULT_FUNCTION_BUDGET_MS = 110_000;
const FIRECRAWL_TIMEOUT_MS = 20_000;
const GEMINI_REQUEST_TIMEOUT_MS = 55_000;
const MAX_SEO_SOURCE_PER_JOB_IN_BATCH = 2_500;

type FetchBudget = {
  hasTime: (reserveMs?: number) => boolean;
  elapsedMs: () => number;
};

function createFetchBudget(): FetchBudget {
  const limit = Math.min(
    Math.max(45_000, Number(Deno.env.get('FETCH_JOB_MAX_RUNTIME_MS') ?? String(DEFAULT_FUNCTION_BUDGET_MS)) ||
      DEFAULT_FUNCTION_BUDGET_MS),
    140_000,
  );
  const started = Date.now();
  return {
    hasTime: (reserveMs = 8_000) => limit - (Date.now() - started) > reserveMs,
    elapsedMs: () => Date.now() - started,
  };
}

function getGeminiModel(): string {
  return Deno.env.get('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;
}

function getGeminiSeoModel(): string {
  return Deno.env.get('GEMINI_SEO_MODEL')?.trim() || DEFAULT_GEMINI_SEO_MODEL;
}

function getGeminiSeoModelCandidates(): string[] {
  const primary = getGeminiSeoModel();
  const fromEnv = Deno.env.get('GEMINI_SEO_FALLBACK_MODELS')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const fallbacks = fromEnv?.length ? fromEnv : DEFAULT_GEMINI_SEO_FALLBACK_MODELS;
  const merged = [...new Set([...fallbacks, ...DEFAULT_GEMINI_SEO_FALLBACK_MODELS, primary])];
  const preferred = merged.filter((m) => !DEPRIORITIZED_SEO_MODELS.includes(m));
  const deprioritized = merged.filter((m) => DEPRIORITIZED_SEO_MODELS.includes(m));
  return [...preferred, ...deprioritized];
}

/** Channel-specific key first, then GEMINI_API_KEY + GEMINI_API_KEYS. */
function getGeminiApiKeys(channel: GeminiKeyChannel = 'default'): string[] {
  return getGeminiKeySlots(channel).map((slot) => slot.apiKey);
}

export type GeminiKeySlot = {
  apiKey: string;
  source: string;
  label: string;
  hint: string;
  /** 1-based index in the configured Make SEO key pool (stable, not shuffle order). */
  poolIndex: number;
};

export type GeminiKeyUsage = {
  index: number;
  total: number;
  source: string;
  label: string;
  hint: string;
};

function maskGeminiKeyHint(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 4) {
    return '****';
  }
  return `…${trimmed.slice(-4)}`;
}

/** Keys from one env channel (deduped), with stable labels for admin display. */
function getGeminiKeySlots(channel: GeminiKeyChannel = 'default'): GeminiKeySlot[] {
  const slots: GeminiKeySlot[] = [];
  const seen = new Set<string>();

  const push = (apiKey: string, source: string, label?: string) => {
    if (seen.has(apiKey)) {
      return;
    }
    seen.add(apiKey);
    slots.push({
      apiKey,
      source,
      label: label ?? source,
      hint: maskGeminiKeyHint(apiKey),
    });
  };

  const channelPrimary =
    channel === 'linkedin_posts'
      ? Deno.env.get('GEMINI_API_KEY_LINKEDIN_POSTS')?.trim()
      : channel === 'seo'
        ? Deno.env.get('GEMINI_API_KEY_SEO')?.trim()
        : null;
  if (channelPrimary) {
    push(
      channelPrimary,
      channel === 'seo' ? 'GEMINI_API_KEY_SEO' : 'GEMINI_API_KEY_LINKEDIN_POSTS',
    );
  }
  const primary = Deno.env.get('GEMINI_API_KEY')?.trim();
  if (primary) {
    push(primary, 'GEMINI_API_KEY');
  }
  const extra = Deno.env.get('GEMINI_API_KEYS')?.trim();
  if (extra) {
    let extraIndex = 0;
    for (const part of extra.split(/[,\n]+/)) {
      const k = part.trim();
      if (!k) {
        continue;
      }
      extraIndex += 1;
      push(k, 'GEMINI_API_KEYS', `GEMINI_API_KEYS (#${extraIndex})`);
    }
  }
  return slots.map((slot, i) => ({ ...slot, poolIndex: i + 1 }));
}

/** Make SEO key pool — same merge order as getGeminiApiKeysForMakeSeo, with labels. */
function getGeminiKeySlotsForMakeSeo(linkedInPost = false): GeminiKeySlot[] {
  const merged: GeminiKeySlot[] = [];
  const seen = new Set<string>();
  for (const slot of [
    ...getGeminiKeySlots('seo'),
    ...(linkedInPost ? getGeminiKeySlots('linkedin_posts') : []),
    ...getGeminiKeySlots('default'),
  ]) {
    if (seen.has(slot.apiKey)) {
      continue;
    }
    seen.add(slot.apiKey);
    merged.push({ ...slot, poolIndex: merged.length + 1 });
  }
  return merged;
}

function parsePreferredGeminiKeyIndex(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return Math.floor(n);
}

function geminiKeySlotsToPublicMeta(slots: GeminiKeySlot[]) {
  return slots.map((slot) => ({
    index: slot.poolIndex,
    label: slot.label,
    source: slot.source,
    hint: slot.hint,
  }));
}

/** Auto shuffle when preferredIndex is 0; otherwise use exactly one configured key. */
function resolveGeminiKeySlotsForSeoAttempt(
  pool: GeminiKeySlot[],
  preferredIndex: number,
): GeminiKeySlot[] {
  if (pool.length === 0) {
    return pool;
  }
  if (preferredIndex <= 0) {
    return shuffledCopy(pool);
  }
  const selected = pool.find((slot) => slot.poolIndex === preferredIndex);
  if (!selected) {
    throw new Error(
      `Invalid gemini_key_index ${preferredIndex}. Configured keys (${pool.length}): ${pool.map((s) => `${s.poolIndex}=${s.label}`).join(', ')}.`,
    );
  }
  return [selected];
}

function geminiKeyUsageFromSlot(slot: GeminiKeySlot, total: number): GeminiKeyUsage {
  return {
    index: slot.poolIndex,
    total,
    source: slot.source,
    label: slot.label,
    hint: slot.hint,
  };
}

/** Tracks which Gemini key is in use during an in-flight Make SEO request (for error responses). */
type MakeSeoKeyTracker = {
  keysConfigured: GeminiKeyUsage[];
  lastAttempt: GeminiKeyUsage | null;
};

let activeMakeSeoKeyTracker: MakeSeoKeyTracker | null = null;

function beginMakeSeoKeyTracking(linkedInPost: boolean): MakeSeoKeyTracker {
  const slots = getGeminiKeySlotsForMakeSeo(linkedInPost);
  const total = slots.length;
  const tracker: MakeSeoKeyTracker = {
    keysConfigured: slots.map((slot) => geminiKeyUsageFromSlot(slot, total)),
    lastAttempt: null,
  };
  activeMakeSeoKeyTracker = tracker;
  return tracker;
}

function noteMakeSeoKeyAttempt(slot: GeminiKeySlot, total: number): void {
  if (!activeMakeSeoKeyTracker) {
    return;
  }
  activeMakeSeoKeyTracker.lastAttempt = geminiKeyUsageFromSlot(slot, total);
}

function endMakeSeoKeyTracking(): void {
  activeMakeSeoKeyTracker = null;
}

function makeSeoGeminiKeyFailureFields(linkedInPost: boolean): Record<string, unknown> {
  const tracker = activeMakeSeoKeyTracker;
  const configured =
    tracker?.keysConfigured ??
    getGeminiKeySlotsForMakeSeo(linkedInPost).map((slot, _i, arr) =>
      geminiKeyUsageFromSlot(slot, arr.length),
    );

  if (tracker?.lastAttempt) {
    return {
      gemini_key_index: tracker.lastAttempt.index,
      gemini_keys_total: tracker.lastAttempt.total,
      gemini_key_source: tracker.lastAttempt.source,
      gemini_key_label: tracker.lastAttempt.label,
      gemini_key_hint: tracker.lastAttempt.hint,
    };
  }

  if (configured.length === 0) {
    return {};
  }

  return {
    gemini_keys_total: configured.length,
    gemini_keys_configured: configured.map((k) => k.label),
  };
}

/** Make SEO: SEO keys first, then LinkedIn-post keys when optimizing a hiring post. */
function getGeminiApiKeysForMakeSeo(linkedInPost = false): string[] {
  return getGeminiKeySlotsForMakeSeo(linkedInPost).map((slot) => slot.apiKey);
}

function isGeminiQuotaExhausted(message: string): boolean {
  return /limit:\s*0/i.test(message) || /free[_-]?tier.*quota/i.test(message);
}

function formatGeminiUserError(status: number, apiMessage: string, model: string, label: string): string {
  if (status !== 429) {
    return `${label} failed (${status}): ${apiMessage}`;
  }
  if (isGeminiQuotaExhausted(apiMessage)) {
    return (
      `${label}: free-tier quota exhausted for model "${model}" (limit 0). ` +
      'Enable billing at https://ai.google.dev/pricing and use that project’s API key in Supabase secret GEMINI_API_KEY. ' +
      'Remove or change GEMINI_SEO_MODEL if it points at a depleted model (e.g. gemini-2.0-flash-lite).'
    );
  }
  const retryMatch = apiMessage.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  if (retryMatch) {
    const sec = Math.ceil(Number(retryMatch[1]));
    return `${label}: rate limited on "${model}" (~${sec}s backoff before retry).`;
  }
  return `${label} failed (429) on "${model}": ${apiMessage.slice(0, 280)}`;
}

function isGemini429Error(message: string): boolean {
  return (
    message.includes('(429)') ||
    /\b429\b/.test(message) ||
    isGeminiQuotaExhausted(message) ||
    /rate limit/i.test(message)
  );
}

function isGeminiOverloadError(message: string): boolean {
  return (
    /\((503|502|500)\)/.test(message) ||
    /high demand/i.test(message) ||
    /overloaded/i.test(message) ||
    /temporarily unavailable/i.test(message) ||
    /service unavailable/i.test(message) ||
    /resource exhausted/i.test(message)
  );
}

function shouldTryNextSeoFallback(message: string): boolean {
  return (
    isGemini429Error(message) ||
    isGeminiQuotaExhausted(message) ||
    isGeminiOverloadError(message)
  );
}

function isGeminiSeoTimeoutError(message: string): boolean {
  return /timed out|timeout|AbortError|aborted/i.test(message);
}

function isGeminiSeoParseRetryError(message: string): boolean {
  return /invalid json|json parse|parseSeoGemini|returned no text|unexpected token/i.test(message);
}

function formatSeoGeminiFailure(
  errors: string[],
  keysCount: number,
  keysAttempted: number,
  modelsTried: string[],
  modelsPlanned: string[],
): string {
  if (errors.length > 0 && errors.every(isGeminiQuotaExhausted)) {
    const planned =
      modelsPlanned.length > modelsTried.length
        ? `planned: ${modelsPlanned.join(', ')}; tried: ${modelsTried.join(', ') || 'none'}`
        : modelsTried.join(', ');
    return (
      `Gemini free-tier quota exhausted for ${keysAttempted} of ${keysCount} API key(s) (${planned}). ` +
      'Remove GEMINI_SEO_MODEL=gemini-2.0-flash-lite if set, add keys in GEMINI_API_KEYS, enable billing, or wait for quota reset.'
    );
  }
  const last = errors[errors.length - 1] ?? 'Gemini SEO failed.';
  if (errors.some(isGeminiOverloadError)) {
    return `${last} Tried ${keysAttempted} shuffled API key(s) and ${modelsTried.length} model(s). Add more keys in GEMINI_API_KEYS or retry in a minute.`;
  }
  if (errors.some(isGemini429Error)) {
    return (
      `${last} Auto-retried with backoff across ${keysAttempted} key(s) and ${modelsTried.length} model(s). ` +
      'Wait 30–60s before the next job, spread keys across different Google accounts, or enable billing.'
    );
  }
  return last;
}

type GeminiSeoCallResult = {
  payload: Record<string, unknown>;
  usedKeyIndex: number;
  model: string;
  keyUsage: GeminiKeyUsage;
};

type GeminiCallOptions = {
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fisher–Yates shuffle (new array) — spreads load across GEMINI_API_KEYS per request. */
function shuffledCopy<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function parseGeminiRetryDelayMs(message: string, attempt: number): number {
  const retryMatch = message.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  if (retryMatch) {
    return Math.ceil(Number(retryMatch[1]) * 1000) + 750;
  }
  const waitMatch = message.match(/Wait ~(\d+)s/i);
  if (waitMatch) {
    return Number(waitMatch[1]) * 1000 + 750;
  }
  return Math.min(32_000, 1500 * 2 ** attempt);
}

function isRetryableGeminiHttpStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 500;
}

async function geminiGenerateContent(
  body: unknown,
  apiKey: string,
  label = 'Gemini',
  options: GeminiCallOptions = {},
): Promise<Record<string, unknown>> {
  const model = options.model ?? getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const maxRetries = Math.min(
    Math.max(
      0,
      options.maxRetries ??
        (Number(Deno.env.get('GEMINI_MAX_RETRIES') ?? String(GEMINI_SEO_MAX_RETRIES)) || GEMINI_SEO_MAX_RETRIES),
    ),
    6,
  );
  const requestTimeoutMs =
    options.timeoutMs ??
    (Number(Deno.env.get('GEMINI_REQUEST_TIMEOUT_MS') ?? String(GEMINI_REQUEST_TIMEOUT_MS)) ||
      GEMINI_REQUEST_TIMEOUT_MS);

  let lastError = `${label} request failed.`;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const payload = await res.json().catch(() => null);
      if (res.ok) {
        return (payload ?? {}) as Record<string, unknown>;
      }

      const msg = payload?.error?.message ?? res.statusText;
      lastError = `${label} failed (${res.status}): ${msg}`;

      if (!isRetryableGeminiHttpStatus(res.status) || attempt >= maxRetries) {
        throw new Error(formatGeminiUserError(res.status, String(msg), model, label));
      }

      await sleep(parseGeminiRetryDelayMs(String(msg), attempt));
    } catch (e) {
      if (e instanceof Error && e.message.includes(`${label} failed (`)) {
        throw e;
      }
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      lastError = aborted ? `${label} timed out.` : e instanceof Error ? e.message : String(e);
      if (attempt >= maxRetries) {
        throw new Error(lastError);
      }
      await sleep(parseGeminiRetryDelayMs(lastError, attempt));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(lastError);
}

async function geminiGenerateContentForSeo(
  body: unknown,
  options?: {
    timeoutMs?: number;
    maxModels?: number;
    maxRetries?: number;
    linkedInPost?: boolean;
    /** 1-based pool index; omit or 0 = random shuffle across all keys. */
    preferredKeyIndex?: number;
  },
): Promise<GeminiSeoCallResult> {
  const pool = getGeminiKeySlotsForMakeSeo(options?.linkedInPost === true);
  if (pool.length === 0) {
    throw new Error(
      options?.linkedInPost
        ? 'Gemini API key required for Make SEO. Set GEMINI_API_KEY_SEO, GEMINI_API_KEY, or GEMINI_API_KEY_LINKEDIN_POSTS in Edge Function secrets.'
        : 'GEMINI_API_KEY_SEO or GEMINI_API_KEY is required for Make SEO. Add keys in Edge Function secrets.',
    );
  }
  const preferredKeyIndex = parsePreferredGeminiKeyIndex(options?.preferredKeyIndex);
  const slots = resolveGeminiKeySlotsForSeoAttempt(pool, preferredKeyIndex);
  const poolTotal = pool.length;

  const allModels = shuffledCopy(getGeminiSeoModelCandidates());
  const models =
    typeof options?.maxModels === 'number' && options.maxModels > 0
      ? allModels.slice(0, options.maxModels)
      : allModels;
  const seoTimeout = Math.min(
    90_000,
    options?.timeoutMs ??
      (Number(Deno.env.get('GEMINI_SEO_TIMEOUT_MS') ?? String(GEMINI_SEO_REQUEST_TIMEOUT_MS)) ||
        GEMINI_SEO_REQUEST_TIMEOUT_MS),
  );
  const maxRetriesPerModel = Math.min(
    4,
    options?.maxRetries ??
      (Number(Deno.env.get('GEMINI_SEO_MAX_RETRIES') ?? GEMINI_SEO_MAX_RETRIES) || GEMINI_SEO_MAX_RETRIES),
  );
  const tryFallbackOnQuota =
    (Deno.env.get('GEMINI_SEO_TRY_FALLBACK_MODELS') ?? 'true').toLowerCase() !== 'false';

  const errors: string[] = [];
  const modelsAttempted = new Set<string>();
  let keysAttempted = 0;

  for (let keyIndex = 0; keyIndex < slots.length; keyIndex += 1) {
    const slot = slots[keyIndex]!;
    const apiKey = slot.apiKey;
    keysAttempted = keyIndex + 1;
    noteMakeSeoKeyAttempt(slot, poolTotal);

    for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
      const model = models[modelIndex]!;
      modelsAttempted.add(model);

      try {
        const payload = await geminiGenerateContent(body, apiKey, 'Gemini SEO', {
          model,
          maxRetries: maxRetriesPerModel,
          timeoutMs: seoTimeout,
        });
        return {
          payload,
          usedKeyIndex: slot.poolIndex,
          model,
          keyUsage: geminiKeyUsageFromSlot(slot, poolTotal),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`[key ${keyIndex + 1}/${slots.length}, ${model}] ${msg}`);

        const hasMoreModels = modelIndex < models.length - 1;
        const hasMoreKeys = keyIndex < slots.length - 1;
        const quotaDead = isGeminiQuotaExhausted(msg);

        if (tryFallbackOnQuota && shouldTryNextSeoFallback(msg) && (hasMoreModels || hasMoreKeys)) {
          if (!quotaDead && (isGeminiOverloadError(msg) || isGemini429Error(msg))) {
            await sleep(parseGeminiRetryDelayMs(msg, 0));
          }
          continue;
        }

        throw new Error(
          formatSeoGeminiFailure(errors, poolTotal, keysAttempted, [...modelsAttempted], models),
        );
      }
    }
  }

  throw new Error(
    formatSeoGeminiFailure(errors, poolTotal, keysAttempted, [...modelsAttempted], models),
  );
}

type GeminiSeoRunOptions = {
  preferredKeyIndex?: number;
};

const MAX_SEO_TITLE_CHARS = 60;
const MAX_SEO_SLUG_CHARS = 60;

type GeminiSeoOptimizeResult = {
  record: SiteJobRecord;
  usedKeyIndex: number;
  model: string;
  keyUsage: GeminiKeyUsage;
  seoExtras: ReturnType<typeof extractSeoExtrasFromPayload>;
};

function buildSeoGeminiMetaExtras(
  model: string,
  keyUsage: GeminiKeyUsage,
  runtimeMs: number,
  seoProfile: string,
  hadCustomInstructions: boolean,
  seoExtras: ReturnType<typeof extractSeoExtrasFromPayload>,
  record?: SiteJobRecord,
) {
  const json_ld = sanitizeJsonLdJobPosting(seoExtras.json_ld, record ?? {});
  return {
    gemini_model: model,
    gemini_key_index: keyUsage.index,
    gemini_keys_total: keyUsage.total,
    gemini_key_source: keyUsage.source,
    gemini_key_label: keyUsage.label,
    gemini_key_hint: keyUsage.hint,
    runtime_ms: runtimeMs,
    seo_profile: seoProfile,
    had_custom_instructions: hadCustomInstructions,
    prompt_version: 'vizag_tasks_1_8',
    json_ld,
    hashtags: seoExtras.hashtags,
    keyword_density: seoExtras.keyword_density,
  };
}

function finalizeSeoRecord(
  record: SiteJobRecord,
  extras: ReturnType<typeof extractSeoExtrasFromPayload>,
): SiteJobRecord {
  const json_ld = sanitizeJsonLdJobPosting(extras.json_ld, record);
  return sanitizeJobSeoRecord({
    ...record,
    json_ld,
    seo_meta: {
      json_ld,
      hashtags: extras.hashtags,
      keyword_density: extras.keyword_density,
    },
  });
}

function clampText(value: string, maxLen: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLen) {
    return trimmed;
  }
  const cut = trimmed.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function normalizeSeoStringList(value: unknown, maxItems = 12): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function buildSourceContextMap(rawJobs: ExtractedJob[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const job of rawJobs) {
    const keys = [job.apply_url, job.source_url].filter(Boolean).map((u) => String(u).toLowerCase());
    const context = [job.linkedin_post_text, job.description_markdown, job.summary]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join('\n\n')
      .slice(0, MAX_SEO_SOURCE_CONTEXT_CHARS);
    for (const key of keys) {
      if (context) {
        map.set(key, context);
      }
    }
  }
  return map;
}

function lookupSourceContext(record: SiteJobRecord, contextMap: Map<string, string>): string {
  const keys = [record.apply_link, record.source_url].filter(Boolean).map((u) => String(u).toLowerCase());
  for (const key of keys) {
    const hit = contextMap.get(key);
    if (hit) {
      return hit;
    }
  }
  return (record.description ?? '').slice(0, MAX_SEO_SOURCE_CONTEXT_CHARS);
}

function extractJsonBooleanField(source: string, key: string): boolean | undefined {
  const match = source.match(new RegExp(`"${key}"\\s*:\\s*(true|false)`, 'i'));
  if (!match) return undefined;
  return match[1].toLowerCase() === 'true';
}

function applySeoPayload(record: SiteJobRecord, payload: SeoGeminiPayload): SiteJobRecord {
  const rawTitle = typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : record.title;
  const title = clampText(rawTitle, MAX_SEO_TITLE_CHARS);
  const shortDescription =
    typeof payload.short_description === 'string' && payload.short_description.trim()
      ? clampText(payload.short_description, 160)
      : record.short_description;
  const description =
    typeof payload.description === 'string' && payload.description.trim()
      ? clampText(payload.description, MAX_SEO_DESCRIPTION_CHARS)
      : record.description;
  const responsibilities = normalizeSeoStringList(payload.responsibilities);
  const eligibility = normalizeSeoStringList(payload.eligibility);
  const skills = normalizeSeoStringList(payload.skills);
  const categoryRaw =
    typeof payload.category === 'string' && payload.category.trim() ? payload.category.trim() : record.category;
  const category = normalizeJobCategory(categoryRaw) ?? categoryRaw;
  const jobType =
    typeof payload.job_type === 'string' && payload.job_type.trim() ? payload.job_type.trim() : record.job_type;
  const workMode =
    payload.work_mode === null
      ? null
      : typeof payload.work_mode === 'string' && payload.work_mode.trim()
        ? payload.work_mode.trim()
        : record.work_mode;
  const experienceFromGemini =
    typeof payload.experience === 'string' && payload.experience.trim()
      ? payload.experience.trim()
      : record.experience;
  const companyFromGemini =
    typeof payload.company === 'string' && payload.company.trim() ? payload.company.trim() : '';
  const company = isUsableCompanyName(companyFromGemini)
    ? companyFromGemini
    : isUsableCompanyName(record.company)
      ? record.company
      : record.company;

  const merged: SiteJobRecord = {
    ...record,
    title,
    company,
    slug: normalizeSeoSlug(payload.slug, title, company).slice(0, MAX_SEO_SLUG_CHARS),
    short_description: shortDescription ?? record.short_description,
    description: description ?? record.description,
    responsibilities: responsibilities.length > 0 ? responsibilities : record.responsibilities,
    eligibility: eligibility.length > 0 ? eligibility : record.eligibility,
    skills: skills.length > 0 ? skills : record.skills,
    category,
    job_type: jobType,
    work_mode: workMode,
    experience: experienceFromGemini,
    is_fresher:
      typeof payload.is_fresher === 'boolean' ? payload.is_fresher : record.is_fresher,
  };

  const classified = classifyJobRecord(merged);
  return sanitizeJobSeoRecord({
    ...merged,
    company: classified.company,
    category: classified.category,
    is_fresher: classified.is_fresher,
    experience: classified.experience,
  });
}

function resolveSiteJobSlugCollisions(jobs: SiteJobRecord[]): SiteJobRecord[] {
  const used = new Set<string>();
  return jobs.map((job) => {
    let slug = job.slug;
    if (!used.has(slug)) {
      used.add(slug);
      return job;
    }
    let suffix = 2;
    while (used.has(`${slug}-${suffix}`)) {
      suffix += 1;
    }
    const nextSlug = `${slug}-${suffix}`;
    used.add(nextSlug);
    return { ...job, slug: nextSlug };
  });
}

function jobRecordForSeoPrompt(
  record: SiteJobRecord,
  index: number,
  sourceContext: string,
  maxSourceChars = MAX_SEO_SOURCE_PER_JOB_IN_BATCH,
): Record<string, unknown> {
  const postText = record.linkedin_post_text?.trim();
  let scraped = sourceContext.slice(0, maxSourceChars);
  if (record.source_kind === 'linkedin_post' && postText) {
    const extra = sourceContext.trim().slice(0, 500);
    const duplicate =
      extra.length > 40 &&
      postText.toLowerCase().includes(extra.slice(0, Math.min(80, extra.length)).toLowerCase());
    scraped = duplicate ? postText.slice(0, maxSourceChars) : `${postText}\n\n---\n${extra}`.slice(0, maxSourceChars);
  }
  return {
    index,
    source_kind: record.source_kind,
    linkedin_post_text: postText?.slice(0, 4_000) ?? null,
    main_keyword: inferSeoMainKeyword(record),
    supporting_keywords: inferSeoSupportingKeywords(record),
    internal_links: GEMINI_SEO_INTERNAL_LINKS,
    apply_link: record.apply_link,
    source_url: record.source_url,
    company: record.company,
    location: record.location,
    experience: record.experience,
    salary: record.salary,
    posted_at: record.posted_at,
    is_fresher: record.is_fresher,
    title: record.title,
    short_description: record.short_description,
    description: record.description?.slice(0, 800),
    responsibilities: record.responsibilities,
    eligibility: record.eligibility,
    skills: record.skills,
    category: record.category,
    job_type: record.job_type,
    work_mode: record.work_mode,
    scraped_source: scraped,
  };
}

function buildLinkedInPostSeoInput(
  record: SiteJobRecord,
  sourceContext: string,
): { jobInput: Record<string, unknown>; workingRecord: SiteJobRecord; compact: boolean } {
  const postRaw = (record.linkedin_post_text ?? record.description ?? record.short_description ?? '').trim();
  const compact = postRaw.length > 1_200;
  const postText = postRaw.slice(0, compact ? 1_400 : 2_400);
  const parsed = postText ? parseLinkedInHiringPost(postText) : {};
  const title =
    record.title && record.title !== 'Job opening'
      ? record.title
      : parsed.title?.trim() || record.title;
  const company =
    record.company && record.company !== 'Unknown'
      ? record.company
      : parsed.company?.trim() || record.company;

  const workingRecord: SiteJobRecord = {
    ...record,
    title,
    company,
    linkedin_post_text: postText || record.linkedin_post_text,
    description: postText.slice(0, 1_200),
    short_description: record.short_description?.slice(0, 400) ?? record.short_description,
  };

  const trimmedContext = sourceContext.slice(0, compact ? 400 : 700);
  const jobInput = jobRecordForSeoPrompt(workingRecord, 0, trimmedContext, compact ? 1_400 : 2_400);
  return { jobInput, workingRecord, compact };
}

function extractGeminiSeoResponseText(payload: Record<string, unknown>): string {
  const blockReason = (payload.promptFeedback as { blockReason?: string } | undefined)?.blockReason;
  if (blockReason) {
    throw new Error(
      `Gemini blocked this job content (${blockReason}). Edit the post text or skip Make SEO for this listing.`,
    );
  }
  const candidates = payload.candidates as Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }> | undefined;
  const first = candidates?.[0];
  const text = first?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim() && first?.finishReason === 'SAFETY') {
    throw new Error('Gemini safety filter blocked SEO for this post. Skip or edit sensitive wording, then retry.');
  }
  return text;
}

async function geminiSeoOptimizeLinkedInPost(
  record: SiteJobRecord,
  sourceContext: string,
  customInstructions?: string,
  runOptions?: GeminiSeoRunOptions,
): Promise<GeminiSeoOptimizeResult> {
  const { jobInput, workingRecord, compact } = buildLinkedInPostSeoInput(record, sourceContext);
  const instruction = buildGeminiSeoLinkedInPostPrompt(jobInput, compact, customInstructions);
  const maxOutputTokens = Math.min(
    6_144,
    Number(Deno.env.get('GEMINI_SEO_LINKEDIN_POST_MAX_OUTPUT_TOKENS') ?? (compact ? '3584' : '4608')) ||
      (compact ? 3584 : 4608),
  );
  const seoTimeout = Math.min(
    90_000,
    Number(Deno.env.get('GEMINI_SEO_LINKEDIN_POST_TIMEOUT_MS') ?? String(GEMINI_SEO_LINKEDIN_POST_TIMEOUT_MS)) ||
      GEMINI_SEO_LINKEDIN_POST_TIMEOUT_MS,
  );
  const maxModels = Math.min(
    2,
    Math.max(
      1,
      Number(Deno.env.get('GEMINI_SEO_LINKEDIN_POST_MAX_MODELS') ?? '1') || 1,
    ),
  );
  const geminiOpts = {
    timeoutMs: seoTimeout,
    maxModels,
    maxRetries: 1,
    linkedInPost: true as const,
    preferredKeyIndex: runOptions?.preferredKeyIndex,
  };

  let lastError: Error | null = null;

  for (const useSchema of [true, false]) {
    const body = {
      contents: [{ role: 'user', parts: [{ text: instruction }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens,
        responseMimeType: 'application/json',
        ...(useSchema ? { responseSchema: GEMINI_SEO_RESPONSE_SCHEMA } : {}),
      },
    };

    try {
      const { payload, usedKeyIndex, model, keyUsage } = await geminiGenerateContentForSeo(body, geminiOpts);
      const text = extractGeminiSeoResponseText(payload);
      if (!text.trim()) {
        throw new Error('Gemini SEO returned no text for this LinkedIn post.');
      }

      const parsed = parseSeoGeminiPayload(text, workingRecord);
      const seoExtras = extractSeoExtrasFromPayload(parsed);
      const optimizedRecord = applySeoPayload(
        {
          ...workingRecord,
          linkedin_post_text: record.linkedin_post_text ?? workingRecord.linkedin_post_text,
        },
        parsed,
      );
      return {
        record: finalizeSeoRecord(optimizedRecord, seoExtras),
        usedKeyIndex,
        model,
        keyUsage,
        seoExtras,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const msg = lastError.message;
      if (!useSchema || isGeminiSeoTimeoutError(msg) || !isGeminiSeoParseRetryError(msg)) {
        break;
      }
      console.warn(
        JSON.stringify({
          event: 'gemini_seo_linkedin_retry_plain_json',
          message: msg.slice(0, 200),
        }),
      );
    }
  }

  if (lastError && isGeminiSeoTimeoutError(lastError.message)) {
    throw new Error(
      'Gemini SEO timed out generating this LinkedIn post. Retry once in a minute; if it repeats, check GEMINI_API_KEY quota or set GEMINI_SEO_LINKEDIN_POST_TIMEOUT_MS higher.',
    );
  }

  throw lastError ?? new Error('LinkedIn post SEO failed.');
}

async function geminiSeoOptimizeSiteJob(
  record: SiteJobRecord,
  sourceContext: string,
  customInstructions?: string,
  runOptions?: GeminiSeoRunOptions,
): Promise<GeminiSeoOptimizeResult> {
  if (record.source_kind === 'linkedin_post') {
    return geminiSeoOptimizeLinkedInPost(record, sourceContext, customInstructions, runOptions);
  }

  const trimmedContext = sourceContext.slice(0, MAX_SEO_SOURCE_FOR_SINGLE_JOB);
  const compactRecord = {
    ...record,
    description: record.description?.slice(0, 2_500) ?? '',
    linkedin_post_text: record.linkedin_post_text?.slice(0, 3_000) ?? record.linkedin_post_text,
  };
  const jobInput = jobRecordForSeoPrompt(compactRecord, 0, trimmedContext, MAX_SEO_SOURCE_FOR_SINGLE_JOB);
  const instruction = buildGeminiSeoSingleJobPrompt(jobInput, customInstructions);

  const body = {
    contents: [{ role: 'user', parts: [{ text: instruction }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: Math.min(
        8192,
        Number(Deno.env.get('GEMINI_SEO_MAX_OUTPUT_TOKENS') ?? '8192') || 8192,
      ),
      responseMimeType: 'application/json',
      responseSchema: GEMINI_SEO_RESPONSE_SCHEMA,
    },
  };

  const { payload, usedKeyIndex, model, keyUsage } = await geminiGenerateContentForSeo(body, {
    linkedInPost: false,
    preferredKeyIndex: runOptions?.preferredKeyIndex,
  });

  const text = extractGeminiSeoResponseText(payload);
  if (!text.trim()) {
    throw new Error('Gemini SEO returned no text.');
  }

  const candidates = payload.candidates as Array<{ finishReason?: string }> | undefined;
  const finishReason = candidates?.[0]?.finishReason ?? '';
  if (finishReason === 'MAX_TOKENS') {
    console.warn(JSON.stringify({ event: 'gemini_seo_max_tokens', model }));
  }

  const parsed = parseSeoGeminiPayload(text, record);
  const seoExtras = extractSeoExtrasFromPayload(parsed);
  const optimizedRecord = applySeoPayload(record, parsed);
  return {
    record: finalizeSeoRecord(optimizedRecord, seoExtras),
    usedKeyIndex,
    model,
    keyUsage,
    seoExtras,
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        break;
      }
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

type SeoBatchItem = SeoGeminiPayload & { index: number };

async function geminiSeoOptimizeBatch(
  records: SiteJobRecord[],
  sourceContextMap: Map<string, string>,
  apiKey: string,
): Promise<SiteJobRecord[]> {
  if (records.length === 0) {
    return [];
  }

  const jobsPayload = records.map((record, index) =>
    jobRecordForSeoPrompt(record, index, lookupSourceContext(record, sourceContextMap)),
  );

  const instruction = buildGeminiSeoEditorPrompt(jobsPayload);

  const batchJobSchema = {
    type: 'OBJECT',
    properties: {
      index: { type: 'NUMBER' },
      ...GEMINI_SEO_RESPONSE_SCHEMA.properties,
    },
    required: ['index', ...GEMINI_SEO_RESPONSE_SCHEMA.required],
  };

  const body = {
    contents: [{ role: 'user', parts: [{ text: instruction }] }],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: Math.min(
        8192,
        Number(Deno.env.get('GEMINI_SEO_MAX_OUTPUT_TOKENS') ?? '8192') || 8192,
      ),
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          jobs: {
            type: 'ARRAY',
            items: batchJobSchema,
          },
        },
        required: ['jobs'],
      },
    },
  };

  const payload = await geminiGenerateContent(body, apiKey, 'Gemini SEO batch');
  const candidates = payload.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  const text = candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) {
    throw new Error('Gemini SEO batch returned no text.');
  }

  let parsed = tryParseJson<{ jobs?: SeoBatchItem[] }>(text, 'gemini_seo_batch');
  if (!parsed) {
    const repaired = tryRepairTruncatedJson(text);
    if (repaired) {
      parsed = tryParseJson<{ jobs?: SeoBatchItem[] }>(repaired, 'gemini_seo_batch_repaired');
    }
  }
  if (!parsed) {
    throw new Error('Gemini SEO batch returned invalid JSON.');
  }
  const rows = Array.isArray(parsed.jobs) ? parsed.jobs : [];
  const byIndex = new Map<number, SeoGeminiPayload>();
  for (const row of rows) {
    if (typeof row.index === 'number' && row.index >= 0 && row.index < records.length) {
      byIndex.set(row.index, row);
    }
  }

  return records.map((record, index) => {
    const seo = byIndex.get(index);
    if (!seo) {
      return record;
    }
    const extras = extractSeoExtrasFromPayload(seo);
    const updated = applySeoPayload(record, seo);
    const json_ld = sanitizeJsonLdJobPosting(extras.json_ld, updated);
    return sanitizeJobSeoRecord({
      ...updated,
      json_ld,
      seo_meta: {
        json_ld,
        hashtags: extras.hashtags,
        keyword_density: extras.keyword_density,
      },
    });
  });
}

async function geminiSeoOptimizeAll(
  siteJobs: SiteJobRecord[],
  sourceContextMap: Map<string, string>,
  apiKey: string,
  budget: FetchBudget,
): Promise<{
  jobs: SiteJobRecord[];
  seo_optimized_count: number;
  seo_failed_count: number;
  seo_errors_sample: { slug: string; error: string }[];
  gemini_status: 'ok' | 'partial' | 'failed';
  gemini_error: string | null;
  seo_sample: { slug: string; title_before: string; title_after: string; short_len_after: number }[];
  seo_batches_run: number;
}> {
  const seoLimit = Math.min(
    Math.max(1, Number(Deno.env.get('FETCH_JOB_SEO_LIMIT') ?? Deno.env.get('FETCH_JOB_DETAIL_SCRAPE_LIMIT') ??
        String(DEFAULT_MAX_SCRAPE_URLS)) || DEFAULT_MAX_SCRAPE_URLS),
    45,
  );
  const batchSize = Math.min(
    Math.max(1, Number(Deno.env.get('FETCH_JOB_SEO_BATCH_SIZE') ?? String(DEFAULT_SEO_BATCH_SIZE)) ||
      DEFAULT_SEO_BATCH_SIZE),
    6,
  );

  const targets = siteJobs.slice(0, seoLimit);
  const remainder = siteJobs.slice(seoLimit);
  const seoErrors: { slug: string; error: string }[] = [];
  const seoSample: { slug: string; title_before: string; title_after: string; short_len_after: number }[] = [];
  const optimized: SiteJobRecord[] = [];
  let seoBatchesRun = 0;
  let seoOptimizedCount = 0;

  for (let i = 0; i < targets.length; i += batchSize) {
    if (!budget.hasTime(18_000)) {
      optimized.push(...targets.slice(i));
      break;
    }

    const batch = targets.slice(i, i + batchSize);
    const titlesBefore = batch.map((r) => r.title);
    try {
      const nextBatch = await geminiSeoOptimizeBatch(batch, sourceContextMap, apiKey);
      seoBatchesRun += 1;
      for (let j = 0; j < nextBatch.length; j += 1) {
        optimized.push(nextBatch[j]);
        seoOptimizedCount += 1;
        if (seoSample.length < 5) {
          seoSample.push({
            slug: nextBatch[j].slug,
            title_before: titlesBefore[j],
            title_after: nextBatch[j].title,
            short_len_after: (nextBatch[j].short_description ?? '').length,
          });
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'SEO batch failed.';
      for (const record of batch) {
        seoErrors.push({ slug: record.slug, error: message });
        optimized.push(record);
      }
    }
  }

  const jobs = [...optimized, ...remainder];
  const seoFailedCount = seoErrors.length;

  let gemini_status: 'ok' | 'partial' | 'failed' = 'ok';
  let gemini_error: string | null = null;

  if (targets.length === 0) {
    gemini_status = 'ok';
  } else if (seoOptimizedCount === 0 && seoFailedCount > 0) {
    gemini_status = 'failed';
    gemini_error = seoErrors[0]?.error ?? 'All SEO optimizations failed.';
  } else if (seoFailedCount > 0 || optimized.length < targets.length) {
    gemini_status = 'partial';
    const skipped = targets.length - optimized.length;
    gemini_error =
      skipped > 0
        ? `Stopped SEO early to stay within time limit (${skipped} job(s) left unoptimized).`
        : `${seoFailedCount} job(s) could not be SEO-optimized; unoptimized copies are included.`;
  }

  return {
    jobs: resolveSiteJobSlugCollisions(jobs),
    seo_optimized_count: seoOptimizedCount,
    seo_failed_count: seoFailedCount,
    seo_errors_sample: seoErrors.slice(0, 8),
    gemini_status,
    gemini_error,
    seo_sample: seoSample,
    seo_batches_run: seoBatchesRun,
  };
}

async function firecrawlSearchQueries(
  queries: string[],
  limitPerQuery: number,
  firecrawlApiKeys: string[],
  options?: { scrapeMarkdown?: boolean },
): Promise<string[]> {
  return firecrawlSearchQueriesFiltered(queries, limitPerQuery, firecrawlApiKeys, (url) => {
    return looksLikeIndividualJobApplyUrl(url) && isLinkedInOrNaukriUrl(url);
  }, options);
}

async function firecrawlSearchQueriesFiltered(
  queries: string[],
  limitPerQuery: number,
  firecrawlApiKeys: string[],
  acceptUrl: (url: string) => boolean,
  options?: { scrapeMarkdown?: boolean },
): Promise<string[]> {
  const found = new Set<string>();
  const searchResults = await Promise.all(
    queries.map((query) => firecrawlSearch(query, limitPerQuery, firecrawlApiKeys, options)),
  );
  for (const rows of searchResults) {
    for (const row of rows) {
      const normalized = normalizeExtractedJobUrl(row.url);
      if (normalized && acceptUrl(normalized)) {
        found.add(normalized);
      }
    }
  }
  return [...found];
}

/**
 * Firecrawl web search for LinkedIn hiring posts (snippets + optional scrape per result).
 */
async function discoverLinkedInPostsFromSearch(
  firecrawlApiKeys: string[],
  budget?: FetchBudget,
): Promise<LinkedInContentPost[]> {
  if (!linkedinSearchFallbackEnabled()) {
    return [];
  }

  const limitPerQuery = Math.min(
    8,
    Math.max(3, Number(Deno.env.get('FETCH_LINKEDIN_SEARCH_LIMIT') ?? '5') || 5),
  );
  const maxPosts = defaultLinkedInContentPostsLimit();
  const posts: LinkedInContentPost[] = [];
  const seen = new Set<string>();

  for (const query of LINKEDIN_HIRING_SEARCH_QUERIES) {
    if (budget && !budget.hasTime(25_000)) {
      break;
    }
    const hits = await firecrawlSearch(query, limitPerQuery, firecrawlApiKeys, { scrapeMarkdown: true });
    for (const hit of hits) {
      const post = linkedInPostFromSearchHit(hit);
      if (!post) {
        continue;
      }
      const key = (post.post_url ?? post.post_text.slice(0, 200)).toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      posts.push(post);
      if (posts.length >= maxPosts) {
        return posts;
      }
    }
  }

  return posts;
}

/**
 * Scrape LinkedIn content search (Vizag + past-24h): hiring posts + /jobs/view/ links.
 */
async function discoverLinkedInContent(
  firecrawlApiKeys: string[],
  budget?: FetchBudget,
  postPreset?: ResolvedLinkedInPostPreset,
): Promise<{
  job_urls: string[];
  posts: LinkedInContentPost[];
  content_pages_scraped: number;
  search_urls: string[];
  content_scrape_chars: number[];
  content_login_wall_pages: number;
  search_posts_added: number;
}> {
  const preset = postPreset ?? resolveLinkedInPostPreset('general');
  const searchUrls = getLinkedInContentSearchUrls(preset);
  const maxPages = Math.min(
    3,
    Math.max(1, Number(Deno.env.get('FETCH_LINKEDIN_CONTENT_PAGES') ?? '1') || 1),
  );
  const maxPosts = defaultLinkedInContentPostsLimit();
  const found = new Set<string>();
  let posts: LinkedInContentPost[] = [];
  const seenPosts = new Set<string>();
  let scraped = 0;
  const content_scrape_chars: number[] = [];
  let content_login_wall_pages = 0;

  for (const searchUrl of searchUrls.slice(0, maxPages)) {
    if (budget && !budget.hasTime(28_000)) {
      break;
    }
    const md = await firecrawlScrapeUrl(searchUrl, firecrawlApiKeys, { linkedInContentSearch: true });
    scraped += 1;
    content_scrape_chars.push(md.length);
    if (isLinkedInLoginWallMarkdown(md)) {
      content_login_wall_pages += 1;
    }
    if (md.length > 80 && !isLinkedInLoginWallMarkdown(md)) {
      for (const jobUrl of extractIndividualJobUrlsFromText(md)) {
        found.add(jobUrl);
      }
      for (const post of extractLinkedInPostsFromContentMarkdown(md)) {
        const key = (post.post_url ?? post.post_text.slice(0, 200)).toLowerCase();
        if (seenPosts.has(key)) {
          continue;
        }
        seenPosts.add(key);
        posts.push(post);
        if (posts.length >= maxPosts) {
          break;
        }
      }
    }
    if (posts.length >= maxPosts) {
      break;
    }
  }

  let search_posts_added = 0;
  if (linkedinSearchFallbackEnabled() && posts.length < Math.min(2, maxPosts)) {
    const before = posts.length;
    const fromSearch = await discoverLinkedInPostsFromSearch(firecrawlApiKeys, budget);
    posts = mergeLinkedInPosts(posts, fromSearch).slice(0, maxPosts);
    search_posts_added = Math.max(0, posts.length - before);
  }

  return {
    job_urls: [...found],
    posts: posts.slice(0, maxPosts),
    content_pages_scraped: scraped,
    search_urls: searchUrls.slice(0, maxPages),
    content_scrape_chars,
    content_login_wall_pages,
    search_posts_added,
  };
}

type DiscoverDetailResult = {
  urls: string[];
  linkedin_provider:
    | 'apify'
    | 'firecrawl'
    | 'apify_firecrawl_fallback'
    | 'apify_firecrawl_posts_fallback';
  linkedin_content_pages_scraped: number;
  linkedin_content_search_urls: string[];
  linkedin_content_job_urls: number;
  linkedin_content_urls: string[];
  linkedin_content_posts: LinkedInContentPost[];
  linkedin_content_posts_found: number;
  linkedin_content_scrape_chars: number[];
  linkedin_content_login_wall_pages: number;
  linkedin_search_posts_added: number;
  linkedin_jobs_listing_url: string;
  linkedin_jobs_listing_jobs: ExtractedJob[];
  linkedin_jobs_listing_found: number;
  linkedin_jobs_listing_scrape_chars: number;
  linkedin_jobs_listing_login_wall: boolean;
  apify_jobs_run_id: string | null;
  apify_posts_run_id: string | null;
  apify_jobs_count: number;
  apify_posts_raw_count: number;
  apify_posts_count: number;
  apify_jobs_error: string | null;
  apify_posts_error: string | null;
  linkedin_post_preset: string | null;
  linkedin_post_preset_label: string | null;
  linkedin_search_queries_used: string[];
  /** Naukri channel: hub URLs actually scraped (24h hub + any extra pages, plus legacy fallback when used). */
  naukri_hub_urls_scraped?: string[];
  /** Naukri channel: true when the legacy unfiltered hub had to be scraped because the 24h hub returned no URLs. */
  naukri_used_legacy_hub_fallback?: boolean;
  /** Naukri channel: true when the legacy `firecrawl search` queries were also run (opt-in, FETCH_NAUKRI_USE_SEARCH=true). */
  naukri_used_search_fallback?: boolean;
  /** Naukri channel: jobs returned directly from Apify (api-empire~naukri-job-scraper). */
  naukri_listing_jobs?: ExtractedJob[];
  naukri_provider?: 'apify' | 'firecrawl';
  apify_naukri_run_id?: string | null;
  apify_naukri_count?: number;
  apify_naukri_raw_count?: number;
  apify_naukri_error?: string | null;
  naukri_search_url?: string | null;
};

async function discoverLinkedInViaFirecrawl(
  firecrawlApiKeys: string[],
  budget: FetchBudget | undefined,
  fetchInstant: string,
  found: Set<string>,
): Promise<{
  linkedinContentPages: number;
  linkedinContentSearchUrls: string[];
  linkedinContentJobUrls: number;
  linkedinContentUrls: string[];
  linkedinContentPosts: LinkedInContentPost[];
  linkedinContentScrapeChars: number[];
  linkedinContentLoginWallPages: number;
  linkedinSearchPostsAdded: number;
  linkedinJobsListingUrl: string;
  linkedinJobsListingJobs: ExtractedJob[];
  linkedinJobsListingScrapeChars: number;
  linkedinJobsListingLoginWall: boolean;
}> {
  const limitPerQuery = Math.min(
    6,
    Number(Deno.env.get('FETCH_JOB_DETAIL_SEARCH_LIMIT') ?? '5') || 5,
  );
  let linkedinContentPages = 0;
  let linkedinContentSearchUrls: string[] = [];
  let linkedinContentJobUrls = 0;
  let linkedinContentUrls: string[] = [];
  let linkedinContentPosts: LinkedInContentPost[] = [];
  let linkedinContentScrapeChars: number[] = [];
  let linkedinContentLoginWallPages = 0;
  let linkedinSearchPostsAdded = 0;
  let linkedinJobsListingUrl = '';
  let linkedinJobsListingJobs: ExtractedJob[] = [];
  let linkedinJobsListingScrapeChars = 0;
  let linkedinJobsListingLoginWall = false;

  if (linkedInJobsListingEnabled()) {
    const listing = await discoverLinkedInJobsListing(firecrawlApiKeys, budget, fetchInstant);
    linkedinJobsListingUrl = listing.url;
    linkedinJobsListingJobs = listing.jobs;
    linkedinJobsListingScrapeChars = listing.scrape_chars;
    linkedinJobsListingLoginWall = listing.login_wall;
    for (const u of listing.job_urls) {
      found.add(u);
    }
    for (const job of listing.jobs) {
      const apply = job.apply_url ?? '';
      if (apply.includes('/jobs/view/')) {
        const n = normalizeExtractedJobUrl(apply);
        if (n) {
          found.add(n);
        }
      }
    }
  }

  const useLinkedInContent =
    (Deno.env.get('FETCH_LINKEDIN_CONTENT_24H') ?? 'true').toLowerCase() !== 'false';

  if (useLinkedInContent) {
    const content = await discoverLinkedInContent(firecrawlApiKeys, budget);
    linkedinContentPages = content.content_pages_scraped;
    linkedinContentSearchUrls = content.search_urls;
    linkedinContentUrls = content.job_urls;
    linkedinContentPosts = content.posts;
    linkedinContentScrapeChars = content.content_scrape_chars;
    linkedinContentLoginWallPages = content.content_login_wall_pages;
    linkedinSearchPostsAdded = content.search_posts_added;
    for (const u of content.job_urls) {
      found.add(u);
    }
    linkedinContentJobUrls = content.job_urls.length;
  } else if (linkedinSearchFallbackEnabled()) {
    linkedinContentPosts = await discoverLinkedInPostsFromSearch(firecrawlApiKeys, budget);
    linkedinSearchPostsAdded = linkedinContentPosts.length;
  }

  const minLinkedInFromContent = Math.max(
    1,
    Number(Deno.env.get('FETCH_LINKEDIN_CONTENT_MIN_URLS') ?? '1') || 1,
  );
  const skipJobViewDiscover =
    linkedinContentPosts.length >= 3 &&
    (Deno.env.get('FETCH_LINKEDIN_SKIP_JOB_VIEW_DISCOVER') ?? 'true').toLowerCase() !== 'false';
  if (!skipJobViewDiscover && (!useLinkedInContent || found.size < minLinkedInFromContent)) {
    const fromLiSearch = await firecrawlSearchQueries(
      LINKEDIN_DETAIL_SEARCH_QUERIES,
      limitPerQuery,
      firecrawlApiKeys,
    );
    for (const u of fromLiSearch) {
      found.add(u);
    }
  }

  return {
    linkedinContentPages,
    linkedinContentSearchUrls,
    linkedinContentJobUrls,
    linkedinContentUrls,
    linkedinContentPosts,
    linkedinContentScrapeChars,
    linkedinContentLoginWallPages,
    linkedinSearchPostsAdded,
    linkedinJobsListingUrl,
    linkedinJobsListingJobs,
    linkedinJobsListingScrapeChars,
    linkedinJobsListingLoginWall,
  };
}

/** One admin button → one channel; uses channel-scoped API keys when set. */
async function discoverDetailUrlsForChannel(
  channel: FetchChannel,
  budget?: FetchBudget,
  linkedInPostPreset?: ResolvedLinkedInPostPreset,
): Promise<DiscoverDetailResult> {
  const firecrawlApiKeys = getFirecrawlApiKeys(channel);
  const fetchInstant = new Date().toISOString();
  const found = new Set<string>();
  const emptyMeta = {
    linkedin_provider: 'firecrawl' as const,
    linkedin_content_pages_scraped: 0,
    linkedin_content_search_urls: [] as string[],
    linkedin_content_job_urls: 0,
    linkedin_content_urls: [] as string[],
    linkedin_content_posts: [] as LinkedInContentPost[],
    linkedin_content_posts_found: 0,
    linkedin_content_scrape_chars: [] as number[],
    linkedin_content_login_wall_pages: 0,
    linkedin_search_posts_added: 0,
    linkedin_jobs_listing_url: LINKEDIN_VIZAG_24H_JOBS_LISTING_URL,
    linkedin_jobs_listing_jobs: [] as ExtractedJob[],
    linkedin_jobs_listing_found: 0,
    linkedin_jobs_listing_scrape_chars: 0,
    linkedin_jobs_listing_login_wall: false,
    apify_jobs_run_id: null as string | null,
    apify_posts_run_id: null as string | null,
    apify_jobs_count: 0,
    apify_posts_raw_count: 0,
    apify_posts_count: 0,
    apify_jobs_error: null as string | null,
    apify_posts_error: null as string | null,
    linkedin_post_preset: null as string | null,
    linkedin_post_preset_label: null as string | null,
    linkedin_search_queries_used: [] as string[],
    naukri_hub_urls_scraped: [] as string[],
    naukri_used_legacy_hub_fallback: false,
    naukri_used_search_fallback: false,
  };

  if (channel === 'naukri') {
    const naukriProviderMode = getNaukriProvider();
    const naukriToken = getApifyTokenForNaukri();
    const useApify =
      (naukriProviderMode === 'apify' || naukriProviderMode === 'apify_then_firecrawl') &&
      Boolean(naukriToken);

    let naukriListingJobs: ExtractedJob[] = [];
    let apify_naukri_run_id: string | null = null;
    let apify_naukri_count = 0;
    let apify_naukri_raw_count = 0;
    let apify_naukri_error: string | null = null;
    let naukri_search_url: string | null = null;
    let naukri_provider: 'apify' | 'firecrawl' = 'firecrawl';

    if (useApify) {
      const apifyResult = await discoverNaukriViaApify(budget, fetchInstant);
      naukriListingJobs = apifyResult.jobs as ExtractedJob[];
      apify_naukri_run_id = apifyResult.apify_naukri_run_id;
      apify_naukri_count = apifyResult.apify_naukri_count;
      apify_naukri_raw_count = apifyResult.apify_naukri_raw_count;
      apify_naukri_error = apifyResult.apify_naukri_error;
      naukri_search_url = apifyResult.naukri_search_url;
      naukri_provider = 'apify';
      // Only queue URLs for Firecrawl when Apify returned no usable mapped jobs.
      if (naukriListingJobs.length === 0) {
        for (const u of apifyResult.job_urls) {
          found.add(u);
        }
      }
    }

    const shouldRunFirecrawl =
      firecrawlApiKeys.length > 0 &&
      (naukriProviderMode === 'firecrawl' ||
        (naukriProviderMode === 'apify_then_firecrawl' &&
          naukriListingJobs.length === 0 &&
          naukriApifyFallbackEnabled()) ||
        (!naukriToken && naukriProviderMode !== 'apify'));

    if (!useApify && !shouldRunFirecrawl) {
      return {
        urls: [...found],
        ...emptyMeta,
        naukri_listing_jobs: naukriListingJobs,
        naukri_provider,
        apify_naukri_run_id,
        apify_naukri_count,
        apify_naukri_raw_count,
        apify_naukri_error:
          apify_naukri_error ??
          'Set APIFY_API_TOKEN_NAUKRI (recommended) or FIRECRAWL_API_KEY_NAUKRI',
        naukri_search_url,
      };
    }

    const hubUrlsScraped: string[] = [];
    let usedLegacyHub = false;

    if (shouldRunFirecrawl) {
      naukri_provider = useApify && naukriListingJobs.length > 0 ? 'apify' : 'firecrawl';

      const hubPages = Math.min(
        5,
        Math.max(1, Number(Deno.env.get('FETCH_NAUKRI_HUB_PAGES') ?? '1') || 1),
      );
      const hubUrlsPlanned: string[] = [];
      for (let page = 1; page <= hubPages; page += 1) {
        hubUrlsPlanned.push(naukriHubUrlForPage(NAUKRI_VIZAG_24H_HUB_URL, page));
      }

      // Firecrawl fallback: scrape the curated 24h hub when Apify is off or returned nothing.
      for (const hubUrl of hubUrlsPlanned) {
        if (budget && !budget.hasTime(20_000)) {
          break;
        }
        const hubMd = await firecrawlScrapeUrl(hubUrl, firecrawlApiKeys);
        hubUrlsScraped.push(hubUrl);
        if (hubMd.length > 200) {
          for (const u of extractIndividualJobUrlsFromText(hubMd)) {
            if (
              /naukri\.com/i.test(u) &&
              looksLikeIndividualJobApplyUrl(u) &&
              isNaukriVizagJob({ source_url: u, apply_url: u })
            ) {
              found.add(u);
            }
          }
        }
      }

      if (found.size === 0 && naukriListingJobs.length === 0 && (!budget || budget.hasTime(20_000))) {
        const hubMd = await firecrawlScrapeUrl(NAUKRI_VIZAG_HUB_URL, firecrawlApiKeys);
        hubUrlsScraped.push(NAUKRI_VIZAG_HUB_URL);
        usedLegacyHub = true;
        if (hubMd.length > 200) {
          for (const u of extractIndividualJobUrlsFromText(hubMd)) {
            if (
              /naukri\.com/i.test(u) &&
              looksLikeIndividualJobApplyUrl(u) &&
              isNaukriVizagJob({ source_url: u, apply_url: u })
            ) {
              found.add(u);
            }
          }
        }
      }

      const useSearch =
        (Deno.env.get('FETCH_NAUKRI_USE_SEARCH') ?? 'false').toLowerCase() === 'true';
      if (useSearch) {
        const limitPerQuery = Math.min(
          10,
          Number(Deno.env.get('FETCH_JOB_DETAIL_SEARCH_LIMIT') ?? '8') || 8,
        );
        const fromNaukri = await firecrawlSearchQueries(
          NAUKRI_DETAIL_SEARCH_QUERIES,
          limitPerQuery,
          firecrawlApiKeys,
        );
        for (const u of fromNaukri) {
          found.add(u);
        }
      }

      return {
        urls: [...found],
        ...emptyMeta,
        naukri_listing_jobs: naukriListingJobs,
        naukri_provider,
        apify_naukri_run_id,
        apify_naukri_count,
        apify_naukri_raw_count,
        apify_naukri_error,
        naukri_search_url,
        naukri_hub_urls_scraped: hubUrlsScraped,
        naukri_used_legacy_hub_fallback: usedLegacyHub,
        naukri_used_search_fallback: useSearch,
      };
    }

    return {
      urls: [...found],
      ...emptyMeta,
      naukri_listing_jobs: naukriListingJobs,
      naukri_provider,
      apify_naukri_run_id,
      apify_naukri_count,
      apify_naukri_raw_count,
      apify_naukri_error,
      naukri_search_url,
      naukri_hub_urls_scraped: hubUrlsScraped,
      naukri_used_legacy_hub_fallback: usedLegacyHub,
      naukri_used_search_fallback: false,
    };
  }

  if (channel === 'indeed') {
    if (firecrawlApiKeys.length === 0) {
      return {
        urls: [],
        ...emptyMeta,
        apify_posts_error: 'FIRECRAWL_API_KEY_INDEED (or FIRECRAWL_API_KEY / FIRECRAWL_API_KEYS) not set',
      };
    }
    const limitPerQuery = Math.min(
      6,
      Number(Deno.env.get('FETCH_JOB_DETAIL_SEARCH_LIMIT') ?? '5') || 5,
    );
    const fromIndeed = await firecrawlSearchQueriesFiltered(
      INDEED_SEARCH_QUERIES,
      limitPerQuery,
      firecrawlApiKeys,
      (url) => looksLikeIndeedJobUrl(url),
    );
    for (const u of fromIndeed) {
      found.add(u);
    }
    return { urls: [...found], ...emptyMeta };
  }

  if (channel === 'vizag_it') {
    if (firecrawlApiKeys.length === 0) {
      return {
        urls: [],
        ...emptyMeta,
        apify_posts_error: 'FIRECRAWL_API_KEY_VIZAG_IT (or FIRECRAWL_API_KEY / FIRECRAWL_API_KEYS) not set',
      };
    }
    const limitPerQuery = Math.min(
      6,
      Number(Deno.env.get('FETCH_JOB_DETAIL_SEARCH_LIMIT') ?? '5') || 5,
    );
    const fromIt = await firecrawlSearchQueries(
      VIZAG_IT_SEARCH_QUERIES,
      limitPerQuery,
      firecrawlApiKeys,
    );
    for (const u of fromIt) {
      found.add(u);
    }
    return { urls: [...found], ...emptyMeta };
  }

  if (channel === 'linkedin_jobs') {
    const linkedinProviderMode = getLinkedInProvider();
    const useApify =
      linkedinProviderMode === 'apify' || linkedinProviderMode === 'apify_then_firecrawl';
    const jobsToken = getApifyTokenForRole('jobs');

    let meta = { ...emptyMeta };
    if (useApify && jobsToken) {
      validateApifyEnvJsonSecrets();
      const apifyResult = await discoverLinkedInViaApify(budget, fetchInstant, 'jobs_only');
      meta = {
        ...meta,
        linkedin_provider: 'apify',
        linkedin_jobs_listing_jobs: apifyResult.jobs as ExtractedJob[],
        linkedin_jobs_listing_found: apifyResult.apify_jobs_count,
        apify_jobs_run_id: apifyResult.apify_jobs_run_id,
        apify_jobs_count: apifyResult.apify_jobs_count,
        apify_jobs_error: apifyResult.apify_jobs_error,
        apify_posts_error: null,
      };
      for (const u of apifyResult.job_urls) {
        found.add(u);
      }
    } else if (firecrawlApiKeys.length > 0) {
      const fc = await discoverLinkedInViaFirecrawl(firecrawlApiKeys, budget, fetchInstant, found);
      meta = {
        ...meta,
        linkedin_provider: 'firecrawl',
        linkedin_jobs_listing_url: fc.linkedinJobsListingUrl,
        linkedin_jobs_listing_jobs: fc.linkedinJobsListingJobs,
        linkedin_jobs_listing_found: fc.linkedinJobsListingJobs.length,
        linkedin_jobs_listing_scrape_chars: fc.linkedinJobsListingScrapeChars,
        linkedin_jobs_listing_login_wall: fc.linkedinJobsListingLoginWall,
      };
    } else {
      return {
        urls: [],
        ...meta,
        apify_jobs_error: 'Set APIFY_API_TOKEN_LINKEDIN_JOBS or FIRECRAWL_API_KEY_LINKEDIN_JOBS',
      };
    }
    return { urls: [...found], ...meta };
  }

  if (channel === 'linkedin_posts') {
    const preset = linkedInPostPreset ?? resolveLinkedInPostPreset('general');
    const linkedinProviderMode = getLinkedInProvider();
    const useApify =
      linkedinProviderMode === 'apify' || linkedinProviderMode === 'apify_then_firecrawl';
    const postsToken = getApifyTokenForRole('posts');

    let meta = {
      ...emptyMeta,
      linkedin_content_search_urls: getLinkedInContentSearchUrls(preset),
      linkedin_post_preset: preset.id,
      linkedin_post_preset_label: preset.label,
      linkedin_search_queries_used: resolvePostSearchQueries(preset),
    };
    let linkedinContentPosts: LinkedInContentPost[] = [];
    let apify_posts_raw_count = 0;
    let apify_posts_count = 0;

    if (useApify && postsToken) {
      validateApifyEnvJsonSecrets();
      const apifyResult = await discoverLinkedInViaApify(budget, fetchInstant, 'posts_only', preset);
      linkedinContentPosts = apifyResult.posts as LinkedInContentPost[];
      apify_posts_raw_count = apifyResult.apify_posts_raw_count;
      apify_posts_count = apifyResult.apify_posts_count;
      meta = {
        ...meta,
        linkedin_provider: 'apify',
        linkedin_content_search_urls: apifyResult.linkedin_content_search_urls,
        linkedin_content_posts: linkedinContentPosts,
        linkedin_content_posts_found: linkedinContentPosts.length,
        apify_posts_run_id: apifyResult.apify_posts_run_id,
        apify_posts_raw_count,
        apify_posts_count,
        apify_posts_error: apifyResult.apify_posts_error,
        linkedin_search_queries_used: resolvePostSearchQueries(preset),
      };
    }

    if (linkedinContentPosts.length === 0) {
      const postsErr = meta.apify_posts_error;
      meta = {
        ...meta,
        apify_posts_error: !postsToken
          ? 'Set APIFY_API_TOKEN (or APIFY_API_TOKEN_LINKEDIN_POSTS) for LinkedIn posts. Firecrawl cannot scrape linkedin.com (403).'
          : postsErr ??
            'Apify returned 0 posts for this preset. Check the actor run in Apify console, try another preset, or verify APIFY_LINKEDIN_VIZAG_POSTS_ACTOR (default: harvestapi~linkedin-post-search).',
      };
    }

    if (!postsToken) {
      return {
        urls: [],
        ...meta,
        apify_posts_error:
          meta.apify_posts_error ??
          'Set APIFY_API_TOKEN (or APIFY_API_TOKEN_LINKEDIN_POSTS) for LinkedIn posts. Firecrawl cannot scrape linkedin.com (403).',
      };
    }

    return { urls: [...found], ...meta };
  }

  return { urls: [], ...emptyMeta };
}

function looksLikeVizagItRole(job: ExtractedJob): boolean {
  const blob = [job.title, job.company, job.summary, job.location, job.description_markdown]
    .filter(Boolean)
    .join(' ');
  if (!mentionsVizagContext(job)) {
    return false;
  }
  return /\b(it|software|developer|engineer|tech|java|python|full[\s-]?stack|data|cloud|devops|php|react|angular|\.net|digital|sap|erp|cyber|network|system|analyst|programmer|tester|qa|ui[\s/]?ux|ml|ai|bpo|kpo|intern)\b/i
    .test(blob);
}

/** LinkedIn via Apify (preferred) or Firecrawl; Naukri always Firecrawl when enabled. */
async function discoverDetailUrlsForFetch(
  firecrawlApiKeys: string[],
  budget?: FetchBudget,
): Promise<DiscoverDetailResult> {
  const found = new Set<string>();
  const fetchInstant = new Date().toISOString();
  const linkedinProviderMode = getLinkedInProvider();
  const useApify =
    linkedinProviderMode === 'apify' || linkedinProviderMode === 'apify_then_firecrawl';

  let linkedin_provider:
    | 'apify'
    | 'firecrawl'
    | 'apify_firecrawl_fallback'
    | 'apify_firecrawl_posts_fallback' = 'firecrawl';
  let linkedinContentPages = 0;
  let linkedinContentSearchUrls: string[] = [LINKEDIN_VIZAG_24H_CONTENT_URL];
  let linkedinContentJobUrls = 0;
  let linkedinContentUrls: string[] = [];
  let linkedinContentPosts: LinkedInContentPost[] = [];
  let linkedinContentScrapeChars: number[] = [];
  let linkedinContentLoginWallPages = 0;
  let linkedinSearchPostsAdded = 0;
  let linkedinJobsListingUrl = LINKEDIN_VIZAG_24H_JOBS_LISTING_URL;
  let linkedinJobsListingJobs: ExtractedJob[] = [];
  let linkedinJobsListingScrapeChars = 0;
  let linkedinJobsListingLoginWall = false;
  let apify_jobs_run_id: string | null = null;
  let apify_posts_run_id: string | null = null;
  let apify_jobs_count = 0;
  let apify_posts_raw_count = 0;
  let apify_posts_count = 0;
  let apify_jobs_error: string | null = null;
  let apify_posts_error: string | null = null;

  let apifySucceeded = false;
  if (useApify && getApifyToken()) {
    const apifyResult = await discoverLinkedInViaApify(budget, fetchInstant);
    linkedin_provider = 'apify';
    if (apifyResult.linkedin_content_search_urls.length > 0) {
      linkedinContentSearchUrls = apifyResult.linkedin_content_search_urls;
    }
    linkedinJobsListingJobs = apifyResult.jobs as ExtractedJob[];
    linkedinContentPosts = apifyResult.posts as LinkedInContentPost[];
    apify_jobs_run_id = apifyResult.apify_jobs_run_id;
    apify_posts_run_id = apifyResult.apify_posts_run_id;
    apify_jobs_count = apifyResult.apify_jobs_count;
    apify_posts_raw_count = apifyResult.apify_posts_raw_count;
    apify_posts_count = apifyResult.apify_posts_count;
    apify_jobs_error = apifyResult.apify_jobs_error;
    apify_posts_error = apifyResult.apify_posts_error;
    for (const u of apifyResult.job_urls) {
      found.add(u);
    }
    apifySucceeded = apifyResult.apify_jobs_count > 0 || apifyResult.apify_posts_count > 0;
  }

  const postsApifyToken = getApifyTokenForRole('posts');
  const shouldRunFirecrawlPostsOnly =
    firecrawlApiKeys.length > 0 &&
    useApify &&
    apify_posts_count === 0 &&
    shouldUseFirecrawlLinkedInPostsFallback(Boolean(postsApifyToken)) &&
    (Deno.env.get('FETCH_LINKEDIN_CONTENT_24H') ?? 'true').toLowerCase() !== 'false';

  if (shouldRunFirecrawlPostsOnly) {
    const content = await discoverLinkedInContent(firecrawlApiKeys, budget);
    if (content.posts.length > 0) {
      linkedin_provider = 'apify_firecrawl_posts_fallback';
      linkedinContentPosts = content.posts;
      linkedinContentPages = content.content_pages_scraped;
      linkedinContentSearchUrls = content.search_urls;
      linkedinContentScrapeChars = content.content_scrape_chars;
      linkedinContentLoginWallPages = content.content_login_wall_pages;
      linkedinSearchPostsAdded = content.search_posts_added;
      linkedinContentJobUrls = content.job_urls.length;
      for (const u of content.job_urls) {
        found.add(u);
      }
      apify_posts_error = apify_posts_error
        ? `${apify_posts_error} Firecrawl posts fallback found ${content.posts.length} post(s).`
        : null;
    } else if (content.content_login_wall_pages > 0) {
      apify_posts_error = apify_posts_error
        ? `${apify_posts_error} Firecrawl content scrape hit login wall.`
        : 'Firecrawl content scrape hit LinkedIn login wall; set FETCH_LINKEDIN_SEARCH_POSTS=true or use harvestapi~linkedin-post-search on Apify.';
    }
  }

  const apifyBlockedFallback = apifyErrorsBlockFirecrawlFallback(apify_jobs_error, apify_posts_error);
  const shouldRunFirecrawlLinkedIn =
    firecrawlApiKeys.length > 0 &&
    !apifyBlockedFallback &&
    (linkedinProviderMode === 'firecrawl' ||
      (linkedinProviderMode === 'apify_then_firecrawl' && !apifySucceeded) ||
      (linkedinProviderMode === 'apify' && !apifySucceeded && linkedInApifyFallbackEnabled()));

  if (shouldRunFirecrawlLinkedIn) {
    linkedin_provider = useApify && getApifyToken() ? 'apify_firecrawl_fallback' : 'firecrawl';
    const fc = await discoverLinkedInViaFirecrawl(firecrawlApiKeys, budget, fetchInstant, found);
    linkedinContentPages = fc.linkedinContentPages;
    linkedinContentSearchUrls = fc.linkedinContentSearchUrls;
    linkedinContentJobUrls = fc.linkedinContentJobUrls;
    linkedinContentUrls = fc.linkedinContentUrls;
    linkedinContentPosts = fc.linkedinContentPosts;
    linkedinContentScrapeChars = fc.linkedinContentScrapeChars;
    linkedinContentLoginWallPages = fc.linkedinContentLoginWallPages;
    linkedinSearchPostsAdded = fc.linkedinSearchPostsAdded;
    if (fc.linkedinJobsListingJobs.length > 0 || apify_jobs_count === 0) {
      linkedinJobsListingUrl = fc.linkedinJobsListingUrl || linkedinJobsListingUrl;
      linkedinJobsListingJobs =
        fc.linkedinJobsListingJobs.length > 0 ? fc.linkedinJobsListingJobs : linkedinJobsListingJobs;
      linkedinJobsListingScrapeChars = fc.linkedinJobsListingScrapeChars;
      linkedinJobsListingLoginWall = fc.linkedinJobsListingLoginWall;
    }
  }

  const sourceMode = getFetchSourcesMode();
  if ((sourceMode === 'naukri' || sourceMode === 'both') && firecrawlApiKeys.length > 0) {
    const limitPerQuery = Math.min(
      6,
      Number(Deno.env.get('FETCH_JOB_DETAIL_SEARCH_LIMIT') ?? '5') || 5,
    );
    const fromNaukri = await firecrawlSearchQueries(NAUKRI_DETAIL_SEARCH_QUERIES, limitPerQuery, firecrawlApiKeys);
    for (const u of fromNaukri) {
      found.add(u);
    }
  }

  const baseMeta = {
    linkedin_provider,
    linkedin_content_pages_scraped: linkedinContentPages,
    linkedin_content_search_urls: linkedinContentSearchUrls,
    linkedin_content_job_urls: linkedinContentJobUrls,
    linkedin_content_urls: linkedinContentUrls,
    linkedin_content_posts: linkedinContentPosts,
    linkedin_content_posts_found: linkedinContentPosts.length,
    linkedin_content_scrape_chars: linkedinContentScrapeChars,
    linkedin_content_login_wall_pages: linkedinContentLoginWallPages,
    linkedin_search_posts_added: linkedinSearchPostsAdded,
    linkedin_jobs_listing_url: linkedinJobsListingUrl,
    linkedin_jobs_listing_jobs: linkedinJobsListingJobs,
    linkedin_jobs_listing_found: linkedinJobsListingJobs.length,
    linkedin_jobs_listing_scrape_chars: linkedinJobsListingScrapeChars,
    linkedin_jobs_listing_login_wall: linkedinJobsListingLoginWall,
    apify_jobs_run_id,
    apify_posts_run_id,
    apify_jobs_count,
    apify_posts_raw_count,
    apify_posts_count,
    apify_jobs_error,
    apify_posts_error,
  };

  if (sourceMode === 'linkedin') {
    return {
      urls: [...found].filter((u) => u.includes('linkedin.com')),
      ...baseMeta,
    };
  }

  return {
    urls: [...found],
    ...baseMeta,
  };
}

async function searchDetailUrlsOnly(firecrawlApiKeys: string[]): Promise<string[]> {
  const r = await discoverDetailUrlsForFetch(firecrawlApiKeys, undefined);
  return r.urls;
}

function discoverDetailUrlsFromHits(hits: RawHit[]): string[] {
  const corpus = hits
    .map((h) => [h.markdown, h.content, h.description, h.title, h.url].filter(Boolean).join('\n'))
    .join('\n\n');
  const fromMarkdown = extractIndividualJobUrlsFromText(corpus);
  const fromHits = hits
    .map((h) => normalizeExtractedJobUrl(h.url))
    .filter((u): u is string => Boolean(u && looksLikeIndividualJobApplyUrl(u)));
  return [...new Set([...fromHits, ...fromMarkdown])];
}

async function discoverAllDetailUrls(firecrawlApiKeys: string[]): Promise<string[]> {
  const { hits } = await collectViaFirecrawl(firecrawlApiKeys);
  const fromHits = discoverDetailUrlsFromHits(hits);
  const fromSearch = await searchDetailUrlsOnly(firecrawlApiKeys);
  return [...new Set([...fromHits, ...fromSearch])];
}

async function scrapeDetailUrlsToJobs(
  urls: string[],
  firecrawlApiKeys: string[],
  scrapedAt: string,
  budget?: FetchBudget,
  linkedinContent24hUrls?: Set<string>,
): Promise<{
  jobs: ExtractedJob[];
  failed_urls: string[];
  stats: { attempted: number; succeeded: number; failed: number };
}> {
  const jobs: ExtractedJob[] = [];
  const failed_urls: string[] = [];

  for (const url of urls) {
    if (budget && !budget.hasTime(22_000)) {
      break;
    }
    let md = '';
    try {
      md = await firecrawlScrapeUrl(url, firecrawlApiKeys);
    } catch {
      failed_urls.push(url);
      continue;
    }

    if (url.includes('naukri.com') && isNaukriSearchResultsMarkdown(md)) {
      const childUrls = extractIndividualJobUrlsFromText(md)
        .filter((u) => u.includes('naukri.com') && u.includes('job-listings'))
        .slice(0, 10);
      for (const childUrl of childUrls) {
        if (budget && !budget.hasTime(22_000)) {
          break;
        }
        let childMd = '';
        try {
          childMd = await firecrawlScrapeUrl(childUrl, firecrawlApiKeys);
        } catch {
          continue;
        }
        if (!isNaukriJobDetailMarkdown(childMd)) {
          continue;
        }
        const childFields = parseJobFieldsFromUrl(childUrl);
        const childRecord = mergeJobRecord(childUrl, childFields, childMd, scrapedAt);
        if (childRecord && (childRecord.scrape_chars ?? 0) > 80) {
          jobs.push(childRecord);
        }
      }
      failed_urls.push(url);
      continue;
    }

    if (url.includes('naukri.com') && md.length > 0 && !isNaukriJobDetailMarkdown(md)) {
      failed_urls.push(url);
      continue;
    }

    const slugFields = parseJobFieldsFromUrl(url);
    let record = mergeJobRecord(url, slugFields, md, scrapedAt);

    if (!record) {
      failed_urls.push(url);
      continue;
    }

    const scrapeOk = (record.scrape_chars ?? 0) > 80;
    const slugOk = Boolean(slugFields);

    if (!scrapeOk && slugOk) {
      record = mergeJobRecord(url, slugFields, '', scrapedAt) ?? record;
    }

    const linkedInSlugOk =
      url.includes('linkedin.com') &&
      isUsableJobTitle(record.title) &&
      record.title !== 'Job opening';
    const naukriTitleOk =
      !url.includes('naukri.com') ||
      (isUsableJobTitle(record.title) && record.title !== 'Job opening');
    const hasUsefulFields =
      (scrapeOk || linkedInSlugOk || (slugOk && isUsableJobTitle(record.title))) && naukriTitleOk;

    if (hasUsefulFields) {
      if (linkedinContent24hUrls?.has(url)) {
        jobs.push({ ...record, from_linkedin_content_24h: true });
      } else {
        jobs.push(record);
      }
    } else {
      failed_urls.push(url);
    }
  }

  return {
    jobs: dedupeJobs(jobs),
    failed_urls,
    stats: {
      attempted: urls.length,
      succeeded: jobs.length,
      failed: failed_urls.length,
    },
  };
}

function mentionsVizagContext(job: ExtractedJob): boolean {
  if (job.source_kind === 'linkedin_post' || job.from_linkedin_content_24h) {
    const postBlob = [job.linkedin_post_text, job.description_markdown, job.summary].filter(Boolean).join(' ');
    if (mentionsVizagInPost(postBlob) || job.from_linkedin_content_24h) {
      return true;
    }
  }
  const blob = [
    job.title,
    job.company,
    job.location ?? '',
    job.summary ?? '',
    job.linkedin_post_text ?? '',
    job.source_url,
    job.apply_url ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return (
    blob.includes('visakhapatnam') ||
    blob.includes('vishakhapatnam') ||
    blob.includes('vizag') ||
    blob.includes('andhra pradesh') ||
    blob.includes('andhra')
  );
}

/** Pull concrete job URLs out of hub SERP/list markdown (often the only place they appear). */
function normalizeExtractedJobUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (!host.endsWith('linkedin.com') && !host.endsWith('naukri.com')) {
      return null;
    }
    u.hash = '';
    if (host.endsWith('linkedin.com')) {
      u.search = '';
    }
    return u.href;
  } catch {
    return null;
  }
}

function extractIndividualJobUrlsFromText(text: string): string[] {
  const found = new Set<string>();

  const liMatches = text.matchAll(
    /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/jobs\/view\/(\d{7,})(?:\/[^\s"'<>)\]]*)?(?:\?[^\s"'<>)\]]*)?/gi,
  );
  for (const m of liMatches) {
    const n = normalizeExtractedJobUrl(m[0]);
    if (n) {
      found.add(n);
    }
  }

  const nkMatches = text.matchAll(
    /https?:\/\/(?:www\.)?naukri\.com\/job-listings-[a-z0-9\-]+(?:\.html)?(?:\?[^\s"'<>)\]]*)?/gi,
  );
  for (const m of nkMatches) {
    const n = normalizeExtractedJobUrl(m[0]);
    if (n) {
      found.add(n);
    }
  }

  return [...found];
}

/**
 * Hub pages rarely yield structured rows. Mine markdown for /jobs/view/ and job-listings URLs, scrape those pages.
 */
async function expandHitsWithIndividualJobPages(
  hits: RawHit[],
  firecrawlApiKeys: string[],
): Promise<{ hits: RawHit[]; urls_discovered: number; detail_pages_scraped: number }> {
  const maxDetail = Math.min(
    Math.max(4, Number(Deno.env.get('FETCH_JOB_DETAIL_SCRAPE_LIMIT') ?? '24') || 24),
    45,
  );

  const corpus = hits
    .map((h) => [h.markdown, h.content, h.description, h.title].filter(Boolean).join('\n'))
    .join('\n\n');

  const fromHitUrls: string[] = [];
  for (const h of hits) {
    const n = normalizeExtractedJobUrl(h.url);
    if (n && looksLikeIndividualJobApplyUrl(n)) {
      fromHitUrls.push(n);
    }
  }

  const fromMarkdown = extractIndividualJobUrlsFromText(corpus);
  const discoveredList = [...new Set([...fromHitUrls, ...fromMarkdown])];
  const slice = discoveredList.slice(0, maxDetail);

  if (slice.length === 0) {
    return { hits, urls_discovered: 0, detail_pages_scraped: 0 };
  }

  const detailHits: RawHit[] = [];
  for (const url of slice) {
    const md = await firecrawlScrapeUrl(url, firecrawlApiKeys);
    if (typeof md === 'string' && md.length > 120) {
      detailHits.push({ url, title: url, markdown: md });
    }
  }

  if (detailHits.length === 0) {
    return { hits, urls_discovered: discoveredList.length, detail_pages_scraped: 0 };
  }

  return {
    hits: detailHits,
    urls_discovered: discoveredList.length,
    detail_pages_scraped: detailHits.length,
  };
}

/** When hub markdown has no /jobs/view/ links, search Firecrawl for detail URLs directly. */
async function searchAndScrapeDetailPages(
  firecrawlApiKeys: string[],
): Promise<{ hits: RawHit[]; urls_from_search: number; pages_scraped: number }> {
  const limitPerQuery = Number(Deno.env.get('FETCH_JOB_DETAIL_SEARCH_LIMIT') ?? '8') || 8;
  const maxScrape = Math.min(
    Math.max(4, Number(Deno.env.get('FETCH_JOB_DETAIL_SCRAPE_LIMIT') ?? '24') || 24),
    45,
  );

  const urlMap = new Map<string, RawHit>();
  for (const query of DETAIL_SEARCH_QUERIES) {
    const rows = await firecrawlSearch(query, limitPerQuery, firecrawlApiKeys);
    for (const row of rows) {
      const normalized = normalizeExtractedJobUrl(row.url);
      if (normalized && looksLikeIndividualJobApplyUrl(normalized) && isLinkedInOrNaukriUrl(normalized)) {
        urlMap.set(normalized, { ...row, url: normalized });
      }
    }
  }

  const detailHits: RawHit[] = [];
  for (const [url, meta] of [...urlMap.entries()].slice(0, maxScrape)) {
    const md = await firecrawlScrapeUrl(url, firecrawlApiKeys);
    if (typeof md === 'string' && md.length > 120) {
      detailHits.push({
        url,
        title: meta.title,
        description: meta.description,
        markdown: md,
      });
    }
  }

  return { hits: detailHits, urls_from_search: urlMap.size, pages_scraped: detailHits.length };
}

/** Last resort: parse role lines from Firecrawl search snippets (title + description). */
async function geminiExtractFromSearchSnippets(
  hits: RawHit[],
  apiKey: string,
  referenceTimeUtc: string,
): Promise<ExtractedJob[]> {
  const snippetHits = hits
    .filter((h) => isLinkedInOrNaukriUrl(h.url))
    .filter((h) => (h.description?.trim().length ?? 0) > 30 || (h.title?.trim().length ?? 0) > 15)
    .slice(0, 25);

  if (snippetHits.length === 0) {
    return [];
  }

  const blob = snippetHits
    .map(
      (h, i) =>
        `--- SNIPPET ${i + 1} ---\nLISTING_PAGE: ${h.url}\nTITLE: ${h.title ?? ''}\nTEXT: ${h.description ?? ''}\n`,
    )
    .join('\n');

  const instruction =
    `Extract INDIVIDUAL job roles from these search snippets (LinkedIn/Naukri, Visakhapatnam/Vizag area).\n` +
    `Each bullet or "Role · Company" line in TEXT should become one job object.\n` +
    `Do NOT emit rows for the LISTING_PAGE title alone (e.g. "2328 vacancies").\n` +
    `apply_url: copy a full https URL from TEXT if it is linkedin.com/jobs/view/… or naukri.com/job-listings-…; else null.\n` +
    `source_url: LISTING_PAGE.\n` +
    `experience, company, title as visible. posted_at from TEXT vs REFERENCE_TIME_UTC ${referenceTimeUtc} or null.\n\n` +
    blob;

  return geminiExtractJobs(instruction, apiKey, referenceTimeUtc);
}

/**
 * Prefer posted date parsed from the scraped source.
 *
 * - In **strict** mode (Naukri default), returns `null` when no date can be parsed,
 *   so the downstream 24h filter drops the job. This avoids stamping undated
 *   listings as "just posted" and leaking month/year-old jobs into results.
 * - In **non-strict** mode, falls back to `fetchInstant` (legacy optimistic
 *   behavior) — keep this for sources we trust to surface only fresh listings
 *   (e.g. LinkedIn past-24h content feed).
 */
function resolvePostedAtFromSource(
  job: SiteJobRecord,
  raw: ExtractedJob | undefined,
  fetchInstant: string,
  options: { strict?: boolean } = {},
): string | null {
  if (parsePostedAt(job.posted_at)) {
    return job.posted_at!;
  }
  if (raw?.posted_at && parsePostedAt(raw.posted_at)) {
    return raw.posted_at;
  }
  const md = raw?.description_markdown ?? '';
  const phrase = extractPostedPhrase(md, raw?.summary ?? job.short_description);
  const parsed = phrase ? parseRelativePostedAt(phrase, fetchInstant) : null;
  if (parsed) {
    return parsed;
  }
  return options.strict ? null : fetchInstant;
}

function buildNaukriFetchResponse(input: {
  fetchInstant: string;
  runtimeMs: number;
  parserVersion: string;
  phaseTimings?: Record<string, number>;
  extractionDebug: Record<string, unknown>;
  siteJobs: SiteJobRecord[];
  jobsLast24h: SiteJobRecord[];
  jobsUndated: SiteJobRecord[];
  summary: FetchSummary;
  naukriFetchWarning: string | null;
  detailUrlsDiscovered: number;
  naukriUrlsDiscovered: number;
  urlsQueuedForScrape: number;
  scrapeStats: { attempted: number; succeeded: number; failed: number };
  scrapeFailedUrls: string[];
  scrapedBefore24hFilter: number;
  filteredOutOlderThan24h: number;
  requirePostedWithin24h: boolean;
  naukriHubUrlsScraped: string[];
  naukriUsedLegacyHubFallback: boolean;
  naukriUsedSearchFallback: boolean;
}): Record<string, unknown> {
  return {
    ok: true,
    fetched_at: input.fetchInstant,
    runtime_ms: input.runtimeMs,
    phase_timings_ms: input.phaseTimings,
    parser_version: input.parserVersion,
    fetch_channel: 'naukri',
    fetch_channel_label: 'Naukri',
    provider_used: 'firecrawl',
    extraction_mode: 'per_url_scrape',
    extraction_hint:
      'Naukri Vizag jobs via curated 24h hub (jobAge=1, cityTypeGid=26, functionAreaIdGid filters). Review jobs, then run Make SEO before publish.',
    extraction_debug: input.extractionDebug,
    filters_applied: {
      fetch_channel: 'naukri',
      sources: ['naukri.com'],
      location_context: ['Visakhapatnam', 'Vizag', 'Andhra Pradesh', 'Andhra'],
      require_posted_within_24h: input.requirePostedWithin24h,
      naukri_primary_hub_url: NAUKRI_VIZAG_24H_HUB_URL,
      naukri_legacy_hub_url: NAUKRI_VIZAG_HUB_URL,
      naukri_hub_urls_scraped: input.naukriHubUrlsScraped,
      naukri_used_legacy_hub_fallback: input.naukriUsedLegacyHubFallback,
      naukri_used_search_fallback: input.naukriUsedSearchFallback,
      search_queries: input.naukriUsedSearchFallback ? NAUKRI_DETAIL_SEARCH_QUERIES : [],
    },
    discovery: {
      detail_urls_discovered: input.detailUrlsDiscovered,
      naukri_urls_discovered: input.naukriUrlsDiscovered,
      urls_queued_for_scrape: input.urlsQueuedForScrape,
    },
    scrape_stats: input.scrapeStats,
    scrape_failed_urls: input.scrapeFailedUrls,
    scraped_before_24h_filter: input.scrapedBefore24hFilter,
    filtered_out_older_than_24h: input.filteredOutOlderThan24h,
    naukri_fetch_warning: input.naukriFetchWarning,
    mode: 'fetch',
    gemini_status: 'skipped',
    gemini_error: null,
    seo_optimized_count: 0,
    jobs: input.siteJobs,
    jobs_last_24h: input.jobsLast24h,
    jobs_undated: input.jobsUndated,
    summary: input.summary,
    sources_scraped: input.siteJobs.map((j) => ({
      url: j.source_url,
      title: j.title,
      company: j.company,
      experience: j.experience,
      slug: j.slug,
    })),
  };
}

function summarizeJobs(jobs: { posted_at?: string | null }[], cutoff: number): FetchSummary {
  let within = 0;
  let undated = 0;
  let older = 0;

  for (const job of jobs) {
    const ts = parsePostedAt(job.posted_at ?? null);
    if (ts === null) {
      undated += 1;
    } else if (ts >= cutoff) {
      within += 1;
    } else {
      older += 1;
    }
  }

  return {
    total: jobs.length,
    with_posted_at_within_24h: within,
    without_usable_date: undated,
    filtered_out_older_than_24h: older,
  };
}

function mapNaukriExtractedJobsToSiteJobs(
  rawJobs: ExtractedJob[],
  fetchInstant: string,
  cutoff: number,
): {
  siteJobs: SiteJobRecord[];
  jobs_last_24h: SiteJobRecord[];
  jobs_undated: SiteJobRecord[];
  filtered_out_older_than_24h: number;
  naukri_fetch_warning: string | null;
  summary: FetchSummary;
} {
  const vizagJobs = rawJobs.filter((j) => isNaukriVizagJob(j));
  const mappedBeforeDedupe = vizagJobs.map((j) => toSiteJobRecord(j, fetchInstant));
  const mappedJobs = dedupeSiteJobs(mappedBeforeDedupe);
  const sourceContextMap = buildSourceContextMap(vizagJobs);
  const naukriStrictDates =
    (Deno.env.get('FETCH_NAUKRI_STRICT_DATES') ?? 'true').toLowerCase() !== 'false';

  let siteJobs = mappedJobs.map((job) => {
    const raw = vizagJobs.find((r) => {
      const rawKey = siteJobDedupeKey(toSiteJobRecord(r, fetchInstant));
      return rawKey === siteJobDedupeKey(job);
    });
    let posted_at: string | null = job.posted_at ?? null;
    if (job.source_name === 'naukri.com') {
      posted_at = resolvePostedAtFromSource(job, raw, fetchInstant, {
        strict: naukriStrictDates,
      });
    }
    return {
      ...job,
      posted_at,
      seo_source_context: lookupSourceContext(job, sourceContextMap),
      seo_optimized: false,
      source_kind: 'naukri' as const,
    };
  });

  const require24h =
    (Deno.env.get('FETCH_REQUIRE_POSTED_WITHIN_24H') ?? 'true').toLowerCase() !== 'false';
  const before24hFilter = siteJobs.length;
  if (require24h) {
    siteJobs = siteJobs.filter((j) => isPostedWithinCutoff(j.posted_at, cutoff));
  }
  const filtered_out_older_than_24h = before24hFilter - siteJobs.length;
  const jobs_last_24h = siteJobs.filter((j) => isPostedWithinCutoff(j.posted_at, cutoff));
  const jobs_undated = siteJobs.filter((j) => {
    const ts = parsePostedAt(j.posted_at ?? null);
    return ts === null || ts < cutoff;
  });
  const summary = summarizeJobs(siteJobs, cutoff);

  const naukriInOutput = siteJobs.filter((j) => j.source_name === 'naukri.com').length;
  const naukri_fetch_warning =
    naukriInOutput === 0
      ? filtered_out_older_than_24h > 0
        ? `${filtered_out_older_than_24h} job(s) scraped but excluded: posted more than 24h ago.`
        : 'No Vizag Naukri jobs matched filters for this fetch.'
      : null;

  return {
    siteJobs,
    jobs_last_24h,
    jobs_undated,
    filtered_out_older_than_24h,
    naukri_fetch_warning,
    summary,
  };
}

async function assertAuthorized(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const cronSecret = Deno.env.get('FETCH_JOBS_CRON_SECRET');
  const altCron = req.headers.get('x-fetch-jobs-cron-secret');
  if (cronSecret && altCron === cronSecret) {
    return { ok: true };
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearer = match?.[1]?.trim() ?? '';

  if (!bearer) {
    return { ok: false, status: 401, message: 'Missing Authorization bearer token.' };
  }

  if (cronSecret && bearer === cronSecret) {
    return { ok: true };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(bearer);
  if (userError || !userData?.user?.id) {
    return { ok: false, status: 401, message: 'Invalid or expired session.' };
  }

  const { data: adminRow, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (adminError) {
    return { ok: false, status: 500, message: 'Could not verify admin access.' };
  }
  if (!adminRow?.user_id) {
    return { ok: false, status: 403, message: 'Admin access required.' };
  }

  return { ok: true };
}

function isRetryableFirecrawlError(message: string): boolean {
  return (
    /\((402|403|429|500|502|503|504)\)/.test(message) ||
    /rate limit/i.test(message) ||
    /too many requests/i.test(message) ||
    /quota/i.test(message) ||
    /credit/i.test(message) ||
    /high demand/i.test(message) ||
    /timed out/i.test(message) ||
    /abort/i.test(message)
  );
}

async function withFirecrawlKeyRotation<T>(
  apiKeys: string[],
  label: string,
  fn: (apiKey: string) => Promise<T>,
): Promise<T> {
  const pool = apiKeys.length > 0 ? shuffledCopy(apiKeys) : [];
  if (pool.length === 0) {
    throw new Error(`${label}: FIRECRAWL_API_KEY is not set.`);
  }
  const errors: string[] = [];
  for (let i = 0; i < pool.length; i += 1) {
    try {
      return await fn(pool[i]!);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`[key ${i + 1}/${pool.length}] ${msg}`);
      if (i < pool.length - 1 && isRetryableFirecrawlError(msg)) {
        await sleep(350 + Math.floor(Math.random() * 550));
        continue;
      }
      throw new Error(`${label} failed. ${errors.join(' | ')}`);
    }
  }
  throw new Error(`${label} failed. ${errors.join(' | ')}`);
}

async function firecrawlSearchOnce(
  query: string,
  limit: number,
  apiKey: string,
  options?: { scrapeMarkdown?: boolean },
): Promise<RawHit[]> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(Deno.env.get('FIRECRAWL_TIMEOUT_MS') ?? String(FIRECRAWL_TIMEOUT_MS)) || FIRECRAWL_TIMEOUT_MS,
  );

  const body: Record<string, unknown> = { query, limit };
  if (options?.scrapeMarkdown) {
    body.scrapeOptions = {
      formats: ['markdown'],
      onlyMainContent: false,
      waitFor: Number(Deno.env.get('FETCH_LINKEDIN_SCRAPE_WAIT_MS') ?? '5000') || 5000,
    };
  }

  try {
    const res = await fetch(FIRECRAWL_SEARCH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: string }).error)
          : res.statusText;
      throw new Error(`Firecrawl search failed (${res.status}): ${msg}`);
    }

    const data = payload?.data ?? payload?.results ?? payload?.web ?? [];
    const list = Array.isArray(data) ? data : [];
    return list.map((item: Record<string, unknown>) => ({
      url: String(item.url ?? item.link ?? ''),
      title: item.title ? String(item.title) : undefined,
      description: item.description ? String(item.description) : undefined,
      markdown: item.markdown ? String(item.markdown) : undefined,
      content: item.content ? String(item.content) : undefined,
    })).filter((h: RawHit) => Boolean(h.url));
  } finally {
    clearTimeout(timeout);
  }
}

async function firecrawlSearch(
  query: string,
  limit: number,
  apiKeys: string[],
  options?: { scrapeMarkdown?: boolean },
): Promise<RawHit[]> {
  return withFirecrawlKeyRotation(apiKeys, 'Firecrawl search', (apiKey) =>
    firecrawlSearchOnce(query, limit, apiKey, options),
  );
}

async function firecrawlScrapeUrlOnce(
  url: string,
  apiKey: string,
  options?: { linkedInContentSearch?: boolean; linkedInJobsListing?: boolean },
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(Deno.env.get('FIRECRAWL_TIMEOUT_MS') ?? String(FIRECRAWL_TIMEOUT_MS)) || FIRECRAWL_TIMEOUT_MS,
  );

  const isLinkedIn = url.includes('linkedin.com');
  const isLiFeedOrJobs =
    options?.linkedInContentSearch === true || options?.linkedInJobsListing === true;
  const scrapeBody: Record<string, unknown> = {
    url,
    formats: ['markdown'],
    onlyMainContent: !(isLinkedIn || isLiFeedOrJobs),
  };
  if (isLinkedIn) {
    const defaultWait = isLiFeedOrJobs ? 8_000 : 4_000;
    scrapeBody.waitFor =
      Number(Deno.env.get('FETCH_LINKEDIN_SCRAPE_WAIT_MS') ?? String(defaultWait)) || defaultWait;
  }

  try {
    const res = await fetch(FIRECRAWL_SCRAPE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scrapeBody),
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: string }).error)
          : res.statusText;
      throw new Error(`Firecrawl scrape failed (${res.status}): ${msg}`);
    }
    const data = payload?.data ?? payload;
    const md = data?.markdown ?? data?.content ?? '';
    return typeof md === 'string' ? md : '';
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('Firecrawl scrape timed out.');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

async function firecrawlScrapeUrl(
  url: string,
  apiKeys: string[],
  options?: { linkedInContentSearch?: boolean; linkedInJobsListing?: boolean },
): Promise<string> {
  return withFirecrawlKeyRotation(apiKeys, 'Firecrawl scrape', (apiKey) =>
    firecrawlScrapeUrlOnce(url, apiKey, options),
  );
}

async function scrapflyScrapeUrl(url: string, apiKey: string): Promise<string> {
  const endpoint = new URL(SCRAPFLY_SCRAPE_URL);
  endpoint.searchParams.set('key', apiKey);
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('render_js', 'true');
  endpoint.searchParams.set('asp', 'true');

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(Deno.env.get('FIRECRAWL_TIMEOUT_MS') ?? String(FIRECRAWL_TIMEOUT_MS)) || FIRECRAWL_TIMEOUT_MS,
  );

  try {
    const res = await fetch(endpoint.toString(), { signal: controller.signal });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      return '';
    }
    const html = payload?.result?.content ?? '';
    return typeof html === 'string' ? stripHtml(html) : '';
  } finally {
    clearTimeout(timeout);
  }
}

function parseQueriesEnv(): string[] {
  const raw = Deno.env.get('FETCH_JOB_SEARCH_QUERIES');
  if (!raw?.trim()) {
    return DEFAULT_SEARCH_QUERIES;
  }
  return raw
    .split(',')
    .map((q) => q.trim())
    .filter(Boolean);
}

function parseScrapflyUrlsEnv(): string[] {
  const raw = Deno.env.get('SCRAPFLY_SCRAPE_URLS');
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
}

async function collectViaFirecrawl(
  firecrawlApiKeys: string[],
): Promise<{ hits: RawHit[]; provider: 'firecrawl' }> {
  const queries = parseQueriesEnv();
  const limitPerQuery = Number(Deno.env.get('FETCH_JOB_SEARCH_LIMIT') ?? '6') || 6;
  const scrapeLimit = Math.min(
    Math.max(1, Number(Deno.env.get('FETCH_JOB_SCRAPE_PAGE_LIMIT') ?? String(DEFAULT_SCRAPE_PAGE_LIMIT)) || DEFAULT_SCRAPE_PAGE_LIMIT),
    20,
  );

  const merged = new Map<string, RawHit>();
  for (const query of queries) {
    const rows = await firecrawlSearch(query, limitPerQuery, firecrawlApiKeys);
    for (const row of rows) {
      if (!merged.has(row.url)) {
        merged.set(row.url, row);
      }
    }
  }

  const ordered = [...merged.values()]
    .filter((hit) => isLinkedInOrNaukriUrl(hit.url))
    .sort((a, b) => {
      const aDetail = looksLikeIndividualJobApplyUrl(a.url) ? 0 : 1;
      const bDetail = looksLikeIndividualJobApplyUrl(b.url) ? 0 : 1;
      return aDetail - bDetail;
    });

  const detailFromSearch = ordered.filter((h) => looksLikeIndividualJobApplyUrl(h.url));
  const hubFromSearch = ordered.filter((h) => !looksLikeIndividualJobApplyUrl(h.url));
  const maxDetailFromSearch = Math.min(detailFromSearch.length, 15);
  const enriched: RawHit[] = [];

  for (const hit of detailFromSearch.slice(0, maxDetailFromSearch)) {
    const md = await firecrawlScrapeUrl(hit.url, firecrawlApiKeys);
    enriched.push({
      ...hit,
      markdown: md || hit.markdown || hit.content || hit.description || '',
    });
  }

  for (let i = 0; i < Math.min(hubFromSearch.length, scrapeLimit); i += 1) {
    const hit = hubFromSearch[i];
    const md = await firecrawlScrapeUrl(hit.url, firecrawlApiKeys);
    enriched.push({
      ...hit,
      markdown: md || hit.markdown || hit.content || hit.description || '',
    });
  }

  for (let i = scrapeLimit; i < hubFromSearch.length; i += 1) {
    const hit = hubFromSearch[i];
    enriched.push({
      ...hit,
      markdown: hit.markdown ?? hit.content ?? hit.description ?? '',
    });
  }

  return { hits: enriched, provider: 'firecrawl' };
}

async function collectViaScrapfly(apiKey: string): Promise<{ hits: RawHit[]; provider: 'scrapfly' }> {
  const urls = parseScrapflyUrlsEnv().filter((u) => isLinkedInOrNaukriUrl(u));
  if (urls.length === 0) {
    throw new Error(
      'SCRAPFLY_SCRAPE_URLS must include at least one linkedin.com or naukri.com URL for this pipeline.',
    );
  }

  const hits: RawHit[] = [];
  for (const url of urls.slice(0, 12)) {
    const text = await scrapflyScrapeUrl(url, apiKey);
    hits.push({
      url,
      title: url,
      markdown: text ? `# Source\n${url}\n\n${text}` : '',
    });
  }

  return { hits, provider: 'scrapfly' };
}

function hitsToContextBlob(hits: RawHit[], startIndex = 0): string {
  const chunks = hits.map((hit, index) => {
    const head = [hit.title, hit.description].filter(Boolean).join('\n');
    const body = hit.markdown ?? hit.content ?? '';
    return `--- SOURCE ${startIndex + index + 1} ---\nPAGE_URL: ${hit.url}\n${head}\n\n${body}`;
  });
  return chunks.join('\n\n');
}

/** Split scraped pages into chunks so each Gemini call stays within limits and focuses on fewer URLs at once. */
function chunkHitsForGemini(hits: RawHit[], maxCharsPerChunk: number): RawHit[][] {
  const chunks: RawHit[][] = [];
  let current: RawHit[] = [];
  let size = 0;

  for (const hit of hits) {
    const one = hitsToContextBlob([hit], 0);
    const needBreak = current.length > 0 && size + one.length > maxCharsPerChunk;
    if (needBreak) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(hit);
    size += one.length;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks.length > 0 ? chunks : [[]];
}

function dedupeJobs(jobs: ExtractedJob[]): ExtractedJob[] {
  const seen = new Set<string>();
  const out: ExtractedJob[] = [];
  for (const j of jobs) {
    const title = j.title.trim().toLowerCase();
    const company = (j.company ?? '').trim().toLowerCase();
    const link = (j.apply_url ?? j.source_url ?? '').trim().toLowerCase();
    const postKey =
      j.source_kind === 'linkedin_post' && j.linkedin_post_text
        ? j.linkedin_post_text.slice(0, 180).toLowerCase()
        : '';
    const key = postKey || `${title}|${company}|${link}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(j);
  }
  return out;
}

/** SERP-style portal headings that list aggregate counts (not one role). */
function isLikelyPortalAggregate(job: ExtractedJob): boolean {
  const lower = job.title.toLowerCase();
  if (/^\d+\s+job vacancies\b/i.test(lower)) {
    return true;
  }
  if (/^\d+\s+\w+\s+jobs in\b/i.test(lower) && lower.includes('linkedin')) {
    return true;
  }
  if (/vacancies in visakhapatnam/i.test(lower) && (lower.includes('naukri') || lower.includes('indeed'))) {
    return true;
  }
  if (/jobs in visakhapatnam:\s*latest/i.test(lower)) {
    return true;
  }
  return false;
}

function filterAggregatePortalJobs(jobs: ExtractedJob[]): { kept: ExtractedJob[]; removed_count: number } {
  const kept = jobs.filter((j) => !isLikelyPortalAggregate(j));
  return { kept, removed_count: jobs.length - kept.length };
}

async function geminiExtractJobs(markdown: string, apiKey: string, referenceTimeUtc: string): Promise<ExtractedJob[]> {
  const instruction =
    `SOURCE RULES: Content comes ONLY from LinkedIn or Naukri pages about roles in/near Visakhapatnam (Vizag), Andhra Pradesh, India.\n` +
    `OUTPUT: Each array item is ONE real job posting — never a whole city landing page.\n\n` +
    `REQUIRED FIELDS:\n` +
    `- title: Job role name only (e.g. "Software Engineer", "Medical coder").\n` +
    `- company: Hiring employer name when visible; use "Unknown" only if truly absent.\n` +
    `- experience: Years or level text from the listing (e.g. "2–5 yrs", "Fresher", "3+ years"); use "Not specified" if missing.\n` +
    `- location: City/region line when stated.\n` +
    `- apply_url: Absolute HTTPS URL for THAT job's detail/apply page ONLY:\n` +
    `  LinkedIn must contain "/jobs/view/" in the path.\n` +
    `  Naukri must be a job-listings detail URL (path contains "job-listings"), NOT /jobs-in-visakhapatnam hub.\n` +
    `  Copy URLs verbatim from markdown links when present; use null only if no individual job URL exists.\n` +
    `- posted_at: ISO 8601 UTC when stated OR infer from relative phrases ("5 hours ago", "Posted yesterday", "2 days ago") using REFERENCE_TIME.\n` +
    `  REFERENCE_TIME_UTC: ${referenceTimeUtc}\n` +
    `  If age cannot be estimated, use null.\n` +
    `- summary: One short line (skills, salary, employment type) optional.\n` +
    `- source_url: PAGE_URL from the chunk for where this row was found.\n` +
    `- If PAGE_URL itself is already a single job page (/jobs/view/… or …/job-listings-…), produce ONE row for that page and set apply_url to that same URL when no separate apply link exists.\n\n` +
    `FORBIDDEN ROWS (omit entirely):\n` +
    `- Titles like "2328 Job Vacancies In Visakhapatnam - Naukri.com", "472 Visakhapatnam jobs - LinkedIn".\n` +
    `- Rows whose apply_url would be only a city/search hub.\n` +
    `- Non–LinkedIn/Naukri URLs.\n\n` +
    `If no individual postings exist in the text, return {"jobs":[]}.\n\n` +
    `--- CONTENT ---\n${markdown}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: instruction }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          jobs: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                company: { type: 'STRING' },
                experience: { type: 'STRING' },
                location: { type: 'STRING' },
                apply_url: { type: 'STRING' },
                posted_at: { type: 'STRING' },
                summary: { type: 'STRING' },
                source_url: { type: 'STRING' },
                source_name: { type: 'STRING' },
              },
              required: ['title', 'company', 'experience', 'source_url'],
            },
          },
        },
        required: ['jobs'],
      },
    },
  };

  const payload = await geminiGenerateContent(body, apiKey, 'Gemini extract');

  const candidates = payload.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  const text = candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

  if (!text.trim()) {
    throw new Error('Gemini returned no text.');
  }

  const parsed = tryParseJson<{ jobs?: ExtractedJob[] }>(text, 'gemini_extract');
  if (!parsed) {
    throw new Error('Gemini extract returned invalid JSON.');
  }
  const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
    return jobs
      .filter((j) => j && typeof j.title === 'string' && typeof j.source_url === 'string')
      .map((j) => {
        const applyRaw = typeof j.apply_url === 'string' ? j.apply_url.trim() : '';
        let applyUrl = applyRaw.length > 0 ? applyRaw : null;
        const src = String(j.source_url);
        if (!applyUrl && looksLikeIndividualJobApplyUrl(src)) {
          applyUrl = src;
        }
        return {
          title: String(j.title),
          company: typeof j.company === 'string' && j.company.trim() ? j.company : 'Unknown',
          experience:
            typeof j.experience === 'string' && j.experience.trim()
              ? j.experience.trim()
              : 'Not specified',
          location: j.location ?? null,
          apply_url: applyUrl,
          posted_at: j.posted_at ?? null,
          summary: j.summary ?? null,
          source_url: src,
          source_name: j.source_name ?? null,
        };
      });
}

async function geminiExtractJobsChunked(hits: RawHit[], apiKey: string, referenceTimeUtc: string): Promise<ExtractedJob[]> {
  const maxChunks = Math.min(
    Math.max(1, Number(Deno.env.get('FETCH_JOB_MAX_GEMINI_CHUNKS') ?? String(DEFAULT_MAX_GEMINI_CHUNKS)) ||
      DEFAULT_MAX_GEMINI_CHUNKS),
    8,
  );
  const chunks = chunkHitsForGemini(hits, MAX_GEMINI_CHUNK_CHARS).slice(0, maxChunks);
  const merged: ExtractedJob[] = [];

  for (const chunk of chunks) {
    if (chunk.length === 0) {
      continue;
    }
    const blob = hitsToContextBlob(chunk, 0);
    const extracted = await geminiExtractJobs(blob, apiKey, referenceTimeUtc);
    merged.push(...extracted);
  }

  return dedupeJobs(merged);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ ok: false, error: 'Supabase server configuration missing.' }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auth = await assertAuthorized(req, supabaseAdmin);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.message }, auth.status);
  }

  const globalFirecrawlKeys = getFirecrawlApiKeys(null);
  const scrapflyKey = Deno.env.get('SCRAPFLY_API_KEY')?.trim();
  let requestBody: FetchRequestBody = {};
  try {
    requestBody = (await req.json()) as FetchRequestBody;
  } catch {
    requestBody = {};
  }
  const modeRaw = requestBody.mode;
  const mode =
    modeRaw === 'seo' ? 'seo' : modeRaw === 'seo_keys' ? 'seo_keys' : 'fetch';
  const debugTrace = requestBody.debug_trace === true;

  if (mode === 'seo_keys') {
    const linkedInPost =
      requestBody.linkedin_post === true ||
      requestBody.job?.source_kind === 'linkedin_post';
    const slots = getGeminiKeySlotsForMakeSeo(linkedInPost);
    return jsonResponse({
      ok: true,
      mode: 'seo_keys',
      linkedin_post: linkedInPost,
      gemini_keys_total: slots.length,
      keys: geminiKeySlotsToPublicMeta(slots),
    });
  }

  if (mode === 'seo') {
    let isLinkedInPost = false;
    try {
      const rawJob = requestBody.job;
      if (!rawJob) {
        return jsonResponse({ ok: false, error: 'Missing job payload for SEO mode.' }, 400);
      }

      isLinkedInPost = rawJob.source_kind === 'linkedin_post';
      if (getGeminiApiKeysForMakeSeo(isLinkedInPost).length === 0) {
        return jsonResponse(
          {
            ok: false,
            error: isLinkedInPost
              ? 'Gemini API key required for Make SEO. Set GEMINI_API_KEY_SEO, GEMINI_API_KEY, or GEMINI_API_KEY_LINKEDIN_POSTS in Edge Function secrets.'
              : 'GEMINI_API_KEY_SEO or GEMINI_API_KEY is required for Make SEO. Add keys in Edge Function secrets.',
          },
          502,
        );
      }
      const postText = [
        typeof rawJob.linkedin_post_text === 'string' ? rawJob.linkedin_post_text.trim() : '',
        typeof rawJob.description === 'string' ? rawJob.description.trim() : '',
        typeof rawJob.short_description === 'string' ? rawJob.short_description.trim() : '',
      ].find((s) => s.length > 0) ?? '';
      const titleOk = typeof rawJob.title === 'string' && rawJob.title.trim().length > 0;
      if (!titleOk && postText.length < 40) {
        return jsonResponse(
          {
            ok: false,
            error:
              'Missing job title and post text for SEO. Re-fetch this job or paste linkedin_post_text before Make SEO.',
          },
          400,
        );
      }

      const sourceContext =
        (typeof requestBody.seo_source_context === 'string' && requestBody.seo_source_context) ||
        (typeof rawJob.seo_source_context === 'string' && rawJob.seo_source_context) ||
        postText;

      const record = stripClientReviewFields({
        ...rawJob,
        title: titleOk ? rawJob.title.trim() : 'Job opening',
        source_kind: isLinkedInPost ? 'linkedin_post' : rawJob.source_kind,
        linkedin_post_text: isLinkedInPost
          ? postText || rawJob.linkedin_post_text
          : rawJob.linkedin_post_text,
        description: postText || rawJob.description,
      });
      const seoStarted = Date.now();
      const hardCapMs = Math.min(
        isLinkedInPost ? GEMINI_SEO_LINKEDIN_HARD_CAP_MS : 125_000,
        Number(Deno.env.get('GEMINI_SEO_HARD_CAP_MS') ?? String(GEMINI_SEO_HARD_CAP_MS)) || GEMINI_SEO_HARD_CAP_MS,
      );

      const customInstructions =
        (typeof requestBody.seo_custom_instructions === 'string' && requestBody.seo_custom_instructions.trim()) ||
        (typeof rawJob.seo_custom_instructions === 'string' && rawJob.seo_custom_instructions.trim()) ||
        '';
      const preferredKeyIndex = parsePreferredGeminiKeyIndex(requestBody.gemini_key_index);

      beginMakeSeoKeyTracking(isLinkedInPost);

      console.log(
        JSON.stringify({
          event: 'gemini_seo_start',
          source_kind: record.source_kind,
          title: record.title,
          post_chars: postText.length,
          context_chars: sourceContext.length,
          custom_instructions_chars: customInstructions.length,
          gemini_key_index: preferredKeyIndex > 0 ? preferredKeyIndex : null,
          gemini_keys_configured: getGeminiKeySlotsForMakeSeo(isLinkedInPost).map((s) => s.label),
        }),
      );

      const seoResult = await Promise.race([
        geminiSeoOptimizeSiteJob(record, sourceContext, customInstructions || undefined, {
          preferredKeyIndex: preferredKeyIndex > 0 ? preferredKeyIndex : undefined,
        }),
        new Promise<GeminiSeoOptimizeResult>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  isLinkedInPost
                    ? 'LinkedIn post SEO exceeded the server time limit. Retry once; if it repeats, check Gemini quota (GEMINI_API_KEY) or Edge Function logs.'
                    : 'SEO optimization exceeded the server time limit. Retry or use a shorter job description.',
                ),
              ),
            hardCapMs,
          );
        }),
      ]);

      const incoming = rawJob as SiteJobRecord & {
        source_kind?: string;
        linkedin_post_text?: string | null;
        needs_review?: boolean;
        is_likely_hiring_post?: boolean;
      };

      const contextCap = isLinkedInPost ? 900 : MAX_SEO_SOURCE_FOR_SINGLE_JOB;
      const runtimeMs = Date.now() - seoStarted;

      const seoProfile = isLinkedInPost ? 'linkedin_post' : 'standard';
      const seoMeta = buildSeoGeminiMetaExtras(
        seoResult.model,
        seoResult.keyUsage,
        runtimeMs,
        seoProfile,
        customInstructions.length > 0,
        seoResult.seoExtras,
        seoResult.record,
      );

      console.log(
        JSON.stringify({
          event: 'gemini_seo_ok',
          model: seoResult.model,
          gemini_key_label: seoResult.keyUsage.label,
          gemini_key_index: seoResult.keyUsage.index,
          gemini_keys_total: seoResult.keyUsage.total,
          gemini_key_hint: seoResult.keyUsage.hint,
          runtime_ms: runtimeMs,
        }),
      );

      return jsonResponse({
        ok: true,
        mode: 'seo',
        job: {
          ...seoResult.record,
          seo_source_context: sourceContext.slice(0, contextCap),
          seo_optimized: true,
          seo_show_preview: true,
          seo_custom_instructions: customInstructions.slice(0, MAX_SEO_CUSTOM_INSTRUCTIONS_CHARS) || null,
          seo_meta: seoMeta,
          source_kind: incoming.source_kind ?? seoResult.record.source_kind ?? 'linkedin_post',
          linkedin_post_text: incoming.linkedin_post_text ?? seoResult.record.linkedin_post_text ?? null,
          needs_review: false,
          is_likely_hiring_post: incoming.is_likely_hiring_post ?? seoResult.record.is_likely_hiring_post,
        },
        seo_preview: {
          title: seoResult.record.title,
          slug: seoResult.record.slug,
          short_description: seoResult.record.short_description,
          description: seoResult.record.description,
          responsibilities: seoResult.record.responsibilities,
          eligibility: seoResult.record.eligibility,
          skills: seoResult.record.skills,
          category: seoResult.record.category,
          job_type: seoResult.record.job_type,
          work_mode: seoResult.record.work_mode,
          json_ld: seoMeta.json_ld,
          hashtags: seoResult.seoExtras.hashtags,
          keyword_density: seoResult.seoExtras.keyword_density,
        },
        gemini_status: 'ok',
        gemini_model: seoResult.model,
        gemini_key_index: seoResult.keyUsage.index,
        gemini_keys_total: seoResult.keyUsage.total,
        gemini_key_source: seoResult.keyUsage.source,
        gemini_key_label: seoResult.keyUsage.label,
        gemini_key_hint: seoResult.keyUsage.hint,
        runtime_ms: runtimeMs,
        seo_profile: seoProfile,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'SEO optimization failed.';
      const hint = isGemini429Error(message)
        ? ' Wait a few seconds between jobs, or add more keys in GEMINI_API_KEYS.'
        : '';
      const keyFields = makeSeoGeminiKeyFailureFields(isLinkedInPost);
      console.warn(
        JSON.stringify({
          event: 'gemini_seo_failed',
          message: message.slice(0, 300),
          ...keyFields,
        }),
      );
      return jsonResponse(
        { ok: false, error: `${message}${hint}`, mode: 'seo', ...keyFields },
        502,
      );
    } finally {
      endMakeSeoKeyTracking();
    }
  }

  const runStarted = Date.now();
  const phaseTimings: Record<string, number> = {};
  const markPhase = (name: string) => {
    phaseTimings[name] = Date.now() - runStarted;
  };

  const budget = createFetchBudget();

  try {
    const fetchInstant = new Date().toISOString();
    const cutoff = Date.now() - MS_24H;
    markPhase('auth_done');

    const channelRaw = requestBody.fetch_channel ?? requestBody.source;
    const fetchChannel = parseFetchChannel(channelRaw);
    if (channelRaw && typeof channelRaw === 'string' && channelRaw.trim() && !fetchChannel) {
      return jsonResponse(
        {
          ok: false,
          error:
            'Invalid fetch_channel. Use: naukri, linkedin_jobs, linkedin_posts, vizag_it, indeed',
        },
        400,
      );
    }
    const activeFirecrawlKeys = fetchChannel
      ? getFirecrawlApiKeys(fetchChannel)
      : globalFirecrawlKeys;
    const hasFirecrawl = activeFirecrawlKeys.length > 0;

    const apifyToken = getApifyToken();
    if (apifyToken && getLinkedInProvider() !== 'firecrawl') {
      validateApifyEnvJsonSecrets();
    }
    const sourceMode = fetchChannel
      ? fetchChannel === 'naukri'
        ? 'naukri'
        : fetchChannel === 'linkedin_posts' || fetchChannel === 'linkedin_jobs'
          ? 'linkedin'
          : 'linkedin'
      : getFetchSourcesMode();
    const needsNaukri = !fetchChannel
      ? sourceMode === 'naukri' || sourceMode === 'both'
      : fetchChannel === 'naukri' || fetchChannel === 'vizag_it';
    const needsLinkedIn = !fetchChannel
      ? sourceMode === 'linkedin' || sourceMode === 'both'
      : fetchChannel === 'linkedin_jobs' ||
        fetchChannel === 'linkedin_posts' ||
        fetchChannel === 'vizag_it';

    if (fetchChannel === 'naukri' && !hasFirecrawl && !getApifyTokenForNaukri()) {
      return jsonResponse(
        {
          ok: false,
          error:
            'Set APIFY_API_TOKEN_NAUKRI (recommended) or FIRECRAWL_API_KEY_NAUKRI for Naukri fetch.',
        },
        501,
      );
    }

    const naukriAction = (requestBody.naukri_action ?? '').trim().toLowerCase();
    if (fetchChannel === 'naukri' && naukriAction === 'start') {
      const started = await startNaukriApifyRunAsync();
      if (!started.runId) {
        return jsonResponse(
          { ok: false, error: started.error ?? 'Failed to start Naukri Apify run.' },
          502,
        );
      }
      const collectAfterMs = NAUKRI_ASYNC_COLLECT_WAIT_MS;
      return jsonResponse({
        ok: true,
        mode: 'fetch',
        naukri_async: true,
        naukri_action: 'started',
        fetched_at: fetchInstant,
        runtime_ms: budget.elapsedMs(),
        provider_used: 'apify',
        apify_naukri_run_id: started.runId,
        started_at: fetchInstant,
        collect_after_ms: collectAfterMs,
        collect_after_sec: Math.ceil(collectAfterMs / 1000),
        collect_at: new Date(Date.now() + collectAfterMs).toISOString(),
        apify_actor: started.actorId,
        apify_input_label: started.inputLabel,
        fetch_channel: 'naukri',
        fetch_channel_label: channelLabel('naukri'),
        jobs: [],
        message: `Apify scrape started. Check back in about ${Math.round(collectAfterMs / 60_000)} minutes.`,
      });
    }

    if (fetchChannel === 'naukri' && naukriAction === 'collect') {
      const runId = requestBody.apify_naukri_run_id?.trim();
      if (!runId) {
        return jsonResponse(
          { ok: false, error: 'Missing apify_naukri_run_id for Naukri collect.' },
          400,
        );
      }
      const collected = await collectNaukriApifyRun(runId, fetchInstant);
      if (collected.pending) {
        return jsonResponse({
          ok: true,
          mode: 'fetch',
          naukri_async: true,
          naukri_action: 'pending',
          apify_status: collected.status,
          apify_naukri_run_id: runId,
          retry_after_sec: 15,
          fetched_at: fetchInstant,
          runtime_ms: budget.elapsedMs(),
          provider_used: 'apify',
          fetch_channel: 'naukri',
          fetch_channel_label: channelLabel('naukri'),
          jobs: [],
          message: 'Apify is still scraping Naukri jobs. Try again in a few seconds.',
        });
      }
      if (collected.error && collected.jobs.length === 0) {
        return jsonResponse(
          { ok: false, error: collected.error, apify_status: collected.status, apify_naukri_run_id: runId },
          502,
        );
      }
      const mapped = mapNaukriExtractedJobsToSiteJobs(
        collected.jobs as ExtractedJob[],
        fetchInstant,
        cutoff,
      );
      return jsonResponse({
        ok: true,
        mode: 'fetch',
        naukri_async: true,
        naukri_action: 'collected',
        fetched_at: fetchInstant,
        runtime_ms: budget.elapsedMs(),
        provider_used: 'apify',
        fetch_channel: 'naukri',
        fetch_channel_label: channelLabel('naukri'),
        apify_naukri_run_id: runId,
        apify_status: collected.status,
        apify_naukri_count: collected.apify_naukri_count,
        apify_naukri_raw_count: collected.apify_naukri_raw_count,
        naukri_search_url: collected.naukri_search_url,
        naukri_filtered_out_older_than_24h: mapped.filtered_out_older_than_24h,
        naukri_fetch_warning: mapped.naukri_fetch_warning,
        extraction_mode: 'apify_naukri_async',
        parser_version: PARSER_VERSION,
        jobs: mapped.siteJobs,
        jobs_last_24h: mapped.jobs_last_24h,
        jobs_undated: mapped.jobs_undated,
        summary: mapped.summary,
        scrape_stats: { attempted: 0, succeeded: mapped.siteJobs.length, failed: 0 },
        gemini_status: 'skipped',
        seo_optimized_count: 0,
        message:
          mapped.siteJobs.length > 0
            ? `Loaded ${mapped.siteJobs.length} Vizag Naukri job(s) from Apify.`
            : collected.error ?? 'No Vizag jobs matched after Apify collect.',
      });
    }

    if (!fetchChannel && needsNaukri && !hasFirecrawl) {
      return jsonResponse(
        {
          ok: false,
          error:
            'FIRECRAWL_API_KEY (or FIRECRAWL_API_KEYS) is required for Naukri fetch. Set FETCH_JOB_SOURCES=linkedin for LinkedIn-only with APIFY_API_TOKEN.',
        },
        501,
      );
    }

    if (!fetchChannel && needsLinkedIn && !apifyToken && !hasFirecrawl && !scrapflyKey) {
      return jsonResponse(
        {
          ok: false,
          error:
            'No LinkedIn crawler configured. Set APIFY_API_TOKEN (recommended) or FIRECRAWL_API_KEY in Edge Function secrets.',
        },
        501,
      );
    }

    let provider_used: 'apify' | 'firecrawl' | 'scrapfly' | 'mixed' = scrapflyKey ? 'scrapfly' : 'firecrawl';
    if (fetchChannel === 'linkedin_jobs' || fetchChannel === 'linkedin_posts') {
      provider_used = getApifyTokenForRole(
        fetchChannel === 'linkedin_posts' ? 'posts' : 'jobs',
      )
        ? 'apify'
        : 'firecrawl';
    } else if (fetchChannel === 'naukri') {
      provider_used = getApifyTokenForNaukri() ? 'apify' : 'firecrawl';
    } else if (fetchChannel) {
      provider_used = 'firecrawl';
    } else if (apifyToken && getLinkedInProvider() !== 'firecrawl') {
      provider_used = needsNaukri && hasFirecrawl ? 'mixed' : 'apify';
    } else if (hasFirecrawl) {
      provider_used = needsLinkedIn && apifyToken ? 'mixed' : 'firecrawl';
    }

    let detailUrls: string[] = [];
    let linkedinDiscoverMeta: DiscoverDetailResult | null = null;
    const linkedinContent24hUrlSet = new Set<string>();
    let linkedinPostJobs: ExtractedJob[] = [];
    let linkedinListingJobs: ExtractedJob[] = [];
    let naukriListingJobs: ExtractedJob[] = [];
    let linkedinPostParseMode: 'gemini' | 'regex' | 'none' = 'none';
    const linkedInPostPreset =
      fetchChannel === 'linkedin_posts'
        ? resolveLinkedInPostPreset(
            requestBody.linkedin_post_preset,
            requestBody.linkedin_custom_search_url,
          )
        : null;

    if (fetchChannel) {
      linkedinDiscoverMeta = await discoverDetailUrlsForChannel(
        fetchChannel,
        budget,
        linkedInPostPreset ?? undefined,
      );
      detailUrls = linkedinDiscoverMeta.urls;
      for (const u of linkedinDiscoverMeta.linkedin_content_urls) {
        linkedinContent24hUrlSet.add(u);
      }
      const fallbackSearch =
        linkedinDiscoverMeta.linkedin_content_search_urls[0] ?? LINKEDIN_VIZAG_24H_CONTENT_URL;
      if (fetchChannel === 'linkedin_posts') {
        const converted = await convertLinkedInPostsToJobs(
          linkedinDiscoverMeta.linkedin_content_posts,
          fetchInstant,
          fallbackSearch,
          cutoff,
        );
        linkedinPostJobs = applyLinkedInPostPresetToJobs(
          converted.jobs,
          linkedInPostPreset ?? resolveLinkedInPostPreset('general'),
        );
        linkedinPostParseMode = converted.parse_mode;
      }
      if (fetchChannel === 'linkedin_jobs') {
        linkedinListingJobs = linkedinDiscoverMeta.linkedin_jobs_listing_jobs ?? [];
      }
      if (fetchChannel === 'naukri') {
        naukriListingJobs = linkedinDiscoverMeta.naukri_listing_jobs ?? [];
      }
    } else {
      const canRunDiscover = Boolean(hasFirecrawl || apifyToken);
      if (canRunDiscover) {
        const useFullDiscover =
          hasFirecrawl && Deno.env.get('FETCH_JOB_FULL_DISCOVER')?.trim().toLowerCase() === 'true';
        if (useFullDiscover) {
          detailUrls = await discoverAllDetailUrls(activeFirecrawlKeys);
        } else {
          linkedinDiscoverMeta = await discoverDetailUrlsForFetch(activeFirecrawlKeys, budget);
          detailUrls = linkedinDiscoverMeta.urls;
          for (const u of linkedinDiscoverMeta.linkedin_content_urls) {
            linkedinContent24hUrlSet.add(u);
          }
          const fallbackSearch =
            linkedinDiscoverMeta.linkedin_content_search_urls[0] ?? LINKEDIN_VIZAG_24H_CONTENT_URL;
          const converted = await convertLinkedInPostsToJobs(
            linkedinDiscoverMeta.linkedin_content_posts,
            fetchInstant,
            fallbackSearch,
            cutoff,
          );
          linkedinPostJobs = converted.jobs;
          linkedinPostParseMode = converted.parse_mode;
          linkedinListingJobs = linkedinDiscoverMeta.linkedin_jobs_listing_jobs ?? [];
        }
      } else if (scrapflyKey) {
        detailUrls = parseScrapflyUrlsEnv().filter(
          (u) => isLinkedInOrNaukriUrl(u) && looksLikeIndividualJobApplyUrl(u),
        );
      }
    }
    markPhase('discover_done');

    const maxScrape = (() => {
      const rawLimit =
        fetchChannel === 'naukri'
          ? Number(Deno.env.get('FETCH_NAUKRI_SCRAPE_LIMIT') ?? String(DEFAULT_NAUKRI_SCRAPE_LIMIT)) ||
            DEFAULT_NAUKRI_SCRAPE_LIMIT
          : Number(Deno.env.get('FETCH_JOB_DETAIL_SCRAPE_LIMIT') ?? String(DEFAULT_MAX_SCRAPE_URLS)) ||
            DEFAULT_MAX_SCRAPE_URLS;
      const floor = fetchChannel === 'naukri' ? 3 : 3;
      const ceiling = fetchChannel === 'naukri' ? 15 : 20;
      return Math.min(Math.max(floor, rawLimit), ceiling);
    })();
    let linkedinUrls = detailUrls.filter((u) => u.includes('linkedin.com'));
    let naukriUrls = detailUrls.filter(
      (u) =>
        /naukri\.com/i.test(u) &&
        looksLikeIndividualJobApplyUrl(u) &&
        isNaukriVizagJob({ source_url: u, apply_url: u }),
    );
    let indeedUrls = detailUrls.filter((u) => isIndeedUrl(u));

    if (fetchChannel === 'naukri') {
      linkedinUrls = [];
      indeedUrls = [];
    } else if (fetchChannel === 'linkedin_jobs') {
      naukriUrls = [];
      indeedUrls = [];
    } else if (fetchChannel === 'linkedin_posts') {
      linkedinUrls = [];
      naukriUrls = [];
      indeedUrls = [];
    } else if (fetchChannel === 'indeed') {
      linkedinUrls = [];
      naukriUrls = [];
    } else if (fetchChannel === 'vizag_it') {
      indeedUrls = [];
    } else if (sourceMode === 'linkedin') {
      naukriUrls = [];
      indeedUrls = [];
    } else if (!fetchChannel && (sourceMode === 'naukri' || sourceMode === 'both')) {
      /* keep naukri */
    } else if (!fetchChannel) {
      naukriUrls =
        sourceMode === 'naukri' || sourceMode === 'both'
          ? naukriUrls
          : [];
    }
    const skipLiJobView =
      (Deno.env.get('FETCH_LINKEDIN_SKIP_JOB_VIEW_SCRAPE') ?? 'true').toLowerCase() !== 'false';
    if (skipLiJobView && linkedinPostJobs.length > 0 && linkedinListingJobs.length >= 5) {
      linkedinUrls = linkedinUrls.filter((u) => !/\/jobs\/view\//i.test(u));
    }
    const apifyNaukriHasJobs =
      fetchChannel === 'naukri' &&
      naukriListingJobs.length > 0 &&
      Boolean(getApifyTokenForNaukri());
    if (apifyNaukriHasJobs) {
      naukriUrls = [];
    }
    const { linkedinCap, naukriCap, indeedCap } = resolveDetailScrapeCaps(
      fetchChannel,
      sourceMode,
      maxScrape,
    );
    const urlsToScrape = [
      ...sortDetailUrlsForScrape(linkedinUrls).slice(0, linkedinCap),
      ...sortDetailUrlsForScrape(naukriUrls).slice(0, naukriCap),
      ...sortDetailUrlsForScrape(indeedUrls).slice(0, indeedCap),
    ].slice(0, maxScrape);

    let jobs: ExtractedJob[] = [];
    let failed_urls: string[] = [];
    let scrape_stats = { attempted: 0, succeeded: 0, failed: 0 };

    const apifyLinkedInOnly =
      apifyToken &&
      getLinkedInProvider() !== 'firecrawl' &&
      linkedinListingJobs.length + linkedinPostJobs.length > 0;

    const apifyNaukriOnly = apifyNaukriHasJobs;

    const apifyLinkedInJobsOnly =
      fetchChannel === 'linkedin_jobs' &&
      linkedinListingJobs.length > 0 &&
      (linkedinDiscoverMeta?.apify_jobs_count ?? linkedinListingJobs.length) > 0 &&
      Boolean(getApifyTokenForRole('jobs'));

    if (apifyNaukriOnly) {
      jobs = dedupeJobs([...naukriListingJobs]);
      scrape_stats = {
        attempted: 0,
        succeeded: jobs.length,
        failed: 0,
      };
      markPhase('scrape_done');
    } else if (apifyLinkedInJobsOnly) {
      jobs = dedupeJobs([...linkedinListingJobs]);
      scrape_stats = {
        attempted: 0,
        succeeded: jobs.length,
        failed: 0,
      };
      markPhase('scrape_done');
    } else if (hasFirecrawl && urlsToScrape.length > 0) {
      const scraped = await scrapeDetailUrlsToJobs(
        urlsToScrape,
        activeFirecrawlKeys,
        fetchInstant,
        budget,
        linkedinContent24hUrlSet.size > 0 ? linkedinContent24hUrlSet : undefined,
      );
      jobs = scraped.jobs;
      failed_urls = scraped.failed_urls;
      scrape_stats = scraped.stats;
      jobs = dedupeJobs([...linkedinListingJobs, ...linkedinPostJobs, ...naukriListingJobs, ...jobs]);
      markPhase('scrape_done');
    } else if (apifyLinkedInOnly || (apifyToken && linkedinListingJobs.length + linkedinPostJobs.length > 0)) {
      jobs = dedupeJobs([...linkedinListingJobs, ...linkedinPostJobs]);
      scrape_stats = {
        attempted: 0,
        succeeded: jobs.length,
        failed: 0,
      };
      markPhase('scrape_done');
    } else if (scrapflyKey) {
      for (const url of urlsToScrape) {
        const text = await scrapflyScrapeUrl(url, scrapflyKey);
        const record = buildJobRecordFromScrape(url, text, fetchInstant);
        if (record) {
          jobs.push(record);
        } else {
          failed_urls.push(url);
        }
      }
      jobs = dedupeJobs(jobs);
      scrape_stats = {
        attempted: urlsToScrape.length,
        succeeded: jobs.length,
        failed: failed_urls.length,
      };
    }

    jobs = jobs.filter((j) => {
      if (j.source_kind === 'linkedin_post' && fetchChannel === 'linkedin_posts') {
        return true;
      }
      if (
        fetchChannel === 'naukri' ||
        j.source_kind === 'naukri' ||
        j.source_name === 'naukri.com'
      ) {
        return isNaukriVizagJob(j);
      }
      return (
        mentionsVizagContext(j) ||
        looksLikeIndividualJobApplyUrl(j.apply_url ?? j.source_url ?? '') ||
        (fetchChannel === 'indeed' && isIndeedUrl(j.apply_url ?? j.source_url ?? ''))
      );
    });

    if (fetchChannel === 'linkedin_posts' && linkedinPostJobs.length > 0) {
      jobs = dedupeJobs([...linkedinPostJobs, ...jobs]);
    }

    if (fetchChannel === 'vizag_it') {
      jobs = jobs.filter((j) => looksLikeVizagItRole(j));
    }

    const rawJobs = jobs;
    const mappedBeforeDedupe = rawJobs.map((j) => toSiteJobRecord(j, fetchInstant));
    const mappedJobs = dedupeSiteJobs(mappedBeforeDedupe);
    const sourceContextMap = buildSourceContextMap(rawJobs);

    // Strict-by-default for Naukri: drop listings whose posted date can't be parsed.
    // Naukri pages sometimes hide the "Posted: X days ago" string or use month/year
    // wording that older parsers missed, so the legacy fallback to `fetchInstant`
    // would mis-stamp them as fresh and leak through the 24h filter.
    const naukriStrictDates =
      (Deno.env.get('FETCH_NAUKRI_STRICT_DATES') ?? 'true').toLowerCase() !== 'false';

    markPhase('map_done');
    let siteJobs = mappedJobs.map((job) => {
      const raw = rawJobs.find((r) => {
        const rawKey = siteJobDedupeKey(
          toSiteJobRecord(r, fetchInstant),
        );
        return rawKey === siteJobDedupeKey(job);
      });
      let posted_at: string | null = job.posted_at ?? null;
      if (
        job.source_name === 'linkedin.com' &&
        raw?.source_kind !== 'linkedin_post' &&
        raw?.from_linkedin_content_24h &&
        (!parsePostedAt(posted_at) || !isPostedWithinCutoff(posted_at, cutoff))
      ) {
        posted_at = fetchInstant;
      }
      if (job.source_name === 'naukri.com') {
        posted_at = resolvePostedAtFromSource(job, raw, fetchInstant, {
          strict: naukriStrictDates,
        });
      }
      return {
        ...job,
        posted_at,
        seo_source_context:
          raw?.source_kind === 'linkedin_post'
            ? (raw.linkedin_post_text ?? job.linkedin_post_text ?? '').slice(0, 2_000)
            : lookupSourceContext(job, sourceContextMap),
        seo_optimized: false,
        source_kind:
          raw?.source_kind ??
          (job.source_name === 'naukri.com'
            ? 'naukri'
            : raw?.from_linkedin_content_24h
              ? 'linkedin_job'
              : 'linkedin_job'),
        linkedin_post_text: raw?.linkedin_post_text ?? job.linkedin_post_text ?? null,
        needs_review: raw?.needs_review ?? job.needs_review ?? false,
        is_likely_hiring_post: raw?.is_likely_hiring_post ?? job.is_likely_hiring_post ?? false,
      };
    });

    if (sourceMode === 'linkedin') {
      siteJobs = siteJobs.filter((j) => j.source_name === 'linkedin.com');
    }

    const require24h = (Deno.env.get('FETCH_REQUIRE_POSTED_WITHIN_24H') ?? 'true').toLowerCase() !== 'false';
    const before24hFilter = siteJobs.length;
    if (require24h) {
      siteJobs = siteJobs.filter((j) => isPostedWithinCutoff(j.posted_at, cutoff));
    }
    const filtered_out_older_than_24h = before24hFilter - siteJobs.length;
    const linkedin_filtered_out_older_than_24h =
      fetchChannel === 'naukri' ? 0 : filtered_out_older_than_24h;
    const naukri_filtered_out_older_than_24h =
      fetchChannel === 'naukri' ? filtered_out_older_than_24h : 0;
    const scraped_before_24h_filter = before24hFilter;

    const gemini_status =
      linkedinPostParseMode === 'gemini'
        ? ('linkedin_parse' as const)
        : ('skipped' as const);
    const gemini_error: string | null = null;

    siteJobs.sort((a, b) => {
      const aPost = a.source_kind === 'linkedin_post' ? 0 : 1;
      const bPost = b.source_kind === 'linkedin_post' ? 0 : 1;
      if (aPost !== bPost) {
        return aPost - bPost;
      }
      return 0;
    });

    const jobs_last_24h = siteJobs.filter((j) => isPostedWithinCutoff(j.posted_at, cutoff));

    const jobs_undated = siteJobs.filter((j) => {
      const ts = parsePostedAt(j.posted_at ?? null);
      return ts === null || ts < cutoff;
    });

    const summary = summarizeJobs(siteJobs, cutoff);

    const naukriExtractionDebug = {
      parser_version: PARSER_VERSION,
      naukri_provider: linkedinDiscoverMeta?.naukri_provider ?? (getApifyTokenForNaukri() ? 'apify' : 'firecrawl'),
      naukri_count: rawJobs.filter((j) => j.source_name === 'naukri.com').length,
      naukri_apify_count: linkedinDiscoverMeta?.apify_naukri_count ?? 0,
      naukri_apify_raw_count: linkedinDiscoverMeta?.apify_naukri_raw_count ?? 0,
      apify_naukri_run_id: linkedinDiscoverMeta?.apify_naukri_run_id ?? null,
      apify_naukri_error: linkedinDiscoverMeta?.apify_naukri_error ?? null,
      naukri_search_url: linkedinDiscoverMeta?.naukri_search_url ?? null,
      naukri_bad_title: rawJobs.filter(
        (j) =>
          j.source_name === 'naukri.com' &&
          (j.title === 'Job description' || j.title === 'Job opening'),
      ).length,
      naukri_urls_discovered: naukriUrls.length,
      naukri_hub_urls_scraped: linkedinDiscoverMeta?.naukri_hub_urls_scraped ?? [],
      naukri_used_legacy_hub_fallback:
        linkedinDiscoverMeta?.naukri_used_legacy_hub_fallback ?? false,
      naukri_used_search_fallback:
        linkedinDiscoverMeta?.naukri_used_search_fallback ?? false,
      detail_urls_queued_for_scrape: urlsToScrape.length,
      scraped_before_24h_filter,
      filtered_out_older_than_24h: naukri_filtered_out_older_than_24h,
      scrape_caps: { linkedinCap, naukriCap, indeedCap },
      scrape_failed_count: failed_urls.length,
      sample: siteJobs.slice(0, 8).map((j) => ({
        slug: j.slug,
        title: j.title,
        company: j.company,
        category: j.category,
        posted_at: j.posted_at,
        source: j.source_name,
      })),
    };

    const extraction_debug = fetchChannel === 'naukri' ? naukriExtractionDebug : {
      parser_version: PARSER_VERSION,
      linkedin_count: rawJobs.filter((j) => j.source_name === 'linkedin.com').length,
      linkedin_posts_found: linkedinDiscoverMeta?.linkedin_content_posts_found ?? 0,
      linkedin_search_posts_added: linkedinDiscoverMeta?.linkedin_search_posts_added ?? 0,
      linkedin_content_scrape_chars: linkedinDiscoverMeta?.linkedin_content_scrape_chars ?? [],
      linkedin_content_login_wall_pages: linkedinDiscoverMeta?.linkedin_content_login_wall_pages ?? 0,
      linkedin_posts_in_jobs: rawJobs.filter((j) => j.source_kind === 'linkedin_post').length,
      linkedin_posts_mapped_before_dedupe: mappedBeforeDedupe.filter((j) => j.source_kind === 'linkedin_post')
        .length,
      linkedin_posts_after_site_dedupe: mappedJobs.filter((j) => j.source_kind === 'linkedin_post').length,
      linkedin_post_parse_mode: linkedinPostParseMode,
      linkedin_primary_content_url: LINKEDIN_VIZAG_24H_CONTENT_URL,
      linkedin_jobs_listing_url:
        linkedinDiscoverMeta?.linkedin_jobs_listing_url ?? LINKEDIN_VIZAG_24H_JOBS_LISTING_URL,
      linkedin_jobs_listing_found: linkedinDiscoverMeta?.linkedin_jobs_listing_found ?? 0,
      linkedin_jobs_listing_login_wall: linkedinDiscoverMeta?.linkedin_jobs_listing_login_wall ?? false,
      linkedin_jobs_listing_scrape_chars: linkedinDiscoverMeta?.linkedin_jobs_listing_scrape_chars ?? 0,
      linkedin_provider: linkedinDiscoverMeta?.linkedin_provider ?? null,
      apify_jobs_run_id: linkedinDiscoverMeta?.apify_jobs_run_id ?? null,
      apify_posts_run_id: linkedinDiscoverMeta?.apify_posts_run_id ?? null,
      apify_jobs_count: linkedinDiscoverMeta?.apify_jobs_count ?? 0,
      apify_posts_raw_count: linkedinDiscoverMeta?.apify_posts_raw_count ?? 0,
      apify_posts_count: linkedinDiscoverMeta?.apify_posts_count ?? 0,
      apify_jobs_error: linkedinDiscoverMeta?.apify_jobs_error ?? null,
      apify_posts_error: linkedinDiscoverMeta?.apify_posts_error ?? null,
      linkedin_posts_filtered_older_than_24h: rawJobs.filter(
        (j) => j.source_kind === 'linkedin_post' && !isPostedWithinCutoff(j.posted_at, cutoff),
      ).length,
      linkedin_empty_scrape: rawJobs.filter(
        (j) =>
          j.source_name === 'linkedin.com' &&
          j.source_kind !== 'linkedin_post' &&
          (j.scrape_chars ?? 0) === 0,
      ).length,
      linkedin_unknown_company: rawJobs.filter(
        (j) => j.source_name === 'linkedin.com' && j.company === 'Unknown',
      ).length,
      naukri_count: rawJobs.filter((j) => j.source_name === 'naukri.com').length,
      naukri_bad_title: rawJobs.filter(
        (j) =>
          j.source_name === 'naukri.com' &&
          (j.title === 'Job description' || j.title === 'Job opening'),
      ).length,
      naukri_urls_discovered: naukriUrls.length,
      detail_urls_queued_for_scrape: urlsToScrape.length,
      scrape_caps: { linkedinCap, naukriCap, indeedCap },
      sample: siteJobs.slice(0, 8).map((j) => ({
        slug: j.slug,
        title: j.title,
        company: j.company,
        category: j.category,
        posted_at: j.posted_at,
        source: j.source_name,
      })),
    };

    const linkedinInJobs = siteJobs.filter((j) => j.source_name === 'linkedin.com').length;
    const postsFound = linkedinDiscoverMeta?.linkedin_content_posts_found ?? 0;
    const postJobsInOutput = siteJobs.filter((j) => j.source_kind === 'linkedin_post').length;
    const showLinkedInWarnings =
      !fetchChannel ||
      fetchChannel === 'linkedin_jobs' ||
      fetchChannel === 'linkedin_posts' ||
      fetchChannel === 'vizag_it';
    const showNaukriWarnings =
      fetchChannel === 'naukri' || (!fetchChannel && (sourceMode === 'naukri' || sourceMode === 'both'));
    const naukriInOutput = siteJobs.filter((j) => j.source_name === 'naukri.com').length;

    const linkedin_fetch_warning = !showLinkedInWarnings
      ? null
      : linkedinInJobs === 0
        ? linkedinDiscoverMeta?.linkedin_provider === 'apify' ||
            linkedinDiscoverMeta?.linkedin_provider === 'apify_firecrawl_fallback' ||
            linkedinDiscoverMeta?.linkedin_provider === 'apify_firecrawl_posts_fallback'
          ? linkedinDiscoverMeta.apify_jobs_error || linkedinDiscoverMeta.apify_posts_error
            ? `Apify LinkedIn fetch failed. Jobs: ${linkedinDiscoverMeta.apify_jobs_error ?? 'ok'}. Posts: ${linkedinDiscoverMeta.apify_posts_error ?? 'ok'}. Jobs default: curious_coder~linkedin-jobs-scraper. Posts default: harvestapi~linkedin-post-search (remove APIFY_LINKEDIN_POSTS_ACTOR if still set to curious_coder post scraper — rental expired).`
            : linkedin_filtered_out_older_than_24h > 0 &&
                (linkedinDiscoverMeta?.apify_jobs_count ?? 0) > 0
              ? `Apify returned ${linkedinDiscoverMeta.apify_jobs_count} job(s) but all were filtered as older than 24h (check postedAt parsing).`
              : 'Apify returned no LinkedIn jobs or posts for Vizag past 24h. Check actor input JSON overrides and Apify credits.'
          : linkedinDiscoverMeta?.linkedin_content_login_wall_pages
            ? 'LinkedIn login wall on Firecrawl scrape. Set APIFY_API_TOKEN (defaults to harvestapi posts + curious_coder jobs).'
            : 'No LinkedIn jobs in this fetch. Set APIFY_API_TOKEN + FETCH_JOB_SOURCES=linkedin.'
        : postsFound === 0 &&
            postJobsInOutput === 0 &&
            isApifyRentOrMissingError(linkedinDiscoverMeta?.apify_posts_error ?? null)
          ? 'LinkedIn jobs OK but feed posts failed: curious_coder post actor trial expired. Clear APIFY_LINKEDIN_POSTS_ACTOR secret or set harvestapi~linkedin-post-search, then fetch again.'
          : postsFound === 0 && postJobsInOutput === 0
            ? 'LinkedIn formal jobs fetched; no hiring posts in past 24h. Posts use harvestapi~linkedin-post-search by default (~$0.002/post).'
            : null;

    const naukri_fetch_warning = !showNaukriWarnings
      ? null
      : naukriInOutput === 0
        ? !hasFirecrawl && !getApifyTokenForNaukri()
          ? 'Set APIFY_API_TOKEN_NAUKRI (recommended) or FIRECRAWL_API_KEY_NAUKRI to fetch Naukri jobs.'
          : linkedinDiscoverMeta?.apify_naukri_error && !linkedinDiscoverMeta?.apify_naukri_count
            ? `Naukri Apify fetch failed: ${linkedinDiscoverMeta.apify_naukri_error}`
            : naukriUrls.length === 0 && detailUrls.length > 0
            ? `Found ${detailUrls.length} URL(s) but none are Naukri job-listings detail pages.`
            : scrape_stats.attempted > 0 && scrape_stats.succeeded === 0
              ? 'Naukri pages were scraped but no jobs could be extracted (blocked page or bad HTML).'
              : naukri_filtered_out_older_than_24h > 0
                ? `${naukri_filtered_out_older_than_24h} job(s) scraped but excluded: posted more than 24h ago.`
                : 'No Naukri jobs matched Vizag filters for this fetch.'
        : naukri_filtered_out_older_than_24h > 0
          ? `Showing ${naukriInOutput} job(s); ${naukri_filtered_out_older_than_24h} older than 24h were excluded.`
          : null;

    markPhase('complete');
    console.log(
      JSON.stringify({
        event: 'fetch_external_jobs_complete',
        phase_timings_ms: phaseTimings,
        urls_discovered: detailUrls.length,
        urls_scraped: urlsToScrape.length,
        jobs_out: siteJobs.length,
        total_ms: budget.elapsedMs(),
      }),
    );

    if (fetchChannel === 'naukri') {
      return jsonResponse(
        buildNaukriFetchResponse({
          fetchInstant,
          runtimeMs: budget.elapsedMs(),
          parserVersion: PARSER_VERSION,
          phaseTimings: debugTrace ? phaseTimings : undefined,
          extractionDebug: naukriExtractionDebug,
          siteJobs,
          jobsLast24h: jobs_last_24h,
          jobsUndated: jobs_undated,
          summary,
          naukriFetchWarning: naukri_fetch_warning,
          detailUrlsDiscovered: detailUrls.length,
          naukriUrlsDiscovered: naukriUrls.length,
          urlsQueuedForScrape: urlsToScrape.length,
          scrapeStats: scrape_stats,
          scrapeFailedUrls: failed_urls,
          scrapedBefore24hFilter: scraped_before_24h_filter,
          filteredOutOlderThan24h: naukri_filtered_out_older_than_24h,
          requirePostedWithin24h:
            (Deno.env.get('FETCH_REQUIRE_POSTED_WITHIN_24H') ?? 'true').toLowerCase() !== 'false',
          naukriHubUrlsScraped: linkedinDiscoverMeta?.naukri_hub_urls_scraped ?? [],
          naukriUsedLegacyHubFallback:
            linkedinDiscoverMeta?.naukri_used_legacy_hub_fallback ?? false,
          naukriUsedSearchFallback:
            linkedinDiscoverMeta?.naukri_used_search_fallback ?? false,
        }),
      );
    }

    return jsonResponse({
      ok: true,
      fetched_at: fetchInstant,
      runtime_ms: budget.elapsedMs(),
      phase_timings_ms: debugTrace ? phaseTimings : undefined,
      provider_used,
      extraction_mode:
        provider_used === 'apify' || (linkedinDiscoverMeta?.apify_jobs_count ?? 0) > 0
          ? 'apify_linkedin'
          : 'per_url_scrape',
      parser_version: PARSER_VERSION,
      extraction_debug,
      extraction_hint:
        'LinkedIn: Apify jobs (Vizag listing) + posts (harvestapi keyword search, past 24h). Firecrawl posts fallback optional. Use Make SEO before publish.',
      fetch_channel: fetchChannel ?? null,
      fetch_channel_label: fetchChannel ? channelLabel(fetchChannel) : null,
      filters_applied: {
        fetch_channel: fetchChannel ?? null,
        sources: fetchChannel
          ? fetchChannel === 'naukri'
            ? ['naukri.com']
            : fetchChannel === 'indeed'
              ? ['indeed.com']
              : fetchChannel === 'linkedin_posts' || fetchChannel === 'linkedin_jobs'
                ? ['linkedin.com']
                : ['linkedin.com', 'naukri.com']
          : getFetchSourcesMode() === 'linkedin'
            ? ['linkedin.com']
            : ['linkedin.com', 'naukri.com'],
        fetch_sources_mode: fetchChannel ? fetchChannel : getFetchSourcesMode(),
        location_context: ['Visakhapatnam', 'Vizag', 'Andhra Pradesh', 'Andhra'],
        require_posted_within_24h: (Deno.env.get('FETCH_REQUIRE_POSTED_WITHIN_24H') ?? 'true').toLowerCase() !== 'false',
        linkedin_content_search:
          linkedinDiscoverMeta?.linkedin_content_search_urls ?? [LINKEDIN_VIZAG_24H_CONTENT_URL],
        linkedin_jobs_listing_url:
          linkedinDiscoverMeta?.linkedin_jobs_listing_url ?? LINKEDIN_VIZAG_24H_JOBS_LISTING_URL,
        linkedin_post_parse_mode: linkedinPostParseMode,
        linkedin_provider: linkedinDiscoverMeta?.linkedin_provider ?? null,
        apify_jobs_count: linkedinDiscoverMeta?.apify_jobs_count ?? 0,
        apify_posts_raw_count: linkedinDiscoverMeta?.apify_posts_raw_count ?? 0,
        apify_posts_count: linkedinDiscoverMeta?.apify_posts_count ?? 0,
        linkedin_post_preset: linkedinDiscoverMeta?.linkedin_post_preset ?? null,
        linkedin_post_preset_label: linkedinDiscoverMeta?.linkedin_post_preset_label ?? null,
        linkedin_search_queries_used: linkedinDiscoverMeta?.linkedin_search_queries_used ?? [],
        linkedin_custom_search_url:
          linkedInPostPreset?.id === 'custom'
            ? linkedInPostPreset.urls[0] ?? null
            : null,
      },
      linkedin_content_pages_scraped: linkedinDiscoverMeta?.linkedin_content_pages_scraped ?? 0,
      linkedin_content_posts_found: linkedinDiscoverMeta?.linkedin_content_posts_found ?? 0,
      linkedin_search_posts_added: linkedinDiscoverMeta?.linkedin_search_posts_added ?? 0,
      linkedin_content_scrape_chars: linkedinDiscoverMeta?.linkedin_content_scrape_chars ?? [],
      linkedin_content_login_wall_pages: linkedinDiscoverMeta?.linkedin_content_login_wall_pages ?? 0,
      linkedin_fetch_warning,
      naukri_fetch_warning,
      linkedin_content_job_urls_found: linkedinDiscoverMeta?.linkedin_content_job_urls ?? 0,
      linkedin_filtered_out_older_than_24h,
      naukri_filtered_out_older_than_24h,
      detail_job_urls_discovered: detailUrls.length,
      detail_job_pages_scraped: scrape_stats.succeeded,
      scrape_stats,
      scrape_failed_urls: failed_urls,
      mode: 'fetch',
      gemini_status,
      gemini_error,
      seo_optimized_count: 0,
      jobs: siteJobs,
      jobs_last_24h,
      jobs_undated,
      summary,
      sources_scraped: siteJobs.map((j) => ({
        url: j.source_url,
        title: j.title,
        company: j.company,
        experience: j.experience,
        slug: j.slug,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Fetch failed.';
    markPhase('error');
    console.error(
      JSON.stringify({
        event: 'fetch_external_jobs_error',
        error: message,
        phase_timings_ms: phaseTimings,
        total_ms: Date.now() - runStarted,
      }),
    );
    return jsonResponse({ ok: false, error: message, phase_timings_ms: phaseTimings }, 502);
  }
});
