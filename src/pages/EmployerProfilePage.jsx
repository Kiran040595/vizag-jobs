import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import EmployerShell from '../components/employer/EmployerShell';
import EmployerProfileForm from '../components/employer/EmployerProfileForm';
import EmployerSessionRoute from '../components/employer/EmployerSessionRoute';
import { useEmployerAuth } from '../hooks/useEmployerAuth';

function EmployerProfileContent() {
  const { isEmployer } = useEmployerAuth();

  return (
    <EmployerShell
      title="Company profile"
      description="Keep your company details up to date before posting jobs."
    >
      <SEO title="Company profile | Vizag Jobs Employer" canonical="/employer/profile" />
      <EmployerProfileForm onSaved={() => {}} />
      {isEmployer ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
          <Link
            to="/employer/jobs/new"
            className="inline-flex min-h-11 items-center font-semibold text-cyan-600 hover:text-cyan-700"
          >
            Post a job
          </Link>
          <span>or</span>
          <Link
            to="/employer/jobs"
            className="inline-flex min-h-11 items-center font-semibold text-cyan-600 hover:text-cyan-700"
          >
            view your submissions
          </Link>
        </div>
      ) : (
        <p className="mt-6 text-sm text-amber-700">
          Save your profile to unlock job posting.
        </p>
      )}
    </EmployerShell>
  );
}

export default function EmployerProfilePage() {
  return (
    <EmployerSessionRoute>
      <EmployerProfileContent />
    </EmployerSessionRoute>
  );
}
