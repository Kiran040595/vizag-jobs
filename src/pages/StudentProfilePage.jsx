import { useSearchParams, useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import StudentShell from '../components/student/StudentShell';
import StudentProfileForm from '../components/student/StudentProfileForm';
import StudentSessionRoute from '../components/student/StudentSessionRoute';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { readPendingApplyJobMeta, resolvePostAuthDestination, shouldAutoApplyAfterAuth } from '../lib/studentApplyRedirect';

function StudentProfileContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profileComplete } = useStudentAuth();
  const needsApply = shouldAutoApplyAfterAuth(searchParams);
  const pendingApplyMeta = readPendingApplyJobMeta();
  const returnPath = resolvePostAuthDestination(searchParams, { profileComplete: true });
  const pendingJobLabel =
    pendingApplyMeta?.title && pendingApplyMeta?.company
      ? `${pendingApplyMeta.title} at ${pendingApplyMeta.company}`
      : pendingApplyMeta?.title || '';

  const handleSaved = () => {
    if (needsApply && searchParams.get('next')) {
      navigate(returnPath, { replace: true });
    }
  };

  return (
    <StudentShell
      title="Student profile"
      description="Complete your education, target roles, experience, skills, and certifications before applying to jobs in Vizag."
    >
      <SEO title="Student profile | Vizag Jobs" canonical="/student/profile" />
      {!profileComplete ? (
        <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {needsApply && pendingJobLabel
            ? `You started applying for ${pendingJobLabel}. Complete your profile below to continue.`
            : needsApply
              ? 'Complete your profile and career preferences below to apply for this job. All fields marked * are required.'
              : 'Complete your profile and career preferences before applying to jobs. All fields marked * are required.'}
        </p>
      ) : null}
      <StudentProfileForm onSaved={handleSaved} />
      {profileComplete ? (
        <p className="mt-6 text-sm text-slate-600">
          <a href="/jobs/fresher" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Browse fresher jobs in Vizag
          </a>{' '}
          or{' '}
          <a href="/saved-jobs" className="font-semibold text-indigo-600 hover:text-indigo-700">
            view saved jobs
          </a>
          .
        </p>
      ) : null}
    </StudentShell>
  );
}

export default function StudentProfilePage() {
  return (
    <StudentSessionRoute>
      <StudentProfileContent />
    </StudentSessionRoute>
  );
}
