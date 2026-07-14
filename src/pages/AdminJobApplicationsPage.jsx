import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import JobApplicationCard from '../components/jobApplications/JobApplicationCard';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { fetchAdminJobs } from '../services/adminJobs';
import {
  fetchJobApplications,
  updateApplicationStatus,
} from '../services/jobApplications';

export default function AdminJobApplicationsPage() {
  const { jobId } = useParams();
  useAdminAuth();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const [jobs, rows] = await Promise.all([fetchAdminJobs(), fetchJobApplications(jobId)]);
        if (!ignore) {
          setJob(jobs.find((row) => row.id === jobId) || null);
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

      <div className="mb-6 flex flex-wrap gap-4">
        <Link to="/admin/jobs" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
          ← Back to jobs
        </Link>
        {job ? (
          <Link to={`/admin/jobs/${job.id}/edit`} className="text-sm font-semibold text-slate-600 hover:text-slate-800">
            Edit job
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {isLoading ? <LoadingSpinner message="Loading applications..." /> : null}

      {!isLoading && applications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <h3 className="text-lg font-bold text-slate-900">No applications yet</h3>
          <p className="mt-2 text-sm text-slate-600">Students will appear here after applying to this job.</p>
        </div>
      ) : null}

      {!isLoading && applications.length > 0 ? (
        <div className="space-y-4">
          {applications.map((application) => (
            <JobApplicationCard
              key={application.id}
              application={application}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : null}
    </AdminShell>
  );
}
