/**
 * Apify Store actors for LinkedIn jobs + posts (Vizag / Visakhapatnam, past 24h).
 * Actor IDs and input JSON are overridable via Edge Function secrets.
 */

import {
  buildLinkedInContentSearchUrl,
  getLinkedInContentSearchUrlsForPreset,
  LINKEDIN_VIZAG_24H_CONTENT_URL,
  resolveLinkedInPostPreset,
  type ResolvedLinkedInPostPreset,
} from './linkedin-post-presets.ts';

export { LINKEDIN_VIZAG_24H_CONTENT_URL };

export const LINKEDIN_VIZAG_24H_JOBS_LISTING_URL =
  'https://in.linkedin.com/jobs/jobs-in-vishakhapatnam?keywords=&location=Vishakhapatnam&geoId=106055329&distance=25&f_TPR=r86400&position=1&pageNum=0';

const APIFY_API_BASE = 'https://api.apify.com/v2';
const MS_24H = 24 * 60 * 60 * 1000;
/** Pay-per-event; accepts Vizag jobs search URL in `urls`. */
const DEFAULT_JOBS_ACTOR = 'curious_coder~linkedin-jobs-scraper';
const FALLBACK_JOBS_ACTOR = 'harvestapi~linkedin-job-search';
/** harvestapi linkedin-post-search — API: /v2/acts/harvestapi~linkedin-post-search/run-sync-get-dataset-items (same actor as Console id buIWk2uOUzTmcLsuB). */
export const HARVESTAPI_LINKEDIN_POST_SEARCH_ACTOR = 'harvestapi~linkedin-post-search';
export const DEFAULT_VIZAG_POSTS_ACTOR = HARVESTAPI_LINKEDIN_POST_SEARCH_ACTOR;
const DEFAULT_POSTS_ACTOR = HARVESTAPI_LINKEDIN_POST_SEARCH_ACTOR;
/** Content-SERP scraper; often requires Apify rental + APIFY_LINKEDIN_POSTS_COOKIE_JSON. */
const FALLBACK_POSTS_ACTOR = 'curious_coder~linkedin-post-search-scraper';

export type ApifyExtractedJob = {
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
  from_linkedin_content_24h?: boolean;
  source_kind?: 'linkedin_post' | 'linkedin_job' | 'naukri';
  linkedin_post_text?: string | null;
  needs_review?: boolean;
  is_likely_hiring_post?: boolean;
};

export type ApifyLinkedInContentPost = {
  post_text: string;
  post_url: string | null;
  author_hint: string | null;
  from_content_feed_24h?: boolean;
  posted_phrase?: string | null;
};

export type ApifyLinkedInDiscoverResult = {
  linkedin_provider: 'apify';
  jobs: ApifyExtractedJob[];
  posts: ApifyLinkedInContentPost[];
  job_urls: string[];
  linkedin_content_search_urls: string[];
  apify_jobs_run_id: string | null;
  apify_posts_run_id: string | null;
  apify_jobs_count: number;
  /** Raw dataset items from the posts actor (before Vizag/hiring filters). */
  apify_posts_raw_count: number;
  apify_posts_count: number;
  apify_jobs_error: string | null;
  apify_posts_error: string | null;
};

/** Max posts to map/parse after Apify (align with ~10 per searchQueries × 2 queries). */
export function linkedInContentPostsLimit(): number {
  const n = Number(Deno.env.get('FETCH_LINKEDIN_CONTENT_POSTS_LIMIT') ?? '20') || 20;
  return Math.min(30, Math.max(5, n));
}

type FetchBudgetLike = {
  hasTime(ms: number): boolean;
};

type ApifyRunMeta = {
  runId: string | null;
  items: Record<string, unknown>[];
  error: string | null;
};

export type ApifyTokenRole = 'jobs' | 'posts' | 'default';

export function getApifyTokenForRole(role: ApifyTokenRole = 'default'): string | null {
  if (role === 'posts') {
    return (
      Deno.env.get('APIFY_API_TOKEN_LINKEDIN_POSTS')?.trim() ??
      Deno.env.get('APIFY_API_TOKEN')?.trim() ??
      null
    );
  }
  if (role === 'jobs') {
    return (
      Deno.env.get('APIFY_API_TOKEN_LINKEDIN_JOBS')?.trim() ??
      Deno.env.get('APIFY_API_TOKEN')?.trim() ??
      null
    );
  }
  return Deno.env.get('APIFY_API_TOKEN')?.trim() ?? null;
}

export function getApifyToken(): string | null {
  return getApifyTokenForRole('default');
}

export type ApifyDiscoverMode = 'jobs_only' | 'posts_only' | 'both';

export type LinkedInProvider = 'apify' | 'firecrawl' | 'apify_then_firecrawl';

export function getLinkedInProvider(): LinkedInProvider {
  const raw = Deno.env.get('FETCH_LINKEDIN_PROVIDER')?.trim().toLowerCase();
  if (raw === 'firecrawl') {
    return 'firecrawl';
  }
  if (raw === 'apify_then_firecrawl' || raw === 'apify-then-firecrawl') {
    return 'apify_then_firecrawl';
  }
  if (raw === 'apify' || getApifyToken()) {
    return 'apify';
  }
  return 'firecrawl';
}

