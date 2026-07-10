import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import StudentAuthMethodTabs, { STUDENT_AUTH_METHODS } from '../components/student/StudentAuthMethodTabs';
import { REQUIRE_EMAIL_CONFIRMATION } from '../lib/studentAuthFeatures';
import { useStudentAuth } from '../hooks/useStudentAuth';
import {
  buildStudentAuthPath,
  consumePendingApplyUrl,
  openExternalApplyLink,
  readAuthReturnPath,
  shouldAutoApplyAfterAuth,
} from '../lib/studentApplyRedirect';

export default function StudentRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoading, isStudent, isSupabaseConfigured, session, signUp } = useStudentAuth();
  const [authMethod, setAuthMethod] = useState(STUDENT_AUTH_METHODS.EMAIL);
  const [fullName, setFullName] = useState('');
  const [college, setCollege] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const returnPath = readAuthReturnPath(searchParams);
  const loginPath = `/student/login${buildStudentAuthPath({
    pathname: searchParams.get('next') || undefined,
    apply: shouldAutoApplyAfterAuth(searchParams),
  })}`;

  useEffect(() => {
    if (!session || !isStudent || isLoading) {
      return;
    }

    const pendingApply = consumePendingApplyUrl();
    if (pendingApply) {
      openExternalApplyLink(pendingApply);
    }

    navigate(returnPath, { replace: true });
  }, [isLoading, isStudent, navigate, returnPath, session]);

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
      const result = await signUp({
        authMethod,
        email,
        phone,
        password,
        fullName,
        college,
      });
      if (result?.session) {
        return;
      }
      if (REQUIRE_EMAIL_CONFIRMATION && authMethod === STUDENT_AUTH_METHODS.EMAIL) {
        setNotice('Account created. Check your email to confirm, then sign in.');
      } else {
        setNotice('Account created. You can sign in now with your mobile or email and password.');
      }
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
        description="Create a student account to apply for fresher jobs in Vizag."
        canonical="/student/register"
      />
      <div className="mx-auto max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
        <h1 className="text-3xl font-black text-slate-950">Create student account</h1>
        <p className="mt-2 text-sm text-slate-600">
          Register with email or mobile to apply for jobs in Vizag.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <StudentAuthMethodTabs value={authMethod} onChange={setAuthMethod} />

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">College / university</span>
            <input
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              required
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </label>

          {authMethod === STUDENT_AUTH_METHODS.EMAIL ? (
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
          ) : (
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Mobile number</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                placeholder="9876543210"
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
          )}

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </label>

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
