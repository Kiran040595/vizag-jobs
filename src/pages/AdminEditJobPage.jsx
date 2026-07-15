import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import AdminJobForm from '../components/admin/AdminJobForm';
import { deserializeJobForForm, fetchAdminJobById, getAdminJobsListPath } from '../services/adminJobs';

export default function AdminEditJobPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;

    const loadJob = async () => {
      try {
        const data = await fetchAdminJobById(jobId);
        if (ignore) {
          return;
        }

        setJob(data);
        setLoadError('');
      } catch (error) {
        if (ignore) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : 'Could not load the selected job.');
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    loadJob();

    return () => {
      ignore = true;
    };
  }, [jobId]);

  return (
    <AdminShell
      title="Edit existing job"
      description="Update an older listing on its own route without reopening the new-job page."
    >
      <SEO title="Edit Job | Vizag Jobs Admin" description="Edit an existing Vizag Jobs listing." canonical={`/admin/jobs/${jobId}/edit`} />

      <div className="mx-auto max-w-4xl">
        {isLoading ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
            <LoadingSpinner message="Loading job for editing..." />
          </section>
        ) : null}

        {!isLoading && loadError ? (
          <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
            {loadError}
          </section>
        ) : null}

        {!isLoading && job ? (
          <AdminJobForm
            key={job.id}
            mode="edit"
            jobId={job.id}
            initialValues={deserializeJobForForm(job)}
            draftStorageKey={`vizagjobs:admin-edit-job-draft:${job.id}`}
            onCancel={() => navigate(getAdminJobsListPath(job))}
            onSaved={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}