export function linkedInApifyFallbackEnabled(): boolean {
  return (Deno.env.get('FETCH_LINKEDIN_FALLBACK_FIRECRAWL') ?? 'true').toLowerCase() !== 'false';
}

/** Fail fast with a clear message when a Supabase secret contains broken JSON. */
export function validateApifyEnvJsonSecrets(): void {
  const names = [
    'APIFY_LINKEDIN_JOBS_INPUT_JSON',
    'APIFY_LINKEDIN_POSTS_INPUT_JSON',
    'APIFY_LINKEDIN_POSTS_COOKIE_JSON',
  ] as const;

  for (const name of names) {
    const raw = Deno.env.get(name)?.trim();
    if (!raw) {
      continue;
    }
    try {
      JSON.parse(raw);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(
        `${name} is not valid JSON (${detail}). ` +
          `In Supabase → Edge Functions → Secrets, fix or remove this secret. ` +
          `Cookie JSON must be a single line or use properly escaped quotes (no line breaks inside strings).`,
      );
    }
  }
}

function parseEnvJsonOverride(
  envName: string,
  raw: string,
): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      `${envName} is not valid JSON (${detail}). Fix the Edge Function secret or remove it.`,
    );
  }
}

export function isApifyRentOrMissingError(error: string | null): boolean {
  if (!error) {
    return false;
  }
  const blob = error.toLowerCase();
  return (
    (/403|404/.test(blob) &&
      (/rent|paid actor|free trial|trial has expired|not found/i.test(blob))) ||
    /actor with this name was not found/i.test(blob)
  );
}

/** Full LinkedIn Firecrawl fallback is pointless when both Apify paths are rental-blocked. */
export function apifyErrorsBlockFirecrawlFallback(
  jobsError: string | null,
  postsError: string | null,
): boolean {
  return isApifyRentOrMissingError(jobsError) && isApifyRentOrMissingError(postsError);
}

export function linkedInApifyPostsFallbackEnabled(): boolean {
  return (Deno.env.get('FETCH_LINKEDIN_FALLBACK_FIRECRAWL_POSTS') ??
    Deno.env.get('FETCH_LINKEDIN_FALLBACK_FIRECRAWL') ??
    'true').toLowerCase() !== 'false';
}

/**
 * Firecrawl returns 403 for linkedin.com. When an Apify posts token is configured, default to
 * Apify-only unless FETCH_LINKEDIN_FALLBACK_FIRECRAWL_POSTS=true (opt-in).
 */
export function shouldUseFirecrawlLinkedInPostsFallback(hasPostsApifyToken: boolean): boolean {
  if (hasPostsApifyToken) {
    return (Deno.env.get('FETCH_LINKEDIN_FALLBACK_FIRECRAWL_POSTS') ?? 'false').toLowerCase() === 'true';
  }
  return linkedInApifyPostsFallbackEnabled();
}

function isHarvestApiJobsActor(actorId: string): boolean {
  const n = normalizeActorId(actorId).toLowerCase();
  return n.includes('harvestapi') && n.includes('linkedin-job-search');
}

function isCuriousCoderJobsActor(actorId: string): boolean {
  const n = normalizeActorId(actorId).toLowerCase();
  return n.includes('curious_coder') && n.includes('linkedin-jobs-scraper');
}

/** harvestapi linkedin-post-search — actor id buIWk2uOUzTmcLsuB or username~name form. */
function isHarvestStylePostsActor(actorId: string): boolean {
  const n = normalizeActorId(actorId).toLowerCase();
  if (n === 'buiwk2uouztmcslsub') {
    return true;
  }
  return n.includes('harvestapi') && n.includes('linkedin-post-search');
}

function isVizagPostSearchActor(actorId: string): boolean {
  return isHarvestStylePostsActor(actorId);
}

function isHarvestApiPostsActor(actorId: string): boolean {
  return isHarvestStylePostsActor(actorId);
}

function isCuriousCoderPostsActor(actorId: string): boolean {
  const n = normalizeActorId(actorId).toLowerCase();
  return n.includes('curious_coder') && n.includes('linkedin-post');
}

function normalizeActorId(actorId: string): string {
  const trimmed = actorId.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower === 'buiwk2uouztmcslsub' ||
    (lower.includes('harvestapi') && lower.includes('linkedin-post-search'))
  ) {
    return HARVESTAPI_LINKEDIN_POST_SEARCH_ACTOR;
  }
  return trimmed.includes('~') ? trimmed : trimmed.replace('/', '~');
}

function apifySyncTimeoutSec(budget?: FetchBudgetLike): number {
  const cap = budget?.hasTime(50_000) ? 90 : 60;
  const fromEnv = Number(Deno.env.get('APIFY_SYNC_TIMEOUT_SEC') ?? String(cap)) || cap;
  return Math.min(120, Math.max(30, fromEnv));
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
    const rel = parseRelativeAgePhrase(value, referenceIso);
    if (rel) {
      return rel;
    }
  }
  if (typeof value === 'number' && value > 1_000_000_000) {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  return null;
}

function parseRelativeAgePhrase(phrase: string, referenceIso: string): string | null {
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
  const hours = low.match(/(\d+)\s*hours?\s*ago/i);
  if (hours) {
    return new Date(ref.getTime() - Number(hours[1]) * 3_600_000).toISOString();
  }
  const days = low.match(/(\d+)\s*days?\s*ago/i);
  if (days) {
    return new Date(ref.getTime() - Number(days[1]) * msDay).toISOString();
  }
  return null;
}

