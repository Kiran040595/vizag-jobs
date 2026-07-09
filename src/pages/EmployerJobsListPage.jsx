import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import EmployerRoute from '../components/employer/EmployerRoute';
import EmployerShell from '../components/employer/EmployerShell';
import { fetchMyJobs } from '../services/employerJobs';

const STATUS_STYLES = {
  pending: 'border-blue-200 bg-blue-50 text-blue-700',
  published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  draft: 'border-amber-200 bg-amber-50 text-amber-700',
  archived: 'border-slate-200 bg-slate-100 text-slate-600',
};

const statusLabel = (job) => {
  if (job.status === 'published') return 'Live on portal';
  if (job.status === 'pending') return 'Pending review';
  if (job.status === 'archived' && job.rejection_reason) return 'Rejected';
  if (job.status === 'archived') return 'Archived';
  return job.status;
};

function EmployerJobsListContent() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const data = await fetchMyJobs();
        if (!ignore) {
          setJobs(data);
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

    load();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <EmployerShell title="My job submissions" description="Track pending, live, and rejected listings.">
      <SEO title="My jobs | Vizag Jobs Employer" canonical="/employer/jobs" />

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          to="/employer/jobs/new"
          className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Post a new job
        </Link>
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
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{job.company}</p>
                  {job.rejection_reason ? (
                    <p className="mt-2 text-sm text-rose-700">Reason: {job.rejection_reason}</p>
                  ) : null}
                </div>
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
