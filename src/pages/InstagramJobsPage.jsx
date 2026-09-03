import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import JobList from '../components/JobList';
import { fetchInstagramJobs } from '../services/jobs';
import {
  JOB_LIST_SESSION_CACHE_TTL_MS,
  readCachedInstagramJobs,
} from '../lib/publicJobsSessionCache';
import { INSTAGRAM_BIO_JOBS_PATH } from '../lib/instagramBioJobsPath';

const CACHE_STALE_AT_MS = Math.max(
  JOB_LIST_SESSION_CACHE_TTL_MS - 60_000,
  Math.floor(JOB_LIST_SESSION_CACHE_TTL_MS * 0.8),
);

const initialCached = (() => {
  try {
    return readCachedInstagramJobs();
  } catch {
    return null;
  }
})();

/**
 * Compact landing used as the social / bio link (/jobs/latest).
 * Public copy matches Jobs in Vizag — no third-party brand names.
 *
 * Bio-link traffic often reopens this page repeatedly; hydrate from session
 * cache on first paint so leaving and coming back does not re-show the spinner.
 */
export default function InstagramJobsPage() {
  const [jobs, setJobs] = useState(() => initialCached?.jobs || []);
  const [isLoading, setIsLoading] = useState(() => !(initialCached?.jobs?.length > 0));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;

    const loadJobs = async () => {
      const cached = readCachedInstagramJobs();
      if (cached?.jobs?.length) {
        setJobs(cached.jobs);
        setIsLoading(false);
        // Fresh enough — skip network. Near TTL end, refresh quietly in background.
        if (cached.age <= CACHE_STALE_AT_MS) {
          return;
        }
        setIsRefreshing(true);
        try {
          const rows = await fetchInstagramJobs({ forceRefresh: true });
          if (!ignore) {
            setJobs(rows);
            setLoadError('');
          }
        } catch (error) {
          console.warn('Background Instagram jobs refresh failed:', error);
        } finally {
          if (!ignore) setIsRefreshing(false);
        }
        return;
      }

      try {
        const rows = await fetchInstagramJobs();
        if (!ignore) {
          setJobs(rows);
          setLoadError('');
        }
      } catch (error) {
        if (!ignore) {
          setLoadError(error instanceof Error ? error.message : 'Could not load jobs.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    void loadJobs();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      <SEO
        title="Latest jobs in Vizag | Jobs in Vizag"
        description="Browse the latest job openings in Visakhapatnam and apply on Jobs in Vizag."
        canonical={INSTAGRAM_BIO_JOBS_PATH}
        noindex
      />
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">Jobs in Vizag</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">Latest openings</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Fresh roles in Visakhapatnam. Open a job to view details and apply.
          {isRefreshing ? (
            <span className="ml-2 text-xs font-medium text-blue-600">Updating…</span>
          ) : null}
        </p>

        {isLoading ? (
          <div className="mt-10">
            <LoadingSpinner message="Loading jobs..." />
          </div>
        ) : null}

        {!isLoading && loadError ? (
          <p className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </p>
        ) : null}

        {!isLoading && !loadError && jobs.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h2 className="text-lg font-bold text-slate-900">No openings listed here yet</h2>
            <p className="mt-2 text-sm text-slate-600">Browse all current jobs on Jobs in Vizag.</p>
            <Link
              to="/jobs"
              className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Browse all jobs
            </Link>
          </div>
        ) : null}

        {!isLoading && jobs.length > 0 ? (
          <div className="mt-8">
            <JobList jobs={jobs} />
            <div className="mt-8 text-center">
              <Link
                to="/jobs"
                className="inline-flex rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                View all jobs
              </Link>
            </div>
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