function isUsableApifyJobTitle(title: string | null): boolean {
  if (!title?.trim()) {
    return false;
  }
  const low = title.trim().toLowerCase();
  if (low.length < 3 || low.length > 200) {
    return false;
  }
  if (/^job opening$/i.test(low) || /^sign in$/i.test(low)) {
    return false;
  }
  return true;
}

function normalizeJobViewUrl(raw: string | null): string | null {
  if (!raw?.trim()) {
    return null;
  }
  let url = raw.trim();
  if (!url.startsWith('http')) {
    url = `https://www.linkedin.com${url.startsWith('/') ? url : `/${url}`}`;
  }
  try {
    const u = new URL(url);
    if (!u.hostname.includes('linkedin.com') || !u.pathname.includes('/jobs/view/')) {
      return null;
    }
    u.search = '';
    return u.href;
  } catch {
    return null;
  }
}

export function apifyItemsToLinkedInJobs(
  items: Record<string, unknown>[],
  scrapedAt: string,
  listingUrl: string,
): ApifyExtractedJob[] {
  const jobs: ApifyExtractedJob[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const title =
      firstString(item, [
        'title',
        'jobTitle',
        'position',
        'name',
        'job_title',
        'jobTitleText',
      ]) ?? null;
    if (!isUsableApifyJobTitle(title)) {
      continue;
    }
    let company =
      firstString(item, ['company', 'companyName', 'company_name', 'organization']) ?? null;
    if (!company && item.companyDetails && typeof item.companyDetails === 'object') {
      company = firstString(item.companyDetails as Record<string, unknown>, [
        'name',
        'title',
        'companyName',
      ]);
    }
    if (!company) {
      company = 'Unknown';
    }
    const location =
      firstString(item, [
        'location',
        'jobLocation',
        'job_location',
        'place',
        'formattedLocation',
      ]) ?? 'Visakhapatnam / Vizag';
    const applyRaw =
      firstString(item, [
        'link',
        'jobUrl',
        'job_url',
        'url',
        'applyUrl',
        'apply_url',
        'linkedinUrl',
        'jobLink',
      ]) ?? null;
    const applyUrl = normalizeJobViewUrl(applyRaw) ?? applyRaw;
    const posted_at =
      parseApifyDate(
        item.postedAt ??
          item.posted_at ??
          item.listedAt ??
          item.publishedAt ??
          item.timeAgo ??
          item.postedDate ??
          item.listedAtText,
        scrapedAt,
      ) ?? scrapedAt;
    const description =
      firstString(item, [
        'description',
        'descriptionText',
        'descriptionHtml',
        'jobDescription',
        'text',
        'snippet',
      ]) ?? '';
    const key = `${title!.toLowerCase()}|${company.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const sourceUrl = applyUrl ?? listingUrl;
    jobs.push({
      title: title!.slice(0, 160),
      company,
      experience:
        firstString(item, ['experience', 'experienceLevel', 'seniority']) ?? 'Not specified',
      location,
      apply_url: applyUrl ?? sourceUrl,
      source_url: sourceUrl,
      source_name: 'linkedin.com',
      posted_at,
      summary:
        firstString(item, ['summary', 'subtitle', 'salary']) ??
        (description.slice(0, 300) || null),
      description_markdown: description || null,
      scrape_chars: description.length,
      scraped_at: scrapedAt,
      from_linkedin_content_24h: true,
      source_kind: 'linkedin_job',
      needs_review: true,
      is_likely_hiring_post: false,
    });
  }

  return jobs;
}

export function getLinkedInContentSearchUrls(
  preset?: ResolvedLinkedInPostPreset,
): string[] {
  const resolved = preset ?? resolveLinkedInPostPreset('general');
  return getLinkedInContentSearchUrlsForPreset(resolved);
}

function mentionsVizagInText(text: string): boolean {
  return /\b(vizag|visakhapatnam|vishakhapatnam)\b|#vizag|#visakhapatnam/i.test(text);
}

function looksLikeHiringPost(text: string): boolean {
  return (
    /\b(we are hiring|we're hiring|#hiring|hiring now|urgent hiring|walk[- ]?in|vacanc|job opening|immediate hiring)\b/i
      .test(text) &&
    /\b(position|role|ctc|lpa|₹|experience|whatsapp|apply|years experience)\b/i.test(text)
  );
}

function isJobSeekerProfilePost(text: string): boolean {
  return /\b(#jobsearch|applying for:|preferred locations:\s*#|dear hr manager|enclosed for your review|warm regards,\s*\n[^\n]+@gmail)/i.test(
    text,
  );
}

function hasHarvestHiringSignal(text: string): boolean {
  return /\b(#hiring|#wearehiring|#vizagjobs|we are hiring|we're hiring|hiring alert|hiring now|job opening|walk[- ]?in|vacanc|immediate hiring|share (your )?resume|send (your )?(cv|resume)|apply (now|with|via)|open positions?|#cfbr)\b/i.test(
    text,
  );
}

/** Keep posts from harvestapi linkedin-post-search (Vizag hiring queries). */
function shouldIncludeApifyPost(text: string): boolean {
  if (!text || text.length < 25) {
    return false;
  }
  if (isJobSeekerProfilePost(text)) {
    return false;
  }
  if (hasHarvestHiringSignal(text)) {
    return true;
  }
  if (mentionsVizagInText(text)) {
    return /\b(hiring|jobs?|vacanc|opening|recruit|apply|ctc|lpa|position|role|whatsapp|experience|years)\b/i.test(
      text,
    );
  }
  if (looksLikeHiringPost(text)) {
    return true;
  }
  return (
    text.length >= 80 &&
    /\b(hiring|walk[- ]?in|vacanc|opening|recruit|whatsapp|ctc|lpa)\b/i.test(text)
  );
}

function extractPostTextFromApifyItem(item: Record<string, unknown>): string {
  const chunks: string[] = [];
  const add = (value: string | null) => {
    if (value?.trim()) {
      chunks.push(value.trim());
    }
  };

  const outer = firstString(item, [
    'text',
    'content',
    'commentary',
    'postText',
    'post_text',
    'description',
    'body',
    'shareCommentary',
    'articleBody',
  ]);

  let repostBody: string | null = null;
  if (item.repost && typeof item.repost === 'object') {
    const repost = item.repost as Record<string, unknown>;
    repostBody = firstString(repost, ['content', 'text', 'commentary', 'description']);
  }

  if (repostBody && (!outer || outer.length < 140)) {
    add(repostBody);
    add(outer);
  } else {
    add(outer);
    add(repostBody);
  }

  add(firstString(item, ['headline', 'title', 'postTitle', 'name']));
  add(firstString(item, ['summary', 'snippet']));

  if (item.post && typeof item.post === 'object') {
    const nested = item.post as Record<string, unknown>;
    add(firstString(nested, ['text', 'commentary', 'content', 'description']));
  }

  if (item.author && typeof item.author === 'object') {
    const author = item.author as Record<string, unknown>;
    add(firstString(author, ['name', 'info', 'headline']));
  }

  return [...new Set(chunks)].join('\n\n');
}

function extractPostedPhraseFromApifyItem(item: Record<string, unknown>): string | null {
  const postedAt = item.postedAt;
  if (postedAt && typeof postedAt === 'object') {
    const o = postedAt as Record<string, unknown>;
    if (typeof o.date === 'string' && o.date.trim()) {
      return o.date.trim();
    }
    if (typeof o.timestamp === 'number' && Number.isFinite(o.timestamp)) {
      return new Date(o.timestamp).toISOString();
    }
    return firstString(o, ['postedAgoShort', 'postedAgoText']);
  }
  return firstString(item, [
    'postedAt',
    'posted_at',
    'timeAgo',
    'postedTime',
    'publishedAt',
    'date',
    'posted',
  ]);
}

function extractPostUrlFromApifyItem(item: Record<string, unknown>): string | null {
  const raw =
    firstString(item, [
      'url',
      'postUrl',
      'post_url',
      'link',
      'permalink',
      'postLink',
      'linkedinUrl',
    ]) ?? null;
  if (!raw) {
    return null;
  }
  if (raw.includes('linkedin.com')) {
    return raw;
  }
  if (raw.startsWith('/')) {
    return `https://www.linkedin.com${raw}`;
  }
  return null;
}

