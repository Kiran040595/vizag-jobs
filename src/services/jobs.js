import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { getMinPostedAtIsoForPublicDisplay } from '../lib/jobDisplayWindow';

const CACHE_DURATION = 60000;
const DEFAULT_TABLE_NAME = 'jobs';
const jobsTable = import.meta.env.VITE_SUPABASE_JOBS_TABLE || DEFAULT_TABLE_NAME;

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

const processJobData = (job, index) => {
  const category = normalizeText(job.category);
  const jobType = normalizeText(job.job_type);
  const isFresher = normalizeFresherValue(job.is_fresher);
  const fresherTag = isFresher === 'Yes' ? 'Fresher' : 'Experienced';

  return {
    id: job.id || `supabase-job-${index + 1}`,
    slug: normalizeText(job.slug),
    title: normalizeText(job.title),
    company: normalizeText(job.company),
    location: normalizeText(job.location, 'Visakhapatnam'),
    category,
    jobType,
    workMode: normalizeText(job.work_mode),
    experience: normalizeText(job.experience, 'Not specified'),
    isFresher,
    salary: normalizeText(job.salary),
    applyLink: normalizeText(job.apply_link),
    description: normalizeText(job.description),
    shortDescription: normalizeText(job.short_description),
    responsibilities: joinList(job.responsibilities),
    eligibility: joinList(job.eligibility),
    warning: normalizeText(job.warning),
    postedAt: normalizeText(job.posted_at),
    status: normalizeText(job.status),
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
};

const escapeIlike = (value) => value.replaceAll('%', '\\%').replaceAll(',', '\\,');

const buildSupabaseQuery = (filters = {}) => {
  let query = supabase
    .from(jobsTable)
    .select('*')
    .eq('status', 'published')
    .gte('posted_at', getMinPostedAtIsoForPublicDisplay())
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
    query = query.or(`title.ilike.%${term}%,company.ilike.%${term}%,description.ilike.%${term}%`);
  }

  if (filters.limit !== undefined && filters.limit !== null) {
    query = query.limit(Number(filters.limit));
  }

  return query;
};

export const fetchJobs = async (filters = {}, forceRefresh = false) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
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
    const { data, error } = await buildSupabaseQuery(actualFilters);

    if (error) {
      throw new Error(`Supabase jobs query failed: ${error.message}`);
    }

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
};
