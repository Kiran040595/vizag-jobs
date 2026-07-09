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
        <p className="mt-6 text-sm text-slate-600">
          <a href="/employer/jobs/new" className="font-semibold text-cyan-600 hover:text-cyan-700">
            Post a job
          </a>{' '}
          or{' '}
          <a href="/employer/jobs" className="font-semibold text-cyan-600 hover:text-cyan-700">
            view your submissions
          </a>
          .
        </p>
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