export function apifyItemsToLinkedInPosts(
  items: Record<string, unknown>[],
): ApifyLinkedInContentPost[] {
  const posts: ApifyLinkedInContentPost[] = [];
  const seen = new Set<string>();
  const maxPosts = linkedInContentPostsLimit();

  for (const item of items) {
    const itemType = typeof item.type === 'string' ? item.type.toLowerCase() : '';
    if (itemType && itemType !== 'post') {
      continue;
    }
    const post_text = extractPostTextFromApifyItem(item);
    if (!shouldIncludeApifyPost(post_text)) {
      continue;
    }
    const post_url = extractPostUrlFromApifyItem(item);
    const key = (post_url ?? post_text.slice(0, 200)).toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const posted_phrase = extractPostedPhraseFromApifyItem(item);
    let text = post_text;
    if (posted_phrase && !text.toLowerCase().includes(posted_phrase.toLowerCase())) {
      text = `${text}\n\nPosted: ${posted_phrase}`;
    }
    posts.push({
      post_text: text,
      post_url: post_url?.includes('linkedin.com') ? post_url : null,
      author_hint:
        (item.author && typeof item.author === 'object'
          ? firstString(item.author as Record<string, unknown>, ['name', 'info', 'headline'])
          : null) ??
        firstString(item, [
          'author',
          'authorName',
          'author_name',
          'profileName',
          'authorHeadline',
          'userName',
        ]) ??
        null,
      from_content_feed_24h: true,
      posted_phrase,
    });
    if (posts.length >= maxPosts) {
      break;
    }
  }

  return posts;
}

function jobsListingLimit(): number {
  return Math.min(
    25,
    Math.max(5, Number(Deno.env.get('FETCH_LINKEDIN_JOBS_LISTING_LIMIT') ?? '20') || 20),
  );
}

