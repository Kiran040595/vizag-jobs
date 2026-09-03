import { useLocation } from 'react-router-dom';
import LoadingSpinner from '../LoadingSpinner';
import StudentAuthRequiredShell from './StudentAuthRequiredShell';
import { useJobPreviewFromPath } from '../../hooks/useJobPreviewFromPath';
import { useStudentAuth } from '../../hooks/useStudentAuth';
import { shouldAutoApplyAfterAuth } from '../../lib/studentApplyRedirect';

export default function StudentSessionRoute({ children }) {
  const location = useLocation();
  const { isLoading, isSupabaseConfigured, session } = useStudentAuth();
  const jobPreview = useJobPreviewFromPath(location.pathname);
  const searchParams = new URLSearchParams(location.search);
  const wantsApply = shouldAutoApplyAfterAuth(searchParams);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <h1 className="text-2xl font-black">Supabase is not configured.</h1>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <LoadingSpinner message="Loading..." />
        </div>
      </div>
    );
  }

  if (!session) {
    const returnPath = `${location.pathname}${location.search}`;

    return (
      <StudentAuthRequiredShell
        returnPath={returnPath}
        jobTitle={jobPreview.title}
        jobCompany={jobPreview.company}
        intent="apply"
        source="student_session_route"
        apply={wantsApply}
        headline="Sign in to continue"
        description="Sign in or register to access your student account and apply for jobs."
      />
    );
  }

  return children;
}
