import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import StudentShell from '../components/student/StudentShell';
import StudentSessionRoute from '../components/student/StudentSessionRoute';
import {
  fetchMyApplications,
  formatApplicationStatus,
  formatApplicationTime,
} from '../services/jobApplications';

const STATUS_STYLES = {
  submitted: 'border-blue-200 bg-blue-50 text-blue-700',
  viewed: 'border-slate-200 bg-slate-100 text-slate-700',
  shortlisted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  withdrawn: 'border-amber-200 bg-amber-50 text-amber-700',
};

function StudentApplicationsContent() {
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
          setError(loadError instanceof Error ? loadError.message : 'Could not load your applications.');
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
    <StudentShell title="My applications" description="Track jobs you applied for on Vizag Jobs.">
      <SEO title="My applications | Vizag Jobs" canonical="/student/applications" />

      {error ? (
        <p className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {isLoading ? <LoadingSpinner message="Loading your applications..." /> : null}

      {!isLoading && applications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <h3 className="text-lg font-bold text-slate-900">No applications yet</h3>
          <p className="mt-2 text-sm text-slate-600">
            Apply to jobs posted directly on Vizag Jobs to see them here.
          </p>
          <Link
            to="/jobs"
            className="mt-5 inline-flex rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Browse jobs
          </Link>
        </div>
      ) : null}

      {!isLoading && applications.length > 0 ? (
        <div className="space-y-4">
          {applications.map((application) => (
            <article key={application.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">
                    {application.job?.title || 'Job'}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{application.job?.company || ''}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Applied {formatApplicationTime(application.submittedAt)}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${
                    STATUS_STYLES[application.status] || STATUS_STYLES.submitted
                  }`}
                >
                  {formatApplicationStatus(application.status)}
                </span>
              </div>
              {application.jobPath ? (
                <Link
                  to={application.jobPath}
                  className="mt-4 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  View job
                </Link>
              ) : null}
            </article>
          ))}
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