function buildJobsActorInput(actorId: string): Record<string, unknown> {
  const maxItems = jobsListingLimit();
  const override = Deno.env.get('APIFY_LINKEDIN_JOBS_INPUT_JSON')?.trim();
  if (override) {
    return parseEnvJsonOverride('APIFY_LINKEDIN_JOBS_INPUT_JSON', override);
  }

  if (isHarvestApiJobsActor(actorId)) {
    return {
      jobTitles: [
        'engineer OR manager OR analyst OR developer OR executive OR sales OR hiring OR fresher',
      ],
      locations: ['Visakhapatnam', 'Vishakhapatnam', 'Vizag'],
      postedLimit: '24h',
      maxItems,
      sortBy: 'date',
    };
  }

  if (isCuriousCoderJobsActor(actorId) || normalizeActorId(actorId).includes('bebity')) {
    return {
      urls: [LINKEDIN_VIZAG_24H_JOBS_LISTING_URL],
      count: Math.max(10, maxItems),
      scrapeCompany: false,
    };
  }

  return {
    urls: [LINKEDIN_VIZAG_24H_JOBS_LISTING_URL],
    startUrls: [{ url: LINKEDIN_VIZAG_24H_JOBS_LISTING_URL }],
    maxItems,
    maxJobs: maxItems,
  };
}

function postsFetchLimit(): number {
  return Math.min(15, Math.max(5, Math.ceil(linkedInContentPostsLimit() / 2)));
}

/** Search strings sent to harvestapi linkedin-post-search (buIWk2uOUzTmcLsuB). */
export function resolvePostSearchQueries(preset: ResolvedLinkedInPostPreset): string[] {
  const envList = Deno.env.get('FETCH_LINKEDIN_POST_SEARCH_QUERIES')?.trim();
  if (envList) {
    const split = envList.split(',').map((s) => s.trim()).filter(Boolean);
    if (split.length > 0) {
      return split.slice(0, 5);
    }
  }
  const single = Deno.env.get('FETCH_LINKEDIN_POST_SEARCH')?.trim();
  if (single) {
    return [single];
  }
  if (preset.id === 'general') {
    return ['jobs in vizag', '#VizagJobs'];
  }
  if (preset.id === 'it') {
    return ['software jobs vizag', 'IT hiring visakhapatnam'];
  }
  if (preset.id === 'bank') {
    return ['bank jobs vizag', 'banking jobs visakhapatnam'];
  }
  return [resolvePostSearchQuery(preset)];
}

/** harvestapi linkedin-post-search — must match Apify Console input for buIWk2uOUzTmcLsuB. */
function buildHarvestStylePostsInput(preset: ResolvedLinkedInPostPreset): Record<string, unknown> {
  return {
    maxPosts: postsFetchLimit(),
    postNestedComments: false,
    postNestedReactions: false,
    postedLimit: '24h',
    scrapeComments: false,
    scrapeReactions: false,
    searchQueries: resolvePostSearchQueries(preset),
    sortBy: 'date',
    profileScraperMode: 'short',
    startPage: Math.min(3, Math.max(1, Number(Deno.env.get('FETCH_LINKEDIN_POST_SEARCH_PAGE') ?? '1') || 1)),
    reactionsProfileScraperMode: 'short',
    commentsProfileScraperMode: 'short',
  };
}

function linkedInPostsOnlyMode(): boolean {
  return Deno.env.get('FETCH_LINKEDIN_POSTS_ONLY')?.trim().toLowerCase() === 'true';
}

function linkedInJobsListingEnabled(): boolean {
  if (linkedInPostsOnlyMode()) {
    return false;
  }
  return (Deno.env.get('FETCH_LINKEDIN_JOBS_LISTING_24H') ?? 'true').toLowerCase() !== 'false';
}

function linkedInPostsEnabled(): boolean {
  return (Deno.env.get('FETCH_LINKEDIN_CONTENT_24H') ?? 'true').toLowerCase() !== 'false';
}

export function resolvePostSearchQuery(preset: ResolvedLinkedInPostPreset): string {
  const envSearch = Deno.env.get('FETCH_LINKEDIN_POST_SEARCH')?.trim();
  if (envSearch) {
    return envSearch;
  }
  if (preset.id === 'general') {
    return preset.keywords[0] || 'jobs in vizag';
  }
  if (preset.id === 'it') {
    return preset.keywords[0] || 'software jobs vizag';
  }
  if (preset.id === 'bank') {
    return preset.keywords[0] || 'bank jobs vizag';
  }
  return preset.keywords[0] || 'jobs in vizag';
}

function buildHarvestApiPostsInput(preset: ResolvedLinkedInPostPreset): Record<string, unknown> {
  return buildHarvestStylePostsInput(preset);
}

