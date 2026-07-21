import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { useEmployerAuth } from '../hooks/useEmployerAuth';

export default function EmployerForgotPasswordPage() {
  const { isLoading, isSupabaseConfigured, requestPasswordReset } = useEmployerAuth();
  const [email, setEmail] = useState('');
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setNotice('');
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      setNotice(
        'If an account matches, we sent a password reset link to that email. Check your inbox and spam folder.',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send reset link.';
      if (/enter the email/i.test(message)) {
        setSubmitError(message);
      } else {
        setNotice(
          'If an account matches, we sent a password reset link to that email. Check your inbox and spam folder.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.2),_transparent_35%),linear-gradient(180deg,_#eff6ff_0%,_#ffffff_45%,_#f8fafc_100%)] px-4 py-12">
      <SEO
        title="Forgot password | Employer | Vizag Jobs"
        description="Reset your Vizag Jobs employer account password."
        canonical="/employer/forgot-password"
      />
      <div className="mx-auto max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
        <h1 className="text-3xl font-black text-slate-950">Forgot password</h1>
        <p className="mt-3 text-sm text-slate-600">
          Enter the email for your employer account. We will send a reset link if it matches.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
          </label>

          {notice ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </p>
          ) : null}
          {submitError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-2xl bg-cyan-500 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-70"
          >
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link to="/employer/login" className="font-semibold text-cyan-600 hover:text-cyan-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
