import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import FullJobDetailsLink from '../components/FullJobDetailsLink';
import { fetchInstagramJobs } from '../services/jobs';
import { getJobDetailPath } from '../lib/jobRoutes';
import { displayCompanyName, displayLocation } from '../lib/jobDisplayLabels';
import { SITE_URL } from '../lib/site';

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
          setLoadError(error instanceof Error ? error.message : 'Could not load Instagram jobs.');
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
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-slate-50">
      <SEO
        title="Instagram jobs | Vizag Jobs"
        description="Jobs shared on the Vizag Jobs Instagram. Open a role and apply on jobsinvizag.in."
        canonical="/ig"
        noindex
      />
      <Navbar />

      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pink-600">From Instagram</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">Jobs from our Instagram</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          These are the openings we are promoting on Instagram. Tap a job to view details and apply on Vizag
          Jobs.
        </p>
        <p className="mt-2 text-xs text-slate-500">Bio link: {SITE_URL.replace(/^https?:\/\//, '')}/ig</p>

        {isLoading ? (
          <div className="mt-10">
            <LoadingSpinner message="Loading Instagram jobs..." />
          </div>
        ) : null}

        {!isLoading && loadError ? (
          <p className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </p>
        ) : null}

        {!isLoading && !loadError && jobs.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h2 className="text-lg font-bold text-slate-900">No Instagram jobs right now</h2>
            <p className="mt-2 text-sm text-slate-600">Check back soon, or browse all openings on the site.</p>
            <Link
              to="/jobs"
              className="mt-6 inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Browse all jobs
            </Link>
          </div>
        ) : null}

        {!isLoading && jobs.length > 0 ? (
          <ul className="mt-8 space-y-4">
            {jobs.map((job) => {
              const jobPath = getJobDetailPath(job);
              return (
                <li
                  key={job.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60"
                >
                  <h2 className="text-lg font-extrabold leading-snug text-slate-950">{job.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {displayCompanyName(job.company)} · {displayLocation(job.location)}
                  </p>
                  {job.shortDescription ? (
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{job.shortDescription}</p>
                  ) : null}
                  <div className="mt-4">
                    <FullJobDetailsLink
                      jobPath={jobPath}
                      className="block w-full rounded-2xl bg-pink-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-pink-500"
                    >
                      View &amp; apply
                    </FullJobDetailsLink>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
