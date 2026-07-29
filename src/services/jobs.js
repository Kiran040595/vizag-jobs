import { isSupabaseConfigured, supabase, supabasePublic } from '../lib/supabaseClient';
import { getMinPostedAtIsoForPublicDisplay } from '../lib/jobDisplayWindow';
import { sanitizeJobSeoRecord } from '../lib/jobDisplayLabels.js';
import { resolveJobExperienceForDisplay } from '../lib/jobRecordInference.js';
import { writeCachedInstagramJobs } from '../lib/publicJobsSessionCache';

export { JOB_LIST_SESSION_CACHE_TTL_MS } from '../lib/publicJobsSessionCache';

/** Prefer the anon client so public lists never block on auth session refresh. */
const getPublicClient = () => supabasePublic || supabase;

const CACHE_DURATION = 60_000;
const instagramJobsCache = { jobs: null, timestamp: 0 };
const DEFAULT_TABLE_NAME = 'jobs';
const jobsTable = import.meta.env.VITE_SUPABASE_JOBS_TABLE || DEFAULT_TABLE_NAME;

/**
 * Optional hard cap when callers pass `filters.limit`.
 * Default list queries load every published job within the public display window
 * (last 30 days by posted_at), using pagination when needed.
 */
export const DEFAULT_LIST_LIMIT = null;

/** Supabase/PostgREST page size for paginated job list fetches. */
const JOB_LIST_PAGE_SIZE = 1000;

/**
 * Slim column allow-list for listing queries. Anything the home-page card,
 * filter pills, search, freshness check, sitemap, or canonical-URL builder
 * needs — and nothing that's only used on the detail page.
 *
 * Heavy fields intentionally left out (loaded on the detail page via
 * `fetchJobById` instead): description, responsibilities, eligibility,
 * json_ld, warning, apply_link, source_url. Those four big text/JSON fields
 * are typically 80-90% of a row's bytes.
 */
const LIST_COLUMNS = [
  'id',
  'slug',
  'title',
  'company',
  'location',
  'category',
  'role',
  'job_type',
  'work_mode',
  'experience',
  'is_fresher',
  'is_featured',
  'is_instagram',
  'group_link',
  'salary',
  'short_description',
  'skills',
  'company_logo_url',
  'source_name',
  'posted_at',
  'expires_at',
  'status',
].join(', ');

const jobsCache = new Map();

const generateCacheKey = (filters = {}) => {
  const cacheParams = {
    category: filters.category || null,
    jobType: filters.jobType || null,
    isFresher: filters.isFresher !== undefined ? filters.isFresher : null,
    search: filters.search || null,
    limit: filters.limit ?? null,
  };

  return JSON.stringify(cacheParams);
};

const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelay * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return [];
};

const normalizeText = (value, fallback = '') => {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
};

const joinList = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ');
  }

  return normalizeText(value);
};

const normalizeFresherValue = (value) => (value ? 'Yes' : 'No');

/**
 * Map a Supabase row to the public-facing shape consumed by the UI.
 *
 * Heavy/optional fields (`description`, `responsibilities`, `eligibility`,
 * `json_ld`, `warning`, `apply_link`, `source_url`) are forwarded only when
 * the caller requested them via `fetchJobById`; in list responses they will
 * simply be `undefined`/empty, which all consumers already handle.
 */
