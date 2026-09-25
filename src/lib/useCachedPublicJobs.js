import { useEffect, useState } from 'react';
import { fetchJobs } from '../services/jobs';
import { filterProcessedJobsForPublicDisplay } from './jobDisplayWindow';
import { readCachedPublicJobs, writeCachedPublicJobs } from './publicJobsSessionCache';

export { PUBLIC_JOBS_CACHE_KEY, readCachedPublicJobs, writeCachedPublicJobs } from './publicJobsSessionCache';

/**
 * Load published jobs with sessionStorage cache (shared across listing pages).
 */
export function useCachedPublicJobs() {
  const [allJobs, setAllJobs] = useState(() => readCachedPublicJobs()?.jobs || []);
  const [isLoading, setIsLoading] = useState(() => {
    // Re-read is cheap; keep initializer self-contained for Strict Mode remounts.
    return !(readCachedPublicJobs()?.jobs?.length > 0);
  });
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadJobs = async () => {
      const cached = readCachedPublicJobs();
      if (cached?.jobs?.length) {
        if (isMounted) {
          setAllJobs(cached.jobs);
          setIsLoading(false);
        }
        return;
      }

      try {
        const jobs = await fetchJobs();
        if (!isMounted) return;

        if (jobs.length > 0) {
          const visibleJobs = filterProcessedJobsForPublicDisplay(jobs);
          setAllJobs(visibleJobs);
          writeCachedPublicJobs(jobs);
          setLoadError('');
          return;
        }

        setLoadError('No jobs found. Please check back later.');
      } catch (error) {
        if (!isMounted) return;
        setLoadError(
          error instanceof Error ? error.message : 'Could not load jobs. Please check your connection.',
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadJobs();

    return () => {
      isMounted = false;
    };
  }, []);

  return { allJobs, isLoading, loadError };
}

export const cleanSearchBrand = (term = '') => {
  return String(term)
    .replace(/\b(pvt\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|llp|inc\.?|corp\.?|corporation)\b/gi, '')
    .replace(/[,.\-–—]+$/, '')
    .trim();
};

export const jobMatchesSearchText = (job, raw) => {
  if (!raw) return true;
  const q = raw.trim().toLowerCase();
  if (!q) return true;

  const blob = [
    job.title,
    job.company,
    job.skills,
    job.shortDescription,
    job.category,
    job.location,
    job.experience,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // 1. Exact substring match
  if (blob.includes(q)) return true;

  // 2. Cleaned corporate suffix match (e.g. "Miracle Software Systems Inc." -> "miracle software systems")
  const cleanQ = cleanSearchBrand(q).toLowerCase();
  if (cleanQ && cleanQ !== q && blob.includes(cleanQ)) return true;

  // 3. Multi-word search token matching (all words with length > 2 present in job blob)
  const words = (cleanQ || q).split(/\s+/).filter((w) => w.length > 2);
  if (words.length > 1 && words.every((w) => blob.includes(w))) return true;

  return false;
};
