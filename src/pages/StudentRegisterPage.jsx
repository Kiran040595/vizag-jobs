import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import StudentRegistrationConsent from '../components/student/StudentRegistrationConsent';
import StudentSkillMatchNotice from '../components/student/StudentSkillMatchNotice';
import { EMPTY_STUDENT_CONSENTS, validateStudentConsents } from '../lib/studentConsent';
import { useStudentAuth } from '../hooks/useStudentAuth';
import {
  buildInternalApplyPath,
  buildStudentAuthPath,
  consumePendingApplyJobId,
  consumePendingApplyUrl,
  openExternalApplyLink,
  resolvePostAuthDestination,
  shouldAutoApplyAfterAuth,
} from '../lib/studentApplyRedirect';
import { markStudentAuthSuccess } from '../lib/studentAuthSuccess';
import { trackStudentFunnel } from '../lib/studentFunnelAnalytics';

const INPUT_CLASS =
  'mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';

export default function StudentRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoading, isStudent, isSupabaseConfigured, profileComplete, session, signUp } = useStudentAuth();
  const [fullName, setFullName] = useState('');
  const [college, setCollege] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consents, setConsents] = useState(EMPTY_STUDENT_CONSENTS);

  const returnPath = resolvePostAuthDestination(searchParams, { profileComplete });
  const nextPath = searchParams.get('next') || '';
  const isJobDetailsReturn =
    Boolean(nextPath) &&
    !shouldAutoApplyAfterAuth(searchParams) &&
    (/^\/jobs\//.test(nextPath) || /^\/job\//.test(nextPath));
  const isApplyReturn = shouldAutoApplyAfterAuth(searchParams) && Boolean(nextPath);
  const loginPath = `/student/login${buildStudentAuthPath({
    pathname: searchParams.get('next') || undefined,
    apply: shouldAutoApplyAfterAuth(searchParams),
  })}`;
  const registerQuery = buildStudentAuthPath({
    pathname: searchParams.get('next') || undefined,
    apply: shouldAutoApplyAfterAuth(searchParams),
  });

  const completePostAuthNavigation = () => {
    markStudentAuthSuccess({
      apply: shouldAutoApplyAfterAuth(searchParams),
      type: 'register',
    });
    trackStudentFunnel('student_auth_success', {
      type: 'register',
      apply: shouldAutoApplyAfterAuth(searchParams),
    });

    const destination = resolvePostAuthDestination(searchParams, { profileComplete });
    const pendingJobId = consumePendingApplyJobId();
    if (pendingJobId && profileComplete) {
      navigate(buildInternalApplyPath(pendingJobId, searchParams.get('next') || ''), { replace: true });
      return;
    }
    const pendingApply = consumePendingApplyUrl();
    if (pendingApply && profileComplete) {
      openExternalApplyLink(pendingApply);
    }
    navigate(destination, { replace: true });
  };

  useEffect(() => {
    if (!session || !isStudent || isLoading) {
      return;
    }
    completePostAuthNavigation();
  }, [isLoading, isStudent, navigate, profileComplete, searchParams, session]);

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
    setNotice('');
    setIsSubmitting(true);

    try {
      validateStudentConsents(consents);
      const postAuthPath = resolvePostAuthDestination(searchParams, { profileComplete: false });
      const result = await signUp({
        email,
        phone,
        password,
        fullName,
        college,
        consents,
        returnPath: postAuthPath,
      });
      if (result?.needsEmailConfirmation) {
        setNotice(
          'Account created! Check your email to confirm your address, then sign in to apply for this job.',
        );
        return;
      }
      if (result?.session) {
        return;
      }
      if (result?.user) {
        setNotice(
          'Account created! Check your email if confirmation is required, then sign in to continue.',
        );
        return;
      }
      throw new Error('Account created but sign-in did not complete. Try signing in.');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_35%),linear-gradient(180deg,_#eef2ff_0%,_#ffffff_45%,_#f8fafc_100%)] px-4 py-12">
      <SEO
        title="Student register | Vizag Jobs"
        description={
          isApplyReturn
            ? 'Create a free student account to apply for the job you selected in Vizag.'
            : isJobDetailsReturn
              ? 'Create a free student account to view full job details in Vizag.'
              : 'Create a student account to apply for fresher jobs in Vizag.'
        }
        canonical={`/student/register${registerQuery}`}
      />
      <div className="mx-auto max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
        <h1 className="text-3xl font-black text-slate-950">Create student account</h1>
        <p className="mt-3 text-sm text-slate-600">
          {isApplyReturn
            ? 'Register below — after sign-in you will return to the job so you can apply.'
            : shouldAutoApplyAfterAuth(searchParams)
              ? 'Register below — you will be signed in automatically and returned to the job you selected.'
              : isJobDetailsReturn
                ? 'Register below — you will be signed in automatically and returned to the full job details.'
                : 'Enter your email and mobile number. Complete your skills and education in the next step.'}
        </p>

        {isApplyReturn ? (
          <p className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            You started applying for a job. Create your account below and we will bring you back to it.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">College / university</span>
            <input
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              required
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@college.edu"
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Mobile number</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
              placeholder="9876543210"
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className={INPUT_CLASS}
            />
          </label>

          <StudentRegistrationConsent values={consents} onChange={setConsents} />

          {notice ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>
          ) : null}
          {submitError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-2xl bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-70"
          >
            {isSubmitting ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <StudentSkillMatchNotice className="mt-6" />

        <p className="mt-6 text-center text-sm text-slate-600">
          Already registered?{' '}
          <Link to={loginPath} className="font-semibold text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-slate-500">
          Hiring for a company?{' '}
          <Link to="/employer/register" className="font-semibold text-cyan-600 hover:text-cyan-700">
            Employer registration
          </Link>
        </p>
      </div>
    </div>
  );
}
