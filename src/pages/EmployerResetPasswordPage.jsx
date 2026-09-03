import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { useEmployerAuth } from '../hooks/useEmployerAuth';
import { supabase } from '../lib/supabaseClient';

export default function EmployerResetPasswordPage() {
  const navigate = useNavigate();
  const { isLoading, isSupabaseConfigured, session, signOut, updatePassword } = useEmployerAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setRecoveryChecked(true);
      return undefined;
    }

    let ignore = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (ignore) {
        return;
      }
      if (event === 'PASSWORD_RECOVERY' || nextSession) {
        setRecoveryReady(true);
      }
      setRecoveryChecked(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (ignore) {
        return;
      }
      if (data.session) {
        setRecoveryReady(true);
      }
      setRecoveryChecked(true);
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <h1 className="text-2xl font-black">Supabase is not configured.</h1>
        </div>
      </div>
    );
  }

  if (isLoading || !recoveryChecked) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8">
          <LoadingSpinner message="Checking reset link..." />
        </div>
      </div>
    );
  }

  const canReset = recoveryReady || Boolean(session);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updatePassword(password);
      try {
        await signOut();
      } catch {
        // Ignore sign-out failures; password was already updated.
      }
      navigate('/employer/login?reset=1', { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.2),_transparent_35%),linear-gradient(180deg,_#eff6ff_0%,_#ffffff_45%,_#f8fafc_100%)] px-4 py-12">
      <SEO
        title="Reset password | Employer | Vizag Jobs"
        description="Choose a new password for your Vizag Jobs employer account."
        canonical="/employer/reset-password"
      />
      <div className="mx-auto max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
        <h1 className="text-3xl font-black text-slate-950">Reset password</h1>

        {!canReset ? (
          <>
            <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              This reset link is invalid or has expired. Request a new one and try again.
            </p>
            <p className="mt-6 text-center text-sm text-slate-600">
              <Link
                to="/employer/forgot-password"
                className="font-semibold text-cyan-600 hover:text-cyan-700"
              >
                Request a new reset link
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-slate-600">Enter a new password for your employer account.</p>
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">New password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Confirm new password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                />
              </label>
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
                {isSubmitting ? 'Saving...' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
