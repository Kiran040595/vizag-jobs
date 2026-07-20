import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { useStudentAuth } from '../hooks/useStudentAuth';
import {
  buildInternalApplyPath,
  consumePendingApplyJobId,
  consumePendingApplyUrl,
  openExternalApplyLink,
  resolvePostAuthDestination,
  shouldAutoApplyAfterAuth,
  buildStudentAuthPath,
} from '../lib/studentApplyRedirect';
import { markStudentAuthSuccess } from '../lib/studentAuthSuccess';
import { trackStudentFunnel } from '../lib/studentFunnelAnalytics';

export default function StudentLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authError, isLoading, isStudent, isSupabaseConfigured, profileComplete, session, signIn } = useStudentAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const returnPath = resolvePostAuthDestination(searchParams, { profileComplete });
  const nextPath = searchParams.get('next') || '';
  const isJobDetailsReturn =
    Boolean(nextPath) &&
    !shouldAutoApplyAfterAuth(searchParams) &&
    (/^\/jobs\//.test(nextPath) || /^\/job\//.test(nextPath));
  const isApplyReturn = shouldAutoApplyAfterAuth(searchParams) && Boolean(nextPath);
  const registerPath = `/student/register${buildStudentAuthPath({
    pathname: searchParams.get('next') || undefined,
    apply: shouldAutoApplyAfterAuth(searchParams),
  })}`;

  useEffect(() => {
    if (!session || !isStudent || isLoading) {
      return;
    }

    markStudentAuthSuccess({
      apply: shouldAutoApplyAfterAuth(searchParams),
      type: 'sign_in',
    });
    trackStudentFunnel('student_auth_success', {
      type: 'sign_in',
      apply: shouldAutoApplyAfterAuth(searchParams),
    });

    const pendingJobId = consumePendingApplyJobId();
    if (pendingJobId && profileComplete) {
      navigate(buildInternalApplyPath(pendingJobId, searchParams.get('next') || ''), { replace: true });
      return;
    }

    const pendingApply = consumePendingApplyUrl();
    if (pendingApply && profileComplete) {
      openExternalApplyLink(pendingApply);
    }

    navigate(returnPath, { replace: true });
  }, [isLoading, isStudent, navigate, profileComplete, returnPath, searchParams, session]);

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
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8">
          <LoadingSpinner message="Loading..." />
        </div>
      </div>
    );
  }

  if (session && isStudent) {
    return <Navigate to={returnPath} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);

    try {
      await signIn({ identifier, password });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not sign in.';
      if (/email not confirmed/i.test(message)) {
        setSubmitError(
          'Email is not confirmed yet. Check your inbox for a confirmation link, or contact support if you already confirmed.',
        );
      } else if (/invalid login credentials/i.test(message)) {
        setSubmitError('Wrong email/mobile or password. Try again, or create a student account.');
      } else {
        setSubmitError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_35%),linear-gradient(180deg,_#eef2ff_0%,_#ffffff_45%,_#f8fafc_100%)] px-4 py-12">
      <SEO
        title="Student login | Vizag Jobs"
        description={
          isApplyReturn
            ? 'Sign in to return to the job and apply in Vizag.'
            : isJobDetailsReturn
              ? 'Sign in or create an account to view full job details in Vizag.'
              : 'Sign in to apply for jobs in Vizag.'
        }
        canonical="/student/login"
      />
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] bg-slate-950 p-8 text-white sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-300">For students</p>
          <h1 className="mt-4 text-4xl font-black leading-tight">
            {isApplyReturn
              ? 'Sign in to apply for this job'
              : isJobDetailsReturn
                ? 'Sign in to view full job details'
                : 'Sign in to apply'}
          </h1>
          <p className="mt-5 text-sm leading-7 text-slate-300">
            {isApplyReturn
              ? 'After you sign in, you will return to the job you selected so you can apply right away.'
              : isJobDetailsReturn
                ? 'Create a free student account or sign in to open the complete job posting. After that you can return here anytime while signed in.'
                : 'Sign in with the email or mobile number and password you used during registration.'}
          </p>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
          <h2 className="text-2xl font-black text-slate-950">Sign in</h2>
          {isApplyReturn ? (
            <p className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
              You started applying for a job. Sign in below and we will take you back to it.
            </p>
          ) : null}
          {authError ? (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{authError}</p>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email or mobile number</span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                inputMode="email"
                placeholder="you@college.edu or 9876543210"
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            {submitError ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</p>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-2xl bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-70"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            New here?{' '}
            <Link to={registerPath} className="font-semibold text-indigo-600 hover:text-indigo-700">
              Create student account
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
