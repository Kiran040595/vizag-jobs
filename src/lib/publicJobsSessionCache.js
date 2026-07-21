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
 * Instant /ig paint: dedicated Instagram cache, or Instagram-flagged rows from
 * the shared public list cache (after someone already loaded the home page).
 */
export const readCachedInstagramJobs = () => {
  if (typeof sessionStorage === 'undefined') return null;

  try {
    const cachedRaw = sessionStorage.getItem(INSTAGRAM_JOBS_CACHE_KEY);
    if (cachedRaw) {
      const { jobs, timestamp } = JSON.parse(cachedRaw);
      const age = Date.now() - Number(timestamp);
      if (Array.isArray(jobs) && jobs.length > 0 && age < JOB_LIST_SESSION_CACHE_TTL_MS) {
        const visibleJobs = filterProcessedJobsForPublicDisplay(jobs);
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

  const igJobs = publicCached.jobs.filter(isInstagramListedJob);
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
