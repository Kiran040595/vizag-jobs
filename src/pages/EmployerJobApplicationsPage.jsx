import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import EmployerRoute from '../components/employer/EmployerRoute';
import EmployerShell from '../components/employer/EmployerShell';
import JobApplicationCard from '../components/jobApplications/JobApplicationCard';
import {
  fetchJobApplications,
  updateApplicationStatus,
} from '../services/jobApplications';
import { fetchMyJobs } from '../services/employerJobs';

function EmployerJobApplicationsContent() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const [jobs, rows] = await Promise.all([fetchMyJobs(), fetchJobApplications(jobId)]);
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
    <EmployerShell
      title="Job applications"
      description={job ? `${job.title} · ${job.company}` : 'Review applicants for your job.'}
    >
      <SEO title="Job applications | Vizag Jobs Employer" canonical={`/employer/jobs/${jobId}/applications`} />

      <div className="mb-6">
        <Link to="/employer/jobs" className="text-sm font-semibold text-cyan-700 hover:text-cyan-800">
          ← Back to my jobs
        </Link>
      </div>

      {error ? (
        <p className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {isLoading ? <LoadingSpinner message="Loading applications..." /> : null}

      {!isLoading && applications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <h3 className="text-lg font-bold text-slate-900">No applications yet</h3>
          <p className="mt-2 text-sm text-slate-600">Applicants will appear here once students apply on Vizag Jobs.</p>
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
    </EmployerShell>
  );
}

export default function EmployerJobApplicationsPage() {
  return (
    <EmployerRoute>
      <EmployerJobApplicationsContent />
    </EmployerRoute>
  );
}
