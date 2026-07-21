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
