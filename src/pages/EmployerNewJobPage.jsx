import { useNavigate, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import EmployerRoute from '../components/employer/EmployerRoute';
import EmployerShell from '../components/employer/EmployerShell';
import EmployerJobForm from '../components/employer/EmployerJobForm';

function EmployerNewJobContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEmptyPrompt = searchParams.get('empty') === '1';

  return (
    <EmployerShell title="Post a job" description="Submit a listing for admin approval.">
      <SEO title="Post a job | Vizag Jobs Employer" canonical="/employer/jobs/new" />

      {isEmptyPrompt ? (
        <div className="mb-6 flex items-start gap-3.5 rounded-2xl border border-cyan-200 bg-cyan-50/90 p-4 text-cyan-950 shadow-sm backdrop-blur sm:p-5">
          <div className="mt-0.5 rounded-full bg-cyan-100 p-1.5 text-cyan-700">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-cyan-950 sm:text-base">Welcome to your employer portal!</h3>
            <p className="mt-1 text-xs text-cyan-800 sm:text-sm">
              No jobs have been listed for your company yet. Submit your first job listing below for admin review.
            </p>
          </div>
        </div>
      ) : null}

      <EmployerJobForm
        mode="create"
        onCancel={() => navigate('/employer/jobs?view=list')}
        onSaved={() => navigate('/employer/jobs')}
      />
    </EmployerShell>
  );
}

export default function EmployerNewJobPage() {
  return (
    <EmployerRoute>
      <EmployerNewJobContent />
    </EmployerRoute>
  );
}
