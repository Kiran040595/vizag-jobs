import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchInstagramJobs } from '../services/jobs';
import {
  JOB_LIST_SESSION_CACHE_TTL_MS,
  readCachedInstagramJobs,
} from '../lib/publicJobsSessionCache';
import { INSTAGRAM_BIO_JOBS_PATH } from '../lib/instagramBioJobsPath';
import { getJobDetailPath } from '../lib/jobRoutes';
import {
  cardCompanyName,
  cardLocation,
  cardSalary,
  cardJobType,
  cardWorkMode,
} from '../lib/jobCardDisplay';
import { resolveJobExperienceForDisplay } from '../lib/jobRecordInference';
import { formatRelativePostedAt } from '../lib/jobFreshness';
import { getDirectPostingBadge } from '../lib/jobDirectPosting';

const CACHE_STALE_AT_MS = Math.max(
  JOB_LIST_SESSION_CACHE_TTL_MS - 60_000,
  Math.floor(JOB_LIST_SESSION_CACHE_TTL_MS * 0.8),
);

const AVATAR_GRADIENTS = [
  'from-blue-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-violet-600 to-purple-700',
  'from-amber-500 to-orange-600',
  'from-rose-600 to-pink-700',
  'from-cyan-600 to-blue-700',
];

const getAvatarGradient = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

