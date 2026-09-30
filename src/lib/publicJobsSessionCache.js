import { filterProcessedJobsForPublicDisplay } from './jobDisplayWindow.js';

/**
 * Shared session-storage TTL for the public listing pages. Bumped from 5 min
 * to 20 min to reduce repeat fetches per session — the public site doesn't
 * need fresher-than-this data, and the in-memory cache (60s) still keeps
 * navigation snappy.
 */
export const JOB_LIST_SESSION_CACHE_TTL_MS = 20 * 60 * 1000;

export const PUBLIC_JOBS_CACHE_KEY = 'vizagJobs_v2';

/**
 * Synchronously read a still-valid public job list from sessionStorage.
 * Used for first paint so return visits don't flash the loading spinner.
 */
export const readCachedPublicJobs = () => {
  if (typeof sessionStorage === 'undefined') return null;

  try {
    const cachedRaw = sessionStorage.getItem(PUBLIC_JOBS_CACHE_KEY);
    if (!cachedRaw) return null;

    const { jobs, timestamp } = JSON.parse(cachedRaw);
    const age = Date.now() - Number(timestamp);
    if (!Array.isArray(jobs) || jobs.length === 0 || age >= JOB_LIST_SESSION_CACHE_TTL_MS) {
      return null;
    }

    const visibleJobs = filterProcessedJobsForPublicDisplay(jobs);
    if (visibleJobs.length === 0) return null;

    return { jobs: visibleJobs, age, timestamp: Number(timestamp) };
  } catch (error) {
    console.error('Error parsing cached jobs:', error);
    return null;
  }
};

export const writeCachedPublicJobs = (jobs) => {
  if (typeof sessionStorage === 'undefined' || !Array.isArray(jobs) || jobs.length === 0) {
    return;
  }

  try {
    sessionStorage.setItem(
      PUBLIC_JOBS_CACHE_KEY,
      JSON.stringify({ jobs, timestamp: Date.now() }),
    );
  } catch (error) {
    // QuotaExceeded or private mode — listing still works without the cache.
    console.warn('Could not write jobs session cache:', error);
  }
};

export const INSTAGRAM_JOBS_CACHE_KEY = 'vizagJobs_ig_v1';

const isInstagramListedJob = (job) => Boolean(job?.isInstagram ?? job?.is_instagram);

/**
 * Instant /apply paint: dedicated Instagram cache, or Instagram-flagged rows from
 * the shared public list cache (after someone already loaded the home page).
 */
export const readCachedInstagramJobs = (limit = 10) => {
  if (typeof sessionStorage === 'undefined') return null;

  try {
    const cachedRaw = sessionStorage.getItem(INSTAGRAM_JOBS_CACHE_KEY);
    if (cachedRaw) {
      const { jobs, timestamp } = JSON.parse(cachedRaw);
      const age = Date.now() - Number(timestamp);
      if (Array.isArray(jobs) && jobs.length > 0 && age < JOB_LIST_SESSION_CACHE_TTL_MS) {
        const visibleJobs = filterProcessedJobsForPublicDisplay(jobs).slice(0, limit);
        if (visibleJobs.length > 0) {
          return { jobs: visibleJobs, age, timestamp: Number(timestamp) };
        }
      }
    }
  } catch (error) {
    console.error('Error parsing Instagram jobs cache:', error);
  }

  const publicCached = readCachedPublicJobs();
  if (!publicCached?.jobs?.length) return null;

  const igJobs = publicCached.jobs.filter(isInstagramListedJob).slice(0, limit);
  if (igJobs.length === 0) return null;

  return { jobs: igJobs, age: publicCached.age, timestamp: publicCached.timestamp };
};

export const writeCachedInstagramJobs = (jobs) => {
  if (typeof sessionStorage === 'undefined' || !Array.isArray(jobs) || jobs.length === 0) {
    return;
  }

  try {
    sessionStorage.setItem(
      INSTAGRAM_JOBS_CACHE_KEY,
      JSON.stringify({ jobs, timestamp: Date.now() }),
    );
  } catch (error) {
    console.warn('Could not write Instagram jobs session cache:', error);
  }
};

export const clearCachedInstagramJobs = () => {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(INSTAGRAM_JOBS_CACHE_KEY);
  } catch {
    // ignore
  }
};

/**
 * 10-minute cache TTL for the public companies directory and job counts.
 * Reduces database calls while keeping company profiles snappy.
 */
export const COMPANY_DIRECTORY_CACHE_TTL_MS = 10 * 60 * 1000;
export const PUBLIC_COMPANIES_CACHE_KEY = 'vizagJobs_companies_v1';

export const readCachedPublicCompanies = () => {
  const getRaw = () => {
    try {
      if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(PUBLIC_COMPANIES_CACHE_KEY);
        if (item) return item;
      }
    } catch {
      // LocalStorage might be disabled or restricted
    }
    try {
      if (typeof sessionStorage !== 'undefined') {
        return sessionStorage.getItem(PUBLIC_COMPANIES_CACHE_KEY);
      }
    } catch {
      // ignore
    }
    return null;
  };

  try {
    const raw = getRaw();
    if (!raw) return null;

    const { companies, timestamp } = JSON.parse(raw);
    const age = Date.now() - Number(timestamp);
    if (!Array.isArray(companies) || companies.length === 0 || age >= COMPANY_DIRECTORY_CACHE_TTL_MS) {
      return null;
    }

    return { companies, age, timestamp: Number(timestamp) };
  } catch (error) {
    console.error('Error parsing cached companies directory:', error);
    return null;
  }
};

export const writeCachedPublicCompanies = (companies) => {
  if (!Array.isArray(companies) || companies.length === 0) return;

  const payload = JSON.stringify({ companies, timestamp: Date.now() });

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PUBLIC_COMPANIES_CACHE_KEY, payload);
    }
  } catch (error) {
    console.warn('Could not write companies to localStorage:', error);
  }

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(PUBLIC_COMPANIES_CACHE_KEY, payload);
    }
  } catch (error) {
    console.warn('Could not write companies to sessionStorage:', error);
  }
};

export const clearCachedPublicCompanies = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(PUBLIC_COMPANIES_CACHE_KEY);
    }
  } catch {
    // ignore
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(PUBLIC_COMPANIES_CACHE_KEY);
    }
  } catch {
    // ignore
  }
};

