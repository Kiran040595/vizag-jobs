import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import EmployerRoute from '../components/employer/EmployerRoute';
import EmployerShell from '../components/employer/EmployerShell';
import EmployerJobForm from '../components/employer/EmployerJobForm';
import { deserializeJobForForm, fetchMyJobById } from '../services/employerJobs';

function EmployerEditJobContent() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [initialValues, setInitialValues] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const job = await fetchMyJobById(jobId);
        if (!ignore) {
          if (!['pending', 'draft'].includes(job.status)) {
            setLoadError('Only pending submissions can be edited.');
          } else {
            setInitialValues(deserializeJobForForm(job));
          }
        }
      } catch (error) {
        if (!ignore) {
          setLoadError(error instanceof Error ? error.message : 'Could not load job.');
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

  return (
    <EmployerShell title="Edit submission" description="Update your job before it is reviewed.">
      <SEO title="Edit job | Vizag Jobs Employer" canonical={`/employer/jobs/${jobId}/edit`} />
      {isLoading ? <LoadingSpinner message="Loading job..." /> : null}
      {loadError ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</p>
      ) : null}
      {initialValues ? (
        <EmployerJobForm
          mode="edit"
          jobId={jobId}
          initialValues={initialValues}
          onCancel={() => navigate('/employer/jobs')}
          onSaved={() => navigate('/employer/jobs')}
        />
      ) : null}
    </EmployerShell>
  );
}

export default function EmployerEditJobPage() {
  return (
    <EmployerRoute>
      <EmployerEditJobContent />
    </EmployerRoute>
  );
}
