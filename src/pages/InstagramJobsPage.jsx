import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import JobList from '../components/JobList';
import { fetchInstagramJobs } from '../services/jobs';

/**
 * Compact landing used as the social / bio link (route stays /ig).
 * Public copy matches Jobs in Vizag — no third-party brand names.
 */
export default function InstagramJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;

    fetchInstagramJobs()
      .then((rows) => {
        if (!ignore) {
          setJobs(rows);
          setLoadError('');
        }
      })
      .catch((error) => {
        if (!ignore) {
          setLoadError(error instanceof Error ? error.message : 'Could not load jobs.');
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      <SEO
        title="Latest jobs in Vizag | Jobs in Vizag"
        description="Browse the latest job openings in Visakhapatnam and apply on Jobs in Vizag."
        canonical="/ig"
        noindex
      />
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">Jobs in Vizag</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">Latest openings</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Fresh roles in Visakhapatnam. Open a job to view details and apply.
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
