import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import EmployerRoute from '../components/employer/EmployerRoute';
import EmployerShell from '../components/employer/EmployerShell';
import { useEmployerAuth } from '../hooks/useEmployerAuth';
import {
  formatApplicationStatus,
  getApplicationStatusStyle,
} from '../lib/applicationStatus';
import { fetchMyJobs } from '../services/employerJobs';
import { fetchJobApplicationStats } from '../services/jobApplications';

const STATUS_STYLES = {
  pending: 'border-blue-200 bg-blue-50 text-blue-700',
  published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  draft: 'border-amber-200 bg-amber-50 text-amber-700',
  archived: 'border-slate-200 bg-slate-100 text-slate-600',
};

const SUMMARY_STATUS_ORDER = ['applied', 'viewed', 'processing', 'hired', 'rejected'];

const statusLabel = (job) => {
  if (job.status === 'published') return 'Live on portal';
  if (job.status === 'pending') return 'Pending review';
  if (job.status === 'archived' && job.rejection_reason) return 'Rejected';
  if (job.status === 'archived') return 'Archived';
  return job.status;
};

function EmployerJobsListContent() {
  const navigate = useNavigate();
  const { user } = useEmployerAuth();
  const [jobs, setJobs] = useState([]);
  const [applicationCounts, setApplicationCounts] = useState({});
  const [statusCounts, setStatusCounts] = useState({});
  const [totalApplications, setTotalApplications] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await fetchMyJobs(user.id);

        if (!ignore) {
          setJobs(data);
          setLoadError('');
          setIsLoading(false);
        }

        const publishedIds = data.filter((job) => job.status === 'published').map((job) => job.id);
        if (publishedIds.length > 0) {
          try {
            const stats = await fetchJobApplicationStats(publishedIds);
            if (!ignore) {
              setApplicationCounts(stats.byJobId);
              setStatusCounts(stats.byStatus);
              setTotalApplications(stats.total);
            }
          } catch (error) {
            console.warn('Could not load employer application stats:', error);
          }
        }
      } catch (error) {
        if (!ignore) {
          setLoadError(error instanceof Error ? error.message : 'Could not load jobs.');
          setIsLoading(false);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [user?.id]);

  const summaryStatuses = useMemo(
    () =>
      SUMMARY_STATUS_ORDER.filter((status) => (statusCounts[status] || 0) > 0).map((status) => ({
        status,
        count: statusCounts[status] || 0,
      })),
    [statusCounts],
  );

  return (
    <EmployerShell title="My job submissions" description="Track pending, live, and rejected listings.">
      <SEO title="My jobs | Vizag Jobs Employer" canonical="/employer/jobs" />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          to="/employer/jobs/new"
          className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Post a new job
        </Link>

        {!isLoading ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800">
              {totalApplications} application{totalApplications === 1 ? '' : 's'}
            </span>
            {summaryStatuses.map(({ status, count }) => (
              <span
                key={status}
                className={`rounded-2xl border px-3.5 py-2.5 text-sm font-semibold ${getApplicationStatusStyle(status)}`}
              >
                {formatApplicationStatus(status)}: {count}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {loadError ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</p>
      ) : null}

      {isLoading ? (
        <LoadingSpinner message="Loading your jobs..." />
      ) : jobs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <h3 className="text-lg font-bold text-slate-900">No submissions yet</h3>
          <p className="mt-2 text-sm text-slate-600">Post your first job and our team will review it.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <article key={job.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-950">{job.title}</h3>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${
                        STATUS_STYLES[job.status] || STATUS_STYLES.draft
                      }`}
                    >
                      {statusLabel(job)}
                    </span>
                    {job.apply_mode === 'internal' ? (
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold uppercase text-indigo-700">
                        On-platform apply
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{job.company}</p>
                  {job.rejection_reason ? (
                    <p className="mt-2 text-sm text-rose-700">Reason: {job.rejection_reason}</p>
                  ) : null}
                  {job.status === 'published' && job.apply_mode === 'internal' ? (
                    <p className="mt-2 text-sm text-slate-600">
                      {applicationCounts[job.id] || 0} application
                      {(applicationCounts[job.id] || 0) === 1 ? '' : 's'}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {job.status === 'published' && job.apply_mode === 'internal' ? (
                    <Link
                      to={`/employer/jobs/${job.id}/applications`}
                      className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
                    >
                      View applications
                    </Link>
                  ) : null}
                  {['pending', 'draft'].includes(job.status) ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/employer/jobs/${job.id}/edit`)}
                      className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </EmployerShell>
  );
}

export default function EmployerJobsListPage() {
  return (
    <EmployerRoute>
      <EmployerJobsListContent />
    </EmployerRoute>
  );
}