function buildPostsActorInput(
  actorId: string,
  preset: ResolvedLinkedInPostPreset,
): Record<string, unknown> {
  const override = Deno.env.get('APIFY_LINKEDIN_POSTS_INPUT_JSON')?.trim();
  if (override) {
    const parsed = parseEnvJsonOverride('APIFY_LINKEDIN_POSTS_INPUT_JSON', override);
    if (preset.id !== 'custom' && 'urls' in parsed && !('searchQueries' in parsed)) {
      console.warn(
        JSON.stringify({
          event: 'apify_posts_input_json_ignored_urls',
          preset: preset.id,
          hint: 'APIFY_LINKEDIN_POSTS_INPUT_JSON uses urls scraper; use searchQueries for buIWk2uOUzTmcLsuB or remove this secret.',
        }),
      );
      return buildHarvestStylePostsInput(preset);
    }
    return parsed;
  }

  if (isHarvestStylePostsActor(actorId) || preset.id !== 'custom') {
    return buildHarvestStylePostsInput(preset);
  }

  const maxPosts = postsFetchLimit();
  const searchUrls = getLinkedInContentSearchUrls(preset);
  const perSource = Math.max(3, Math.ceil(maxPosts / Math.max(1, searchUrls.length)));
  const scrapeUntil = new Date(Date.now() - MS_24H).toISOString().slice(0, 10);

  const input: Record<string, unknown> = {
    urls: searchUrls,
    limitPerSource: perSource,
    minDelay: 2,
    maxDelay: 6,
    scrapeUntilDate: scrapeUntil,
    deepScrape: false,
    rawData: false,
  };

  const cookieJson = Deno.env.get('APIFY_LINKEDIN_POSTS_COOKIE_JSON')?.trim();
  if (cookieJson) {
    input.cookie = JSON.parse(cookieJson);
  }

  const userAgent = Deno.env.get('APIFY_LINKEDIN_USER_AGENT')?.trim();
  if (userAgent) {
    input.userAgent = userAgent;
  }

  return input;
}

function resolveHarvestPostsActorId(): string {
  const fromEnv =
    Deno.env.get('APIFY_LINKEDIN_VIZAG_POSTS_ACTOR')?.trim() ||
    Deno.env.get('APIFY_LINKEDIN_POSTS_ACTOR')?.trim();
  if (fromEnv && isHarvestStylePostsActor(fromEnv)) {
    return normalizeActorId(fromEnv);
  }
  if (fromEnv && isCuriousCoderPostsActor(fromEnv)) {
    console.warn(
      JSON.stringify({
        event: 'apify_posts_actor_curious_coder_ignored',
        configured: fromEnv,
        using: DEFAULT_VIZAG_POSTS_ACTOR,
        hint: 'Set APIFY_LINKEDIN_POSTS_ACTOR=harvestapi~linkedin-post-search, not curious_coder URL scraper.',
      }),
    );
  }
  return normalizeActorId(DEFAULT_VIZAG_POSTS_ACTOR);
}

function getPostsActorCandidates(preset: ResolvedLinkedInPostPreset): string[] {
  if (preset.id === 'custom' && preset.urls.length > 0) {
    const urlActor =
      Deno.env.get('APIFY_LINKEDIN_POSTS_URL_ACTOR')?.trim() || FALLBACK_POSTS_ACTOR;
    return [normalizeActorId(urlActor)];
  }
  return [resolveHarvestPostsActorId()];
}

async function runPostsActors(
  token: string,
  budget: FetchBudgetLike | undefined,
  preset: ResolvedLinkedInPostPreset,
): Promise<{
  posts: ApifyLinkedInContentPost[];
  runId: string | null;
  error: string | null;
  actorUsed: string | null;
  rawItems: number;
  searchUrls: string[];
  searchQueries: string[];
}> {
  const actors = getPostsActorCandidates(preset);
  const searchUrls = getLinkedInContentSearchUrls(preset);
  const searchQueries = resolvePostSearchQueries(preset);
  let lastError: string | null = null;
  let lastRunId: string | null = null;
  let lastRaw = 0;

  for (const actorId of actors) {
    if (preset.id !== 'custom' && !isHarvestStylePostsActor(actorId)) {
      continue;
    }
    const input = buildPostsActorInput(actorId, preset);
    const run = await apifyRunActor(actorId, input, token, budget);
    lastRunId = run.runId;
    lastError = run.error;
    lastRaw = run.items.length;
    const posts = apifyItemsToLinkedInPosts(run.items);
    const isHarvestStyle = isHarvestStylePostsActor(actorId);
    console.log(
      JSON.stringify({
        event: 'apify_linkedin_posts',
        actor: actorId,
        preset: preset.id,
        run_id: run.runId,
        input_mode: isHarvestStyle ? 'searchQueries' : 'urls',
        input_search_queries: isHarvestStyle
          ? (input.searchQueries as string[] | undefined)
          : undefined,
        input_max_posts: isHarvestStyle ? input.maxPosts : undefined,
        search_urls: searchUrls,
        search_queries: searchQueries,
        raw_items: run.items.length,
        mapped_posts: posts.length,
        error: run.error,
        has_cookie: Boolean(Deno.env.get('APIFY_LINKEDIN_POSTS_COOKIE_JSON')?.trim()),
      }),
    );
    if (posts.length > 0) {
      return {
        posts,
        runId: run.runId,
        error: null,
        actorUsed: actorId,
        rawItems: run.items.length,
        searchUrls,
        searchQueries,
      };
    }
    if (isHarvestStyle && run.items.length > 0) {
      return {
        posts: [],
        runId: run.runId,
        error:
          `Actor returned ${run.items.length} posts but none matched Vizag hiring filters. ` +
          `Search used: "${searchQueries[0]}". Try FETCH_LINKEDIN_POST_SEARCH=jobs in vizag or loosen filters.`,
        actorUsed: actorId,
        rawItems: run.items.length,
        searchUrls,
        searchQueries,
      };
    }
    if (run.error && !/403|404|rent|not found|cookie/i.test(run.error)) {
      break;
    }
  }

  let hint = lastError;
  if (lastRaw === 0) {
    if (isApifyRentOrMissingError(lastError)) {
      hint =
        `${lastError ?? 'Posts actor unavailable'}. Remove APIFY_LINKEDIN_POSTS_ACTOR if set to curious_coder~linkedin-post-search-scraper (rental expired). Default is now harvestapi~linkedin-post-search (pay per post, ~$0.002 each).`;
    } else if (
      !Deno.env.get('APIFY_LINKEDIN_POSTS_COOKIE_JSON')?.trim() &&
      actors.some(isCuriousCoderPostsActor)
    ) {
      hint = `${lastError ?? 'No posts returned'}. curious_coder content scraper may need APIFY_LINKEDIN_POSTS_COOKIE_JSON; harvestapi actor uses keywords only.`;
    }
  }

  return {
    posts: [],
    runId: lastRunId,
    error: hint,
    actorUsed: null,
    rawItems: lastRaw,
    searchUrls,
    searchQueries,
  };
}

