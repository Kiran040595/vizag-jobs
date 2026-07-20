import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import LoadingSpinner from '../LoadingSpinner';
import StudentAuthRequiredShell from './StudentAuthRequiredShell';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useEmployerAuth } from '../../hooks/useEmployerAuth';
import { useJobPreviewFromPath } from '../../hooks/useJobPreviewFromPath';
import { useStudentAuth } from '../../hooks/useStudentAuth';
import { buildStudentAuthPath } from '../../lib/studentApplyRedirect';
import { supabase } from '../../lib/supabaseClient';

/**
 * Full job details require a signed-in student — or an admin/employer session.
 * Admins and employers never need a student account.
 */
export default function JobDetailsAuthGate({ children }) {
  const location = useLocation();
  const {
    isLoading: studentLoading,
    isStudent,
    isSupabaseConfigured,
    session: studentSession,
  } = useStudentAuth();
  const { isLoading: adminLoading, isAdmin, session: adminSession } = useAdminAuth();
  const { isLoading: employerLoading, isEmployer, session: employerSession } = useEmployerAuth();
  const jobPreview = useJobPreviewFromPath(location.pathname);

  const session = adminSession || employerSession || studentSession;
  const authLoading = studentLoading || adminLoading || employerLoading;
  const canViewFromHooks = isAdmin || isEmployer || (Boolean(studentSession) && isStudent);

  const [staffOverride, setStaffOverride] = useState(false);
  const [accessCheckDone, setAccessCheckDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const verifyAccess = async () => {
      if (authLoading || canViewFromHooks) {
        if (!cancelled) {
          setStaffOverride(false);
          setAccessCheckDone(true);
        }
        return;
      }

      if (!supabase) {
        if (!cancelled) setAccessCheckDone(true);
        return;
      }

      if (!cancelled) setAccessCheckDone(false);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) {
          if (!cancelled) {
            setStaffOverride(false);
            setAccessCheckDone(true);
          }
          return;
        }

        // Direct membership check so a slow/cached auth context cannot
        // bounce signed-in admins to student registration.
        const [adminResult, employerResult] = await Promise.all([
          supabase.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle(),
          supabase
            .from('employer_profiles')
            .select('user_id, is_active')
            .eq('user_id', userId)
            .maybeSingle(),
        ]);

        const isStaffAdmin = Boolean(adminResult.data?.user_id);
        const isStaffEmployer = Boolean(
          employerResult.data?.user_id && employerResult.data.is_active !== false,
        );

        if (!cancelled) {
          setStaffOverride(isStaffAdmin || isStaffEmployer);
          setAccessCheckDone(true);
        }
      } catch {
        if (!cancelled) {
          setStaffOverride(false);
          setAccessCheckDone(true);
        }
      }
    };

    verifyAccess();
    return () => {
      cancelled = true;
    };
  }, [authLoading, canViewFromHooks, location.key]);

  const canViewFullDetails = canViewFromHooks || staffOverride;
  const isLoading = authLoading || !accessCheckDone;

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
          <LoadingSpinner message="Checking sign-in..." />
        </div>
      </div>
    );
  }

  if (canViewFullDetails) {
    return children;
  }

  // Signed in but not a student/admin/employer — do not force student registration.
  if (session?.user && !isStudent) {
    const returnPath = `${location.pathname}${location.search}`;
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-black text-slate-950">Sign in required</h1>
          <p className="mt-2 text-sm text-slate-600">
            Full job details are available to students, admins, and employers. You are signed in with
            an account that does not have access yet.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/admin/login"
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Admin login
            </Link>
            <Link
              to={`/student/login${buildStudentAuthPath({ pathname: returnPath })}`}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Student login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const returnPath = `${location.pathname}${location.search}`;

  return (
    <StudentAuthRequiredShell
      returnPath={returnPath}
      jobTitle={jobPreview.title}
      jobCompany={jobPreview.company}
      intent="view"
      source="job_gate"
      headline="Sign in to view this job"
      description="Create a free student account or sign in to open the full job details and apply."
    />
  );
}
