import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import EmployerGoogleButton from '../components/employer/EmployerGoogleButton';
import { SHOW_EMPLOYER_GOOGLE_AUTH } from '../lib/employerAuthFeatures';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { useEmployerAuth } from '../hooks/useEmployerAuth';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  buildInternalApplyPath,
  consumePendingApplyJobId,
  consumePendingApplyUrl,
  openExternalApplyLink,
  readPendingApplyJobMeta,
  resolvePostAuthDestination,
  shouldAutoApplyAfterAuth,
  buildStudentAuthPath,
} from '../lib/studentApplyRedirect';
import { markStudentAuthSuccess } from '../lib/studentAuthSuccess';
import { trackStudentFunnel } from '../lib/studentFunnelAnalytics';

const ADMIN_LOGIN_DRAFT_KEY = 'vizagjobs:admin-login-draft';

const roleFromPath = (pathname = '') => {
  if (pathname.startsWith('/admin/login')) return 'admin';
  if (pathname.startsWith('/employer/login')) return 'employer';
  return 'student';
};

const pathForRole = (role) => {
  if (role === 'admin') return '/admin/login';
  if (role === 'employer') return '/employer/login';
  return '/student/login';
};

const getStoredAdminDraft = () => {
  try {
    const raw = sessionStorage.getItem(ADMIN_LOGIN_DRAFT_KEY);
    if (!raw) return { email: '', password: '' };
    const parsed = JSON.parse(raw);
    return {
      email: typeof parsed.email === 'string' ? parsed.email : '',
      password: typeof parsed.password === 'string' ? parsed.password : '',
    };
  } catch {
    return { email: '', password: '' };
  }
};

