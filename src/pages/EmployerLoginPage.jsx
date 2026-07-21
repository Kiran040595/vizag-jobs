import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import EmployerGoogleButton from '../components/employer/EmployerGoogleButton';
import { SHOW_EMPLOYER_GOOGLE_AUTH } from '../lib/employerAuthFeatures';
import { useEmployerAuth } from '../hooks/useEmployerAuth';

export default function EmployerLoginPage() {
  const [searchParams] = useSearchParams();
  const redirectAfterLogin = searchParams.get('redirect');
  const { authError, isEmployer, isLoading, isSupabaseConfigured, session, signIn } = useEmployerAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const postLoginPath =
    redirectAfterLogin && redirectAfterLogin.startsWith('/') ? redirectAfterLogin : null;

  if (session && isEmployer) {
    return <Navigate to={postLoginPath || '/employer/jobs'} replace />;
  }

  if (session && !isEmployer) {
    return <Navigate to={postLoginPath || '/employer/profile'} replace />;
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.2),_transparent_35%),linear-gradient(180deg,_#eff6ff_0%,_#ffffff_45%,_#f8fafc_100%)] px-4 py-12">
      <SEO title="Employer login | Vizag Jobs" description="Sign in to post jobs for your company." canonical="/employer/login" />
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] bg-slate-950 p-8 text-white sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">For employers</p>
          <h1 className="mt-4 text-4xl font-black leading-tight">Post jobs for your company in Vizag</h1>
          <p className="mt-5 text-sm leading-7 text-slate-300">
            Submit openings for admin review. Approved listings appear on the public job portal.
          </p>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
          <h2 className="text-2xl font-black text-slate-950">Sign in</h2>
          {searchParams.get('reset') === '1' ? (
            <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Password updated. Sign in with your new password.
            </p>
          ) : null}

          {SHOW_EMPLOYER_GOOGLE_AUTH ? (
            <>
              <div className="mt-8">
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

          <form onSubmit={handleSubmit} className={`space-y-5 ${SHOW_EMPLOYER_GOOGLE_AUTH ? '' : 'mt-8'}`}>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </label>
            <p className="-mt-2 text-right text-sm">
              <Link
                to="/employer/forgot-password"
                className="font-semibold text-cyan-600 hover:text-cyan-700"
              >
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
              Create an account
            </Link>
          </p>
          <p className="mt-2 text-sm text-slate-500">
            <Link to="/" className="hover:text-slate-700">
              Back to job listings
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
