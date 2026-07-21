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

export const jobMatchesSearchText = (job, raw) => {
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
  return blob.includes(q);
};
