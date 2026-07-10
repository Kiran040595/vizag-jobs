import SEO from '../components/SEO';
import StudentShell from '../components/student/StudentShell';
import StudentProfileForm from '../components/student/StudentProfileForm';
import StudentSessionRoute from '../components/student/StudentSessionRoute';
import { useStudentAuth } from '../hooks/useStudentAuth';

function StudentProfileContent() {
  const { isStudent } = useStudentAuth();

  return (
    <StudentShell
      title="Student profile"
      description="Your education and skills for fresher job search in Vizag."
    >
      <SEO title="Student profile | Vizag Jobs" canonical="/student/profile" />
      <StudentProfileForm onSaved={() => {}} />
      {isStudent ? (
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
      ) : (
        <p className="mt-6 text-sm text-amber-700">Save your profile to complete registration.</p>
      )}
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
