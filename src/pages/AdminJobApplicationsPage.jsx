import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import ApplicationExportDialog from '../components/jobApplications/ApplicationExportDialog';
import ApplicationFilters from '../components/jobApplications/ApplicationFilters';
import JobApplicationCard from '../components/jobApplications/JobApplicationCard';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  EMPTY_APPLICATION_FILTERS,
  filterApplications,
} from '../lib/applicationFilters';
import { summarizeApplicationStatuses } from '../lib/applicationExport';
import { fetchAdminJobById, getAdminJobsListPath } from '../services/adminJobs';
import {
  fetchJobApplications,
  formatApplicationStatus,
  updateApplicationStatus,
} from '../services/jobApplications';

export default function AdminJobApplicationsPage() {
  const { jobId } = useParams();
  useAdminAuth();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [filters, setFilters] = useState(EMPTY_APPLICATION_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const [jobRow, rows] = await Promise.all([fetchAdminJobById(jobId), fetchJobApplications(jobId)]);
        if (!ignore) {
          setJob(jobRow);
          setApplications(rows);
          setError('');
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load applications.');
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
  }, [jobId]);

  const filteredApplications = useMemo(
    () => filterApplications(applications, filters),
    [applications, filters],
  );
  const statusCounts = useMemo(
    () => summarizeApplicationStatuses(filteredApplications),
    [filteredApplications],
  );

  const handleStatusChange = async (applicationId, status) => {
    const updated = await updateApplicationStatus({ applicationId, status });
    setApplications((current) =>
      current.map((row) => (row.id === updated.id ? updated : row)),
    );
  };

  return (
    <AdminShell
      title="Job applications"
      description={job ? `${job.title} · ${job.company}` : 'Review applicants for this job.'}
    >
      <SEO title="Job applications | Vizag Jobs Admin" canonical={`/admin/jobs/${jobId}/applications`} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <Link to={getAdminJobsListPath(job)} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
            ← Back to jobs
          </Link>
          {job ? (
            <Link
              to={`/admin/jobs/${job.id}/edit`}
              className="text-sm font-semibold text-slate-600 hover:text-slate-800"
            >
              Edit job
            </Link>
          ) : null}
        </div>
        {!isLoading && applications.length > 0 ? (
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Download Excel
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {isLoading ? <LoadingSpinner message="Loading applications..." /> : null}

      {!isLoading ? (
        <div className="mb-6 rounded-3xl border border-indigo-100 bg-indigo-50/60 px-5 py-4">
          <p className="text-2xl font-black text-slate-950">
            {filteredApplications.length} application{filteredApplications.length === 1 ? '' : 's'}
            {filteredApplications.length !== applications.length ? (
              <span className="ml-2 text-base font-semibold text-slate-600">
                of {applications.length}
              </span>
            ) : null}
          </p>
          {applications.length > 0 ? (
            <p className="mt-2 flex flex-wrap gap-2 text-sm text-slate-700">
              {Object.entries(statusCounts).map(([status, count]) => (
                <span
                  key={status}
                  className="rounded-full border border-white/80 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                >
                  {formatApplicationStatus(status)}: {count}
                </span>
              ))}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
              Students who apply on-platform will show here with name, email, phone, and qualifications.
            </p>
          )}
        </div>
      ) : null}

      {!isLoading && applications.length > 0 ? (
        <ApplicationFilters
          applications={applications}
          filters={filters}
          onChange={setFilters}
          filteredCount={filteredApplications.length}
          totalCount={applications.length}
        />
      ) : null}

      {!isLoading && applications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <h3 className="text-lg font-bold text-slate-900">No applications yet</h3>
          <p className="mt-2 text-sm text-slate-600">Students will appear here after applying to this job.</p>
        </div>
      ) : null}

      {!isLoading && applications.length > 0 && filteredApplications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <h3 className="text-lg font-bold text-slate-900">No matching applicants</h3>
          <p className="mt-2 text-sm text-slate-600">Try clearing filters or adjusting your search.</p>
        </div>
      ) : null}

      {!isLoading && filteredApplications.length > 0 ? (
        <div className="space-y-4">
          {filteredApplications.map((application) => (
            <JobApplicationCard
              key={application.id}
              application={application}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : null}

      <ApplicationExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        applications={filteredApplications}
        job={job}
      />
    </AdminShell>
  );
}
