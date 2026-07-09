import { useEffect, useState } from 'react';
import { JOB_LIST_SESSION_CACHE_TTL_MS, fetchJobs } from '../services/jobs';
import { filterProcessedJobsForPublicDisplay } from './jobDisplayWindow';
import { sortJobsForPublicDisplay } from './jobListSort';

const CACHE_KEY = 'vizagJobs';

/**
 * Load published jobs with sessionStorage cache (shared across listing pages).
 */
export function useCachedPublicJobs() {
  const [allJobs, setAllJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadJobs = async () => {
      const cachedData = sessionStorage.getItem(CACHE_KEY);

      if (cachedData) {
        try {
          const { jobs, timestamp } = JSON.parse(cachedData);
          const age = Date.now() - Number(timestamp);
          if (Array.isArray(jobs) && jobs.length > 0 && age < JOB_LIST_SESSION_CACHE_TTL_MS) {
            const visibleJobs = filterProcessedJobsForPublicDisplay(jobs);
            if (visibleJobs.length > 0) {
              if (isMounted) {
                setAllJobs(sortJobsForPublicDisplay(visibleJobs));
                setIsLoading(false);
              }
              return;
            }
          }
        } catch (error) {
          console.error('Error parsing cached jobs:', error);
        }
      }

      try {
        const jobs = await fetchJobs();
        if (!isMounted) return;

        if (jobs.length > 0) {
          const visibleJobs = sortJobsForPublicDisplay(filterProcessedJobsForPublicDisplay(jobs));
          setAllJobs(visibleJobs);
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ jobs, timestamp: Date.now() }));
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
