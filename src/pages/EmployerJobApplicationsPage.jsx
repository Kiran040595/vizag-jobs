import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import EmployerRoute from '../components/employer/EmployerRoute';
import EmployerShell from '../components/employer/EmployerShell';
import WhatsAppContactLink from '../components/WhatsAppContactLink';
import {
  fetchJobApplications,
  formatApplicationStatus,
  formatApplicationTime,
  getApplicationResumeUrl,
  updateApplicationStatus,
} from '../services/jobApplications';
import { fetchMyJobs } from '../services/employerJobs';

const STATUS_OPTIONS = ['submitted', 'viewed', 'shortlisted', 'rejected'];

function ApplicantCard({ application, onStatusChange }) {
  const snapshot = application.profileSnapshot || {};
  const [resumeUrl, setResumeUrl] = useState('');
  const [resumeError, setResumeError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleViewResume = async () => {
    setResumeError('');
    try {
      const url = await getApplicationResumeUrl(application);
      if (!url) {
        setResumeError('Resume is not available.');
        return;
      }
      setResumeUrl(url);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : 'Could not open resume.');
    }
  };

  const handleStatusChange = async (event) => {
    const nextStatus = event.target.value;
    setIsUpdating(true);
    try {
      await onStatusChange(application.id, nextStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-950">{snapshot.fullName || 'Applicant'}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {[snapshot.degree, snapshot.branch, snapshot.graduationYear].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 text-sm text-slate-600">{snapshot.college || ''}</p>
        </div>
        <p className="text-xs text-slate-500">Applied {formatApplicationTime(application.submittedAt)}</p>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
          <dd className="mt-0.5 break-all text-slate-800">
            {snapshot.contactEmail ? (
              <a href={`mailto:${snapshot.contactEmail}`} className="text-cyan-700 hover:underline">
                {snapshot.contactEmail}
              </a>
            ) : (
              'Not provided'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-slate-800">
            <span>{snapshot.phone || 'Not provided'}</span>
            {snapshot.phone ? <WhatsAppContactLink phone={snapshot.phone} /> : null}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</dt>
          <dd className="mt-0.5 text-slate-800">
            {Array.isArray(snapshot.skills) && snapshot.skills.length > 0
              ? snapshot.skills.join(', ')
              : 'Not provided'}
          </dd>
        </div>
        {application.coverNote ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cover note</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-slate-800">{application.coverNote}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleViewResume}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          View resume
        </button>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <span className="font-semibold">Status</span>
          <select
            value={application.status}
            onChange={handleStatusChange}
            disabled={isUpdating}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {formatApplicationStatus(status)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {resumeError ? <p className="mt-3 text-sm text-rose-700">{resumeError}</p> : null}
      {resumeUrl ? null : null}
    </article>
  );
}

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
            <ApplicantCard
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
