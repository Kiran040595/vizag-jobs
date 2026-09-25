import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import StudentShell from '../components/student/StudentShell';
import StudentSessionRoute from '../components/student/StudentSessionRoute';
import {
  formatApplicationStatus,
  formatApplicationTime,
  fetchMyApplications,
} from '../services/jobApplications';
import {
  getApplicationStatusDescription,
  getApplicationStatusStyle,
  normalizeApplicationStatus,
  STUDENT_STATUS_FILTERS,
} from '../lib/applicationStatus';

function StudentApplicationsContent() {
  const [searchParams] = useSearchParams();
  const highlightApplicationId = searchParams.get('application') || '';
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const rows = await fetchMyApplications();
        if (!ignore) {
          setApplications(rows);
          setError('');
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load your applied jobs.');
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

  const filteredApplications = useMemo(() => {
    if (statusFilter === 'all') {
      return applications;
    }

    return applications.filter(
      (application) => normalizeApplicationStatus(application.status) === statusFilter,
    );
  }, [applications, statusFilter]);

  const statusCounts = useMemo(() => {
    return applications.reduce((counts, application) => {
      const status = normalizeApplicationStatus(application.status);
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
  }, [applications]);

  useEffect(() => {
    if (!highlightApplicationId || isLoading) return undefined;
    const node = document.getElementById(`application-${highlightApplicationId}`);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return undefined;
  }, [highlightApplicationId, isLoading, filteredApplications]);

  return (
    <StudentShell
      title="Applied jobs"
      description="Track every job you applied for on Vizag Jobs and see the latest status from employers and admins."
    >
      <SEO title="Applied jobs | Vizag Jobs" canonical="/student/applied-jobs" />

      {error ? (
        <p className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {!isLoading && applications.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {STUDENT_STATUS_FILTERS.map((filter) => {
            const count =
              filter.id === 'all' ? applications.length : statusCounts[filter.id] || 0;

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  statusFilter === filter.id
                    ? 'bg-indigo-500 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {filter.label}
                <span className="ml-1.5 text-xs opacity-80">({count})</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {isLoading ? <LoadingSpinner message="Loading your applied jobs..." /> : null}

      {!isLoading && applications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <h3 className="text-lg font-bold text-slate-900">No applied jobs yet</h3>
          <p className="mt-2 text-sm text-slate-600">
            Apply to jobs posted directly on Vizag Jobs to track your status here.
          </p>
          <Link
            to="/jobs"
            className="mt-5 inline-flex rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Browse jobs
          </Link>
        </div>
      ) : null}

      {!isLoading && applications.length > 0 && filteredApplications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <h3 className="text-lg font-bold text-slate-900">No jobs in this status</h3>
          <p className="mt-2 text-sm text-slate-600">Try another filter to see your applications.</p>
        </div>
      ) : null}

      {!isLoading && filteredApplications.length > 0 ? (
        <div className="space-y-4">
          {filteredApplications.map((application) => {
            const normalizedStatus = normalizeApplicationStatus(application.status);
            const statusUpdated =
              application.updatedAt &&
              application.submittedAt &&
              application.updatedAt !== application.submittedAt;

            return (
              <article
                key={application.id}
                id={`application-${application.id}`}
                className={`rounded-3xl border bg-white p-5 shadow-sm ${
                  highlightApplicationId === application.id
                    ? 'border-indigo-300 ring-2 ring-indigo-100'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">
                      {application.job?.title || 'Job'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">{application.job?.company || ''}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Applied {formatApplicationTime(application.submittedAt)}
                    </p>
                    {statusUpdated ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Status updated {formatApplicationTime(application.updatedAt)}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${getApplicationStatusStyle(
                      normalizedStatus,
                    )}`}
                  >
                    {formatApplicationStatus(normalizedStatus)}
                  </span>
                </div>

                <p className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {getApplicationStatusDescription(normalizedStatus)}
                </p>

                {application.jobPath ? (
                  <Link
                    to={application.jobPath}
                    className="mt-4 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    View job posting
                  </Link>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </StudentShell>
  );
}

export default function StudentApplicationsPage() {
  return (
    <StudentSessionRoute>
      <StudentApplicationsContent />
    </StudentSessionRoute>
  );
}
