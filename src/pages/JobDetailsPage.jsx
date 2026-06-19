import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchJobById } from '../services/jobs';
import { getJobDetailPath } from '../lib/jobRoutes';
import {
  formatRelativePostedAt,
  isJobFresh,
  shouldHighlightPostedTime,
} from '../lib/jobFreshness';
import NewBadge from '../components/NewBadge';
import JobDescriptionContent from '../components/JobDescriptionContent';
import {
  looksLikeStructuredJobDescription,
  stripMarkdownForPlainText,
} from '../lib/jobDescriptionDisplay';
import { buildJobPostingSchema } from '../lib/jobPostingSchema';
import { buildBreadcrumbSchema } from '../lib/breadcrumbSchema';
import { SITE_URL } from '../lib/site';
import { useAdminAuth } from '../hooks/useAdminAuth';
import AdminJobActionsBar from '../components/admin/AdminJobActionsBar';

const splitCommaValues = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default function JobDetailsPage() {
  const { jobId, jobSlug, jobSegment } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAdminAuth();
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const routeJobIdentifier = jobSlug || jobId || '';
  const currentPath = jobSlug && jobSegment ? `/jobs/${jobSegment}/${jobSlug}` : null;

  /**
   * Fetch only the single row we're rendering. Bandwidth per detail-page
   * hit drops from ~2.4 MB (full list) to ~10 KB (one row). Admins see a
   * job in any status (draft / archived / published) so they can re-publish
   * unpublished jobs from this page; RLS still gates that access.
   *
   * `refreshTick` is bumped after Make SEO completes (or any other action
   * that may have rewritten every field) to force a re-fetch.
   */
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let isMounted = true;

    fetchJobById(routeJobIdentifier, {
      includeAllStatuses: isAdmin,
      forceRefresh: refreshTick > 0,
    })
      .then((found) => {
        if (!isMounted) return;
        setJob(found);
        setLoadError('');
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error('Error fetching job details:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load job details.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [routeJobIdentifier, isAdmin, refreshTick]);

  /**
   * Optimistic in-place update after a quick admin action — the server is
   * the source of truth (the action already returned successfully), but we
   * patch local state to avoid a follow-up network round-trip.
   */
  const handleAdminPatch = (patch) => {
    if (!patch) return;
    setJob((current) => (current ? { ...current, ...patch } : current));
  };

  /** Force a full re-fetch — used after Make SEO since every field may have changed. */
  const handleAdminRefetch = () => {
    setRefreshTick((tick) => tick + 1);
  };

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!job) {
      return;
    }

    const canonicalPath = getJobDetailPath(job);
    if (currentPath === canonicalPath) {
      return;
    }

    navigate(canonicalPath, { replace: true });
  }, [currentPath, job, navigate]);

  const skills = splitCommaValues(job?.skills);
  const responsibilities = splitCommaValues(job?.responsibilities);
  const eligibility = splitCommaValues(job?.eligibility);
  const structuredDescription = looksLikeStructuredJobDescription(job?.description);
  const showSeparateSections = !structuredDescription;

  const jobTitle = job ? `${job.title} at ${job.company} - Vizag Jobs` : 'Job Details - Vizag Jobs';
  const jobDescription = job
    ? `Apply for ${job.title} position at ${job.company} in ${job.location}. ${
        stripMarkdownForPlainText(job.shortDescription || job.description, 200) ||
        'Find more job opportunities in Visakhapatnam.'
      }`
    : 'Job details and application information for positions in Visakhapatnam.';

  const structuredData = useMemo(() => {
    if (!job) {
      return undefined;
    }

    const jobPosting = buildJobPostingSchema(job, { siteUrl: SITE_URL });
    const breadcrumb = buildBreadcrumbSchema(job, { siteUrl: SITE_URL });
    const graph = [jobPosting, breadcrumb].filter(Boolean);

    if (graph.length === 0) {
      return undefined;
    }

    if (graph.length === 1) {
      return graph[0];
    }

    return {
      '@context': 'https://schema.org',
      '@graph': graph,
    };
  }, [job]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/20 to-white">
      <SEO
        title={jobTitle}
        description={jobDescription}
        canonical={job ? getJobDetailPath(job) : currentPath || `/job/${routeJobIdentifier}`}
        structuredData={structuredData}
      />
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
          ← Back to jobs
        </Link>

        {isAdmin && job ? (
          <AdminJobActionsBar
            job={job}
            onPatch={handleAdminPatch}
            onRefetch={handleAdminRefetch}
          />
        ) : null}

        {isAdmin && job && job.status && job.status !== 'published' ? (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
            This job is currently <strong>{job.status}</strong> — public visitors cannot see it.
          </p>
        ) : null}

        {isLoading ? (
          <LoadingSpinner message="Loading job details..." />
        ) : null}

        {!isLoading && loadError ? (
          <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
            {loadError}
          </section>
        ) : null}

        {!isLoading && !job ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">Job not found</h1>
            <p className="mt-2 text-sm text-slate-600">
              This job may be removed or inactive. Please go back and choose another listing.
            </p>
          </section>
        ) : null}

        {job ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{job.title}</h1>
                  {isJobFresh(job.postedAt) && <NewBadge />}
                </div>
                <p className="mt-1 text-sm text-slate-600 sm:text-base">
                  {job.company} · {job.location}
                </p>
              </div>
              {job.applyLink ? (
                <a
                  href={job.applyLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Apply Now
                </a>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
              <p><span className="font-semibold text-slate-900">Category:</span> {job.category || 'N/A'}</p>
              <p><span className="font-semibold text-slate-900">Job Type:</span> {job.jobType || 'N/A'}</p>
              <p><span className="font-semibold text-slate-900">Work Mode:</span> {job.workMode || 'N/A'}</p>
              <p><span className="font-semibold text-slate-900">Experience:</span> {job.experience || 'N/A'}</p>
              <p><span className="font-semibold text-slate-900">Fresher:</span> {job.isFresher || 'N/A'}</p>
              <p><span className="font-semibold text-slate-900">Salary:</span> {job.salary || 'N/A'}</p>
              <p>
                <span className="font-semibold text-slate-900">Posted At:</span>{' '}
                {job.postedAt ? (
                  <span
                    className={
                      shouldHighlightPostedTime(job.postedAt)
                        ? 'font-semibold text-red-600'
                        : undefined
                    }
                  >
                    {formatRelativePostedAt(job.postedAt) || new Date(job.postedAt).toLocaleDateString()}
                  </span>
                ) : (
                  'N/A'
                )}
              </p>
            </div>

            {job.shortDescription && !structuredDescription ? (
              <div className="mt-6">
                <h2 className="text-lg font-bold text-slate-900">Overview</h2>
                <p className="mt-2 text-sm leading-7 text-slate-700">{job.shortDescription}</p>
              </div>
            ) : null}

            {job.description ? (
              <div className="mt-6">
                <h2 className="text-lg font-bold text-slate-900">Job Details</h2>
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:p-5">
                  <JobDescriptionContent markdown={job.description} />
                </div>
              </div>
            ) : null}

            {showSeparateSections && skills.length > 0 ? (
              <div className="mt-6">
                <h2 className="text-lg font-bold text-slate-900">Skills</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {showSeparateSections && responsibilities.length > 0 ? (
              <div className="mt-6">
                <h2 className="text-lg font-bold text-slate-900">Responsibilities</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                  {responsibilities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {showSeparateSections && eligibility.length > 0 ? (
              <div className="mt-6">
                <h2 className="text-lg font-bold text-slate-900">Eligibility</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                  {eligibility.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {job.warning ? (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <span className="font-semibold">Warning:</span> {job.warning}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