const getCompanyInitials = (name = '') => {
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  if (!clean) return 'VJ';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const initialCached = (() => {
  try {
    return readCachedInstagramJobs(5);
  } catch {
    return null;
  }
})();

export default function InstagramJobsPage() {
  const [jobs, setJobs] = useState(() => initialCached?.jobs || []);
  const [isLoading, setIsLoading] = useState(() => !(initialCached?.jobs?.length > 0));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;

    const loadJobs = async () => {
      const cached = readCachedInstagramJobs(5);
      if (cached?.jobs?.length) {
        setJobs(cached.jobs);
        setIsLoading(false);
        if (cached.age <= CACHE_STALE_AT_MS) {
          return;
        }
        setIsRefreshing(true);
        try {
          const rows = await fetchInstagramJobs({ forceRefresh: true, limit: 5 });
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
        const rows = await fetchInstagramJobs({ limit: 5 });
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/50 to-slate-50 text-slate-900">
      <SEO
        title="Apply for Latest Jobs in Vizag | Jobs in Vizag"
        description="Quickly apply to the latest job openings in Visakhapatnam featured on our Instagram."
        canonical={INSTAGRAM_BIO_JOBS_PATH}
        noindex
      />
      <Navbar />

      <main className="mx-auto w-full max-w-2xl px-4 py-6 pb-28 sm:px-6 sm:py-10 sm:pb-24">
        {/* Instagram Bio Header */}
        <header className="relative text-center">
          {/* Subtle Ambient Background Glow */}
          <div
            className="pointer-events-none absolute -top-10 left-1/2 -z-10 h-44 w-72 -translate-x-1/2 rounded-full bg-gradient-to-tr from-pink-200/40 via-purple-200/30 to-blue-200/40 blur-3xl"
            aria-hidden="true"
          />

          <div className="inline-flex items-center gap-2 rounded-full border border-pink-200/80 bg-gradient-to-r from-pink-50 via-rose-50 to-purple-50 px-4 py-1.5 text-xs font-bold text-pink-700 shadow-sm ring-2 ring-pink-500/10">
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
            <span>Instagram Bio Openings</span>
          </div>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
            Recent Jobs in Vizag
          </h1>

          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
            Tap the job you saw on our Instagram to view full eligibility and submit your application directly.
            {isRefreshing ? (
              <span className="ml-2 text-xs font-semibold text-blue-600 animate-pulse">
                • Updating…
              </span>
            ) : null}
          </p>
        </header>

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <LoadingSpinner message="Finding latest Instagram jobs..." />
          </div>
        ) : null}

        {/* Error Notice */}
        {!isLoading && loadError ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50/80 p-5 text-center text-sm text-rose-800 shadow-sm">
            <p className="font-semibold">Unable to load jobs at this moment.</p>
            <p className="mt-1 text-xs text-rose-600">{loadError}</p>
            <Link
              to="/jobs"
              className="mt-4 inline-flex items-center rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
            >
              Browse all jobs on website
            </Link>
          </div>
        ) : null}

        {/* Empty State */}
        {!isLoading && !loadError && jobs.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600">
              💼
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900 sm:text-xl">
              No recent Instagram openings active right now
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              We update this list with every new post. You can explore over 100+ active jobs across Visakhapatnam right now.
            </p>
            <Link
              to="/jobs"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 active:scale-95"
            >
              <span>Check All Jobs in Vizag</span>
              <span>→</span>
            </Link>
          </div>
        ) : null}

        {/* Curated Jobs List (Top 5) */}
        {!isLoading && jobs.length > 0 ? (
          <section className="mt-6 space-y-4" aria-label="Featured Instagram jobs">
            <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Showing top {jobs.length} latest posts</span>
              </span>
              <span>Sorted by newest</span>
            </div>

            <div className="space-y-4">
              {jobs.map((job) => {
                const company = cardCompanyName(job.company) || 'Company in Vizag';
                const location = cardLocation(job.location) || 'Visakhapatnam';
                const experience = resolveJobExperienceForDisplay(job);
                const salary = cardSalary(job.salary);
                const jobType = cardJobType(job.jobType);
                const workMode = cardWorkMode(job.workMode);
                const relativeTime = formatRelativePostedAt(job.postedAt);
                const directBadge = getDirectPostingBadge(job);
                const jobPath = getJobDetailPath(job);
                const avatarGradient = getAvatarGradient(company);
                const initials = getCompanyInitials(company);

                return (
                  <article
                    key={job.id}
                    className="group relative rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg sm:p-6"
                  >
                    {/* Header Row: Company Avatar + Names + Post Time */}
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarGradient} text-sm font-black tracking-wider text-white shadow-md`}
                        aria-hidden="true"
                      >
                        {initials}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <p className="line-clamp-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                            {company}
                          </p>
                          {relativeTime ? (
                            <span className="text-[11px] font-medium text-slate-400">
                              {relativeTime}
                            </span>
                          ) : null}
                        </div>

                        <h2 className="mt-0.5 text-lg font-black leading-snug text-slate-900 transition group-hover:text-blue-600 sm:text-xl">
                          <Link to={jobPath} className="focus:outline-none">
                            {job.title}
                          </Link>
                        </h2>
                      </div>
                    </div>

                    {/* Trust Badges */}
                    <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                      {directBadge ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider shadow-2xs ${
                            directBadge.tone === 'emerald'
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                              : directBadge.tone === 'cyan'
                                ? 'border border-cyan-200 bg-cyan-50 text-cyan-800'
                                : 'border border-indigo-200 bg-indigo-50 text-indigo-800'
                          }`}
                        >
                          <span aria-hidden="true">{directBadge.icon}</span>
                          <span>{directBadge.label}</span>
                        </span>
                      ) : null}

                      {job.isFresher ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 shadow-2xs">
                          <span aria-hidden="true">🎓</span>
                          <span>Fresher Friendly</span>
                        </span>
                      ) : null}

                      {salary ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-900 shadow-2xs">
                          <span aria-hidden="true">💰</span>
                          <span>{salary}</span>
                        </span>
                      ) : null}
                    </div>

                    {/* Meta Chips */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                        📍 {location}
                      </span>
                      {experience ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                          💼 {experience}
                        </span>
                      ) : null}
                      {jobType ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                          ⏱️ {jobType}
                        </span>
                      ) : null}
                      {workMode ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                          🏢 {workMode}
                        </span>
                      ) : null}
                    </div>

                    {/* Action CTA Button */}
                    <div className="mt-4 pt-1">
                      <Link
                        to={jobPath}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-center text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all duration-150 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.98]"
                      >
                        <span>Apply Now</span>
                        <svg
                          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Bottom Exit Ramp: Check All Jobs */}
        <section className="mt-12 overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-center text-white shadow-xl sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-2xl text-blue-400 ring-1 ring-blue-400/30">
            🔍
          </div>

          <h2 className="mt-3.5 text-xl font-black tracking-tight sm:text-2xl">
            Looking for more jobs in Visakhapatnam?
          </h2>

          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-300 sm:text-sm">
            We list 100+ active openings across IT, Non-IT, Pharmacy, Engineering, and Freshers in Vizag.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/jobs"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 active:scale-95 sm:w-auto"
            >
              <span>Check All Jobs in Vizag (100+)</span>
              <span aria-hidden="true">→</span>
            </Link>

            <Link
              to="/"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-95 sm:w-auto"
            >
              Go to Homepage
            </Link>
          </div>

          {/* Quick Category Chips */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-300">
            <span className="text-slate-400">Popular:</span>
            <Link
              to="/jobs/it"
              className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1 text-slate-200 transition hover:border-blue-400 hover:text-white"
            >
              💻 IT Jobs
            </Link>
            <Link
              to="/jobs/fresher"
              className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1 text-slate-200 transition hover:border-blue-400 hover:text-white"
            >
              🎓 Fresher Jobs
            </Link>
            <Link
              to="/jobs/part-time"
              className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1 text-slate-200 transition hover:border-blue-400 hover:text-white"
            >
              ⏱️ Part-Time Jobs
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