const processJobData = (job, index) => {
  const category = normalizeText(job.category);
  const jobType = normalizeText(job.job_type);
  const isFresher = normalizeFresherValue(job.is_fresher);
  const fresherTag = isFresher === 'Yes' ? 'Fresher' : 'Experienced';

  const base = {
    id: job.id || `supabase-job-${index + 1}`,
    slug: normalizeText(job.slug),
    title: normalizeText(job.title),
    company: normalizeText(job.company),
    location: normalizeText(job.location, 'Visakhapatnam'),
    category,
    role: normalizeText(job.role) || normalizeText(job.title),
    jobType,
    workMode: normalizeText(job.work_mode),
    experience: normalizeText(job.experience),
    isFresher,
    isFeatured: Boolean(job.is_featured),
    isInstagram: Boolean(job.is_instagram),
    groupLink: normalizeText(job.group_link),
    salary: normalizeText(job.salary),
    applyLink: normalizeText(job.apply_link),
    applyMode: job.apply_mode === 'internal' ? 'internal' : 'external',
    description: normalizeText(job.description),
    shortDescription: normalizeText(job.short_description),
    responsibilities: joinList(job.responsibilities),
    eligibility: joinList(job.eligibility),
    warning: normalizeText(job.warning),
    postedAt: normalizeText(job.posted_at),
    status: normalizeText(job.status),
    createdBy: job.created_by || null,
    source: normalizeText(job.source_name),
    sourceUrl: normalizeText(job.source_url),
    skills: joinList(job.skills),
    companyLogo: normalizeText(job.company_logo_url),
    companyLogoUrl: normalizeText(job.company_logo_url),
    jsonLd:
      job.json_ld && typeof job.json_ld === 'object' && !Array.isArray(job.json_ld)
        ? job.json_ld
        : null,
    expiresAt: normalizeText(job.expires_at),
    tags: [category, jobType, fresherTag].filter(Boolean),
  };

  return sanitizeJobSeoRecord({
    ...base,
    experience: resolveJobExperienceForDisplay(base) ?? '',
  });
};

const escapeIlike = (value) => value.replaceAll('%', '\\%').replaceAll(',', '\\,');

const buildSupabaseQuery = (filters = {}, options = {}) => {
  const { applyLimit = true } = options;
  const limit = filters.limit ?? DEFAULT_LIST_LIMIT;
  const client = getPublicClient();

  let query = client
    .from(jobsTable)
    .select(LIST_COLUMNS)
    .eq('status', 'published')
    .gte('posted_at', getMinPostedAtIsoForPublicDisplay())
    .order('is_featured', { ascending: false })
    .order('posted_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.category) {
    query = query.ilike('category', filters.category);
  }

  if (filters.jobType) {
    query = query.ilike('job_type', filters.jobType);
  }

  if (filters.isFresher !== undefined && filters.isFresher !== null) {
    query = query.eq('is_fresher', Boolean(filters.isFresher));
  }

  if (filters.search) {
    const term = escapeIlike(filters.search.trim());
    // NOTE: description was intentionally removed from the OR set since
    // the slim list query no longer fetches it. Searching covers
    // title/company/short_description here, and the client-side filter
    // (jobFilters.applyJobFilters) covers skills/location/experience.
    query = query.or(
      `title.ilike.%${term}%,company.ilike.%${term}%,short_description.ilike.%${term}%`,
    );
  }

  if (applyLimit && limit !== null && limit !== undefined) {
    query = query.limit(Number(limit));
  }

  return query;
};

const fetchJobsPaginated = async (filters = {}) => {
  const maxRows = filters.limit ?? null;
  let offset = 0;
  const allRows = [];

  while (true) {
    const from = offset;
    const to = offset + JOB_LIST_PAGE_SIZE - 1;
    const { data, error } = await buildSupabaseQuery(filters, { applyLimit: false }).range(from, to);

    if (error) {
      throw new Error(`Supabase jobs query failed: ${error.message}`);
    }

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    allRows.push(...data);

    if (maxRows && allRows.length >= maxRows) {
      return allRows.slice(0, maxRows);
    }

    if (data.length < JOB_LIST_PAGE_SIZE) {
      break;
    }

    offset += JOB_LIST_PAGE_SIZE;
  }

  return allRows;
};

export const fetchJobs = async (filters = {}, forceRefresh = false) => {
  if (!isSupabaseConfigured || !getPublicClient()) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
    );
  }

  const actualFilters = {
    ...filters,
  };

  const cacheKey = generateCacheKey(actualFilters);
  const cachedData = jobsCache.get(cacheKey);

  if (!forceRefresh && cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return cachedData.jobs;
  }

  const jobsData = await retryWithBackoff(async () => {
    const data = await fetchJobsPaginated(actualFilters);

    if (!Array.isArray(data)) {
      throw new Error('Supabase returned an invalid jobs response.');
    }

    return data;
  });

  const processedJobs = jobsData.map(processJobData);

  jobsCache.set(cacheKey, {
    jobs: processedJobs,
    timestamp: Date.now(),
  });

  return processedJobs;
};

