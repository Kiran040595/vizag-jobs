import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import EmployerGoogleButton from '../components/employer/EmployerGoogleButton';
import { REQUIRE_EMAIL_CONFIRMATION, SHOW_EMPLOYER_GOOGLE_AUTH } from '../lib/employerAuthFeatures';
import { useEmployerAuth } from '../hooks/useEmployerAuth';

export default function EmployerRegisterPage() {
  const { isEmployer, isLoading, isSupabaseConfigured, session, signUp } = useEmployerAuth();
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [notice, setNotice] = useState('');
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

  if (session) {
    return <Navigate to={isEmployer ? '/employer/jobs' : '/employer/profile'} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setNotice('');
    setIsSubmitting(true);

    try {
      const result = await signUp({ email, password, companyName });
      if (result?.session) {
        return;
      }
      if (REQUIRE_EMAIL_CONFIRMATION) {
        setNotice('Account created. Check your email to confirm, then sign in.');
      } else {
        setNotice('Account created. You can sign in now with your email and password.');
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.2),_transparent_35%),linear-gradient(180deg,_#eff6ff_0%,_#ffffff_45%,_#f8fafc_100%)] px-4 py-12">
      <SEO title="Employer register | Vizag Jobs" description="Create an employer account to post jobs." canonical="/employer/register" />
      <div className="mx-auto max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
        <h1 className="text-3xl font-black text-slate-950">Create employer account</h1>
        <p className="mt-2 text-sm text-slate-600">Post jobs for your company after admin approval.</p>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Company name</span>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
          </label>

          {SHOW_EMPLOYER_GOOGLE_AUTH ? (
            <>
              <EmployerGoogleButton
                companyName={companyName}
                requireCompanyName
                label="Sign up with Google"
              />
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wide">
                  <span className="bg-white px-3 text-slate-400">Or use email</span>
                </div>
              </div>
            </>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                minLength={6}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </label>
            {notice ? (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {notice}
                {!REQUIRE_EMAIL_CONFIRMATION ? (
                  <>
                    {' '}
                    <Link to="/employer/login" className="font-semibold underline">
                      Sign in
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}
            {submitError ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</p>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-2xl bg-cyan-500 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-70"
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>
        <p className="mt-6 text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/employer/login" className="font-semibold text-cyan-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