const RoleToggle = ({ label, active, onChange }) => (
  <button type="button" aria-pressed={active} onClick={onChange}
    className={`min-h-11 min-w-0 rounded-xl border px-2 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 ${active ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
    {label}
  </button>
);

function StudentLoginPanel({ searchParams }) {
  const navigate = useNavigate();
  const { authError, isLoading, isStudent, isSupabaseConfigured, profileComplete, session, signIn } =
    useStudentAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const returnPath = resolvePostAuthDestination(searchParams, { profileComplete });
  const nextPath = searchParams.get('next') || '';
  const isApplyReturn = shouldAutoApplyAfterAuth(searchParams) && Boolean(nextPath);
  const registerPath = `/student/register${buildStudentAuthPath({
    pathname: searchParams.get('next') || undefined,
    apply: shouldAutoApplyAfterAuth(searchParams),
  })}`;

  useEffect(() => {
    if (!session || !isStudent || isLoading) return;

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
      const meta = readPendingApplyJobMeta();
      openExternalApplyLink(pendingApply, {
        jobTitle: meta?.title || '',
        jobId: meta?.jobId || '',
      });
    }

    navigate(returnPath, { replace: true });
  }, [isLoading, isStudent, navigate, profileComplete, returnPath, searchParams, session]);

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-rose-700">Supabase is not configured.</p>;
  }

  if (session && isStudent) {
    return <Navigate to={returnPath} replace />;
  }

  if (session && isLoading) {
    return <LoadingSpinner message="Checking student account..." />;
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
          'This account could not be signed in. Try again, or create a new student account / contact support.',
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
    <>
      {isApplyReturn ? (
        <p className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          You started applying for a job. Sign in below and we will take you back to it.
        </p>
      ) : null}
      {searchParams.get('reset') === '1' ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Password updated. Sign in with your new password.
        </p>
      ) : null}
      {authError ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {authError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Email or mobile number</span>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@college.edu or 9876543210"
            className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
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
            className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </label>
        <p className="-mt-2 text-right text-sm">
          <Link to="/student/forgot-password" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Forgot password?
          </Link>
        </p>
        {submitError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</p>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-2xl bg-indigo-600 text-base font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-70"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        New here?{' '}
        <Link to={registerPath} className="font-semibold text-indigo-600 hover:text-indigo-700">
          Create free student account
        </Link>
      </p>
    </>
  );
}

function EmployerLoginPanel({ searchParams }) {
  const redirectAfterLogin = searchParams.get('redirect');
  const { authError, isEmployer, isLoading, isSupabaseConfigured, session, signIn } = useEmployerAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-rose-700">Supabase is not configured.</p>;
  }

  const postLoginPath =
    redirectAfterLogin && redirectAfterLogin.startsWith('/') ? redirectAfterLogin : null;

  if (session && isEmployer) {
    return <Navigate to={postLoginPath || '/employer/jobs'} replace />;
  }

  if (session && !isEmployer && !isLoading) {
    return <Navigate to={postLoginPath || '/employer/profile'} replace />;
  }

  if (session && isLoading) {
    return <LoadingSpinner message="Checking company access..." />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await signIn({ email, password });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {searchParams.get('reset') === '1' ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Password updated. Sign in with your new password.
        </p>
      ) : null}

      {SHOW_EMPLOYER_GOOGLE_AUTH ? (
        <>
          <div className="mt-6">
            <EmployerGoogleButton label="Sign in with Google" />
          </div>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide">
              <span className="bg-white px-3 text-slate-400">Or use email</span>
            </div>
          </div>
        </>
      ) : null}

      <form onSubmit={handleSubmit} className={`space-y-5 ${SHOW_EMPLOYER_GOOGLE_AUTH ? '' : 'mt-6'}`}>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          />
        </label>
        <p className="-mt-2 text-right text-sm">
          <Link to="/employer/forgot-password" className="font-semibold text-cyan-600 hover:text-cyan-700">
            Forgot password?
          </Link>
        </p>
        {submitError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</p>
        ) : null}
        {authError ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{authError}</p>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-2xl bg-cyan-500 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-70"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-600">
        New employer?{' '}
        <Link to="/employer/register" className="font-semibold text-cyan-600 hover:text-cyan-700">
          Create a company account
        </Link>
      </p>
    </>
  );
}

function AdminLoginPanel() {
  const { authError, isAdmin, isLoading, isSupabaseConfigured, session, signIn, signOut, user } =
    useAdminAuth();
  const [email, setEmail] = useState(() => getStoredAdminDraft().email);
  const [password, setPassword] = useState(() => getStoredAdminDraft().password);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      if (email.trim() || password) {
        sessionStorage.setItem(ADMIN_LOGIN_DRAFT_KEY, JSON.stringify({ email, password }));
        return;
      }
      sessionStorage.removeItem(ADMIN_LOGIN_DRAFT_KEY);
    } catch {
      // Ignore storage failures.
    }
  }, [email, password]);

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-rose-700">Supabase is not configured.</p>;
  }

  if (session && isAdmin) {
    return <Navigate to="/admin/new" replace />;
  }

  if (session && isLoading) {
    return <LoadingSpinner message="Checking admin access..." />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await signIn({ email, password });
      sessionStorage.removeItem(ADMIN_LOGIN_DRAFT_KEY);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {session && !isAdmin ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p>
            You are signed in as <span className="font-semibold text-slate-900">{user?.email}</span>, which is not an admin account.
          </p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span>Enter your admin credentials below, or</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="font-semibold text-rose-700 underline hover:text-rose-800"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <label className="block" htmlFor="admin-email">
          <span className="text-sm font-semibold text-slate-700">Email</span>
          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            placeholder="kiran@jobsinvizag.in"
          />
        </label>
        <label className="block" htmlFor="admin-password">
          <span className="text-sm font-semibold text-slate-700">Password</span>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          />
        </label>
      {submitError ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</p>
      ) : null}
      {authError ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{authError}</p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full rounded-2xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
      >
        {isSubmitting ? 'Signing in...' : 'Continue to admin'}
      </button>
    </form>
    </>
  );
}

export default function UnifiedLoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = useMemo(() => roleFromPath(location.pathname), [location.pathname]);

  const setRole = (nextRole) => {
    const path = pathForRole(nextRole);
    const query = searchParams.toString();
    navigate(query ? `${path}?${query}` : path, { replace: true });
  };

  const seo = {
    student: {
      title: 'Sign in | Vizag Jobs',
      description: 'Sign in to Vizag Jobs to apply for jobs in Vizag.',
      canonical: '/student/login',
      heading: 'Sign in',
      hint: 'Welcome back. Sign in to apply and track your applications.',
    },
    employer: {
      title: 'Company login | Vizag Jobs',
      description: 'Sign in to post jobs for your company.',
      canonical: '/employer/login',
      heading: 'Company sign in',
      hint: 'Sign in to post jobs and manage applications.',
    },
    admin: {
      title: 'Admin Login | Vizag Jobs',
      description: 'Sign in to the Vizag Jobs admin panel.',
      canonical: '/admin/login',
      heading: 'Admin sign in',
      hint: 'Sign in to manage the Vizag Jobs dashboard.',
    },
  }[role];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.12),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_55%,_#f1f5f9_100%)] px-3 py-6 sm:px-4 sm:py-14">
      <SEO title={seo.title} description={seo.description} canonical={seo.canonical} />

      <div className="mx-auto w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60 sm:p-8">
        <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">{seo.heading}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{seo.hint}</p>

        <div className="mt-5 grid grid-cols-3 gap-2" role="group" aria-label="Account type">
          <RoleToggle label="Student" active={role === 'student'} onChange={() => setRole('student')} />
          <RoleToggle label="Company" active={role === 'employer'} onChange={() => setRole('employer')} />
          <RoleToggle label="Admin" active={role === 'admin'} onChange={() => setRole('admin')} />
        </div>

        {role === 'student' ? <StudentLoginPanel searchParams={searchParams} /> : null}
        {role === 'employer' ? <EmployerLoginPanel searchParams={searchParams} /> : null}
        {role === 'admin' ? <AdminLoginPanel /> : null}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/" className="hover:text-slate-700">
            Back to job listings
          </Link>
        </p>
      </div>
    </div>
  );
}