/**
 * Fetch a single job by its UUID `id` or its `slug`. Used by the detail page
 * so it doesn't have to download the entire list to render one row.
 *
 * Returns `null` when no matching published job exists within the public
 * display window. Heavy fields (description, json_ld, etc.) are included
 * because the detail page needs them.
 *
 * Note: we cannot use a single `.or('id.eq.X,slug.eq.X')` filter — Postgres
 * has to cast every operand at parse time, so a non-UUID slug would crash
 * the `id::uuid` cast before the OR could short-circuit. Dispatch by shape
 * instead and run a single targeted equality check against the right column.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const jobByIdCache = new Map();

export const fetchJobById = async (idOrSlug, options = {}) => {
  const { forceRefresh = false } = options;
  if (!idOrSlug) return null;

  const key = String(idOrSlug);
  const includeAllStatuses = Boolean(options.includeAllStatuses);
  // Admin/draft lookups need the authenticated client (RLS); public reads use
  // the anon client so they never wait on session refresh.
  const client = includeAllStatuses ? supabase : getPublicClient();
  if (!isSupabaseConfigured || !client) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
    );
  }

  // Cache buckets are per-scope so a public miss followed by an admin hit
  // (or vice-versa) doesn't return stale data from the wrong bucket.
  const cacheKey = includeAllStatuses ? `admin:${key}` : `public:${key}`;
  const cached = jobByIdCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.job;
  }

  const lookupColumn = UUID_RE.test(key) ? 'id' : 'slug';

  const data = await retryWithBackoff(async () => {
    let query = client.from(jobsTable).select('*').eq(lookupColumn, key).limit(1);

    // Admin viewers can read drafts/archived rows (RLS still gates this);
    // public viewers only see published jobs within the display window.
    if (!includeAllStatuses) {
      query = query
        .eq('status', 'published')
        .gte('posted_at', getMinPostedAtIsoForPublicDisplay());
    }

    const { data: rows, error } = await query;

    if (error) {
      throw new Error(`Supabase job lookup failed: ${error.message}`);
    }
    return rows;
  });

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  const job = row ? processJobData(row, 0) : null;

  jobByIdCache.set(cacheKey, { job, timestamp: Date.now() });
  return job;
};

/** Published jobs marked for the Instagram bio page (/jobs/latest), newest first. */
export const fetchInstagramJobs = async (options = {}) => {
  const { forceRefresh = false } = options;
  const client = getPublicClient();
  if (!isSupabaseConfigured || !client) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
    );
  }

  if (
    !forceRefresh &&
    Array.isArray(instagramJobsCache.jobs) &&
    Date.now() - instagramJobsCache.timestamp < CACHE_DURATION
  ) {
    return instagramJobsCache.jobs;
  }

  const data = await retryWithBackoff(async () => {
    const { data: rows, error } = await client
      .from(jobsTable)
      .select(LIST_COLUMNS)
      .eq('status', 'published')
      .eq('is_instagram', true)
      .gte('posted_at', getMinPostedAtIsoForPublicDisplay())
      .order('posted_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase Instagram jobs fetch failed: ${error.message}`);
    }
    return rows || [];
  });

  const processed = data.map((row, index) => processJobData(row, index));
  instagramJobsCache.jobs = processed;
  instagramJobsCache.timestamp = Date.now();
  writeCachedInstagramJobs(processed);
  return processed;
};

export const getAllJobs = async (limit, forceRefresh = false) =>
  fetchJobs(limit ? { limit } : {}, forceRefresh);

export const getFresherJobs = async (limit, forceRefresh = false) =>
  fetchJobs(limit ? { isFresher: true, limit } : { isFresher: true }, forceRefresh);

export const getJobsByCategory = async (category, limit, forceRefresh = false) =>
  fetchJobs(limit ? { category, limit } : { category }, forceRefresh);

export const getJobsByType = async (jobType, limit, forceRefresh = false) =>
  fetchJobs(limit ? { jobType, limit } : { jobType }, forceRefresh);

export const searchJobs = async (searchTerm, limit, forceRefresh = false) =>
  fetchJobs(limit ? { search: searchTerm, limit } : { search: searchTerm }, forceRefresh);

export const clearJobsCache = () => {
  jobsCache.clear();
  jobByIdCache.clear();
  instagramJobsCache.jobs = null;
  instagramJobsCache.timestamp = 0;
};