function getJobsActorCandidates(): string[] {
  const primary = Deno.env.get('APIFY_LINKEDIN_JOBS_ACTOR')?.trim() || DEFAULT_JOBS_ACTOR;
  const extra = Deno.env.get('APIFY_LINKEDIN_JOBS_ACTOR_FALLBACK')?.trim() || FALLBACK_JOBS_ACTOR;
  return [...new Set([primary, extra].map(normalizeActorId))];
}

async function runJobsActors(
  token: string,
  budget: FetchBudgetLike | undefined,
  instant: string,
): Promise<{ jobs: ApifyExtractedJob[]; runId: string | null; error: string | null; actorUsed: string | null }> {
  const actors = getJobsActorCandidates();
  let lastError: string | null = null;
  let lastRunId: string | null = null;

  for (const actorId of actors) {
    const input = buildJobsActorInput(actorId);
    const run = await apifyRunActor(actorId, input, token, budget);
    lastRunId = run.runId;
    lastError = run.error;
    const jobs = apifyItemsToLinkedInJobs(run.items, instant, LINKEDIN_VIZAG_24H_JOBS_LISTING_URL);
    console.log(
      JSON.stringify({
        event: 'apify_linkedin_jobs',
        actor: actorId,
        run_id: run.runId,
        raw_items: run.items.length,
        mapped_jobs: jobs.length,
        error: run.error,
      }),
    );
    if (jobs.length > 0) {
      return { jobs, runId: run.runId, error: null, actorUsed: actorId };
    }
    if (run.error && !/403|404|rent|not found/i.test(run.error)) {
      break;
    }
  }

  return { jobs: [], runId: lastRunId, error: lastError, actorUsed: null };
}

async function apifyRunSyncGetDatasetItems(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  timeoutSec: number,
): Promise<ApifyRunMeta> {
  const normalized = normalizeActorId(actorId);
  const url = new URL(`${APIFY_API_BASE}/acts/${normalized}/run-sync-get-dataset-items`);
  url.searchParams.set('timeout', String(timeoutSec));
  url.searchParams.set('format', 'json');
  url.searchParams.set('clean', 'true');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), (timeoutSec + 15) * 1000);

  try {
    const res = await fetch(url.href, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    const text = await res.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!res.ok) {
      const errMsg =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: { message?: string } }).error?.message ??
              (payload as { error?: string }).error)
          : res.statusText;
      return { runId: null, items: [], error: `Apify sync failed (${res.status}): ${errMsg}` };
    }

    const items = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)
        ? (payload as { items: Record<string, unknown>[] }).items
        : [];

    const runId =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? String((payload as { id?: string }).id ?? '') || null
        : null;

    return {
      runId,
      items: items as Record<string, unknown>[],
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { runId: null, items: [], error: message };
  } finally {
    clearTimeout(timer);
  }
}

async function apifyRunActorAndWait(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  timeoutSec: number,
): Promise<ApifyRunMeta> {
  const normalized = normalizeActorId(actorId);
  const startUrl = `${APIFY_API_BASE}/acts/${normalized}/runs?token=${encodeURIComponent(token)}`;

  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const startPayload = await startRes.json().catch(() => null);
  if (!startRes.ok) {
    const msg =
      startPayload?.error?.message ?? startPayload?.error ?? startRes.statusText;
    return { runId: null, items: [], error: `Apify run start failed: ${msg}` };
  }

  const runId = startPayload?.data?.id as string | undefined;
  if (!runId) {
    return { runId: null, items: [], error: 'Apify run start returned no run id' };
  }

  const waitUrl = `${APIFY_API_BASE}/actor-runs/${runId}?token=${encodeURIComponent(token)}&waitForFinish=${timeoutSec}`;
  const waitRes = await fetch(waitUrl);
  const waitPayload = await waitRes.json().catch(() => null);
  const status = waitPayload?.data?.status as string | undefined;
  const datasetId = waitPayload?.data?.defaultDatasetId as string | undefined;

  if (!waitRes.ok || status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
    return {
      runId,
      items: [],
      error: `Apify run ${runId} ended with status ${status ?? 'unknown'}`,
    };
  }

  if (!datasetId) {
    return { runId, items: [], error: 'Apify run has no dataset' };
  }

  const itemsUrl = `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&format=json&clean=true`;
  const itemsRes = await fetch(itemsUrl);
  const items = await itemsRes.json().catch(() => []);
  if (!itemsRes.ok || !Array.isArray(items)) {
    return { runId, items: [], error: 'Failed to read Apify dataset items' };
  }

  return { runId, items: items as Record<string, unknown>[], error: null };
}

export type ApifyRunActorOptions = {
  timeoutSec?: number;
  /** Skip polled actor-runs fallback — keeps Naukri fetch within edge CPU limits. */
  syncOnly?: boolean;
};

export async function apifyRunActor(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  budget?: FetchBudgetLike,
  options?: ApifyRunActorOptions,
): Promise<ApifyRunMeta> {
  const timeoutSec = options?.timeoutSec ?? apifySyncTimeoutSec(budget);
  const sync = await apifyRunSyncGetDatasetItems(actorId, input, token, timeoutSec);
  if (!sync.error && sync.items.length > 0) {
    return sync;
  }
  if (options?.syncOnly) {
    if (sync.items.length > 0) {
      return { ...sync, error: null };
    }
    return sync;
  }
  if (sync.error && /timeout|abort|413|payload/i.test(sync.error)) {
    return apifyRunActorAndWait(actorId, input, token, timeoutSec);
  }
  if (sync.error && sync.items.length === 0) {
    const polled = await apifyRunActorAndWait(actorId, input, token, timeoutSec);
    if (polled.items.length > 0) {
      return polled;
    }
    return sync.error ? sync : polled;
  }
  return sync;
}

export async function discoverLinkedInViaApify(
  budget?: FetchBudgetLike,
  scrapedAt?: string,
  mode: ApifyDiscoverMode = 'both',
  postPreset?: ResolvedLinkedInPostPreset,
): Promise<ApifyLinkedInDiscoverResult> {
  const jobsToken = getApifyTokenForRole('jobs');
  const postsToken = getApifyTokenForRole('posts');
  const token = mode === 'posts_only' ? postsToken : mode === 'jobs_only' ? jobsToken : jobsToken ?? postsToken;
  const empty: ApifyLinkedInDiscoverResult = {
    linkedin_provider: 'apify',
    jobs: [],
    posts: [],
    job_urls: [],
    linkedin_content_search_urls: getLinkedInContentSearchUrls(),
    apify_jobs_run_id: null,
    apify_posts_run_id: null,
    apify_jobs_count: 0,
    apify_posts_raw_count: 0,
    apify_posts_count: 0,
    apify_jobs_error: token ? null : 'APIFY_API_TOKEN not set',
    apify_posts_error: token ? null : 'APIFY_API_TOKEN not set',
  };

  if (!token) {
    return { ...empty, apify_jobs_error: 'APIFY_API_TOKEN not set', apify_posts_error: 'APIFY_API_TOKEN not set' };
  }

  validateApifyEnvJsonSecrets();

  const instant = scrapedAt ?? new Date().toISOString();
  const preset = postPreset ?? resolveLinkedInPostPreset('general');
  const contentSearchUrls = getLinkedInContentSearchUrls(preset);

  let jobs: ApifyExtractedJob[] = [];
  let posts: ApifyLinkedInContentPost[] = [];
  let apify_jobs_run_id: string | null = null;
  let apify_posts_run_id: string | null = null;
  let apify_jobs_error: string | null = null;
  let apify_posts_error: string | null = null;
  let apify_posts_raw_count = 0;

  const jobsEnabled = mode !== 'posts_only' && linkedInJobsListingEnabled();
  const postsEnabled = mode !== 'jobs_only' && linkedInPostsEnabled();
  const postsFirst =
    postsEnabled &&
    (Deno.env.get('FETCH_LINKEDIN_POSTS_PRIORITY') ?? 'true').toLowerCase() !== 'false';

  const runPosts = async () => {
    if (!postsEnabled) {
      return;
    }
    if (budget && !budget.hasTime(25_000)) {
      apify_posts_error = 'Skipped posts actor — insufficient time budget';
      return;
    }
    const postsResult = await runPostsActors(postsToken ?? token, budget, preset);
    apify_posts_run_id = postsResult.runId;
    apify_posts_error = postsResult.error;
    apify_posts_raw_count = postsResult.rawItems;
    posts = postsResult.posts;
    if (postsResult.posts.length > 0) {
      apify_posts_error = null;
    }
  };

  const runJobs = async () => {
    if (!jobsEnabled) {
      return;
    }
    if (budget && !budget.hasTime(30_000)) {
      return;
    }
    const jobsResult = await runJobsActors(jobsToken ?? token, budget, instant);
    apify_jobs_run_id = jobsResult.runId;
    apify_jobs_error = jobsResult.error;
    jobs = jobsResult.jobs;
    if (jobsResult.actorUsed && jobsResult.error === null) {
      apify_jobs_error = null;
    }
  };

  if (postsFirst) {
    await runPosts();
    await runJobs();
  } else {
    await runJobs();
    await runPosts();
  }

  const job_urls: string[] = [];
  for (const job of jobs) {
    const apply = job.apply_url ?? '';
    if (apply.includes('/jobs/view/')) {
      job_urls.push(apply);
    }
  }

  return {
    linkedin_provider: 'apify',
    jobs,
    posts,
    job_urls: [...new Set(job_urls)],
    linkedin_content_search_urls: contentSearchUrls,
    apify_jobs_run_id,
    apify_posts_run_id,
    apify_jobs_count: jobs.length,
    apify_posts_raw_count,
    apify_posts_count: posts.length,
    apify_jobs_error,
    apify_posts_error,
  };
}
