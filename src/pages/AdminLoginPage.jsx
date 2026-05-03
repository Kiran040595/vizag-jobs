import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAdminAuth } from '../hooks/useAdminAuth';

export default function AdminLoginPage() {
  const { authError, isAdmin, isLoading, isSupabaseConfigured, session, signIn, signOut, user } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-12 text-white">
        <SEO title="Admin Login | Vizag Jobs" description="Sign in to the Vizag Jobs admin panel." canonical="/admin/login" />
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <h1 className="text-2xl font-black">Supabase is not configured.</h1>
          <p className="mt-3 text-sm text-slate-300">
            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before signing in.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <SEO title="Admin Login | Vizag Jobs" description="Sign in to the Vizag Jobs admin panel." canonical="/admin/login" />
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <LoadingSpinner message="Preparing admin login..." />
        </div>
      </div>
    );
  }

  if (session && isAdmin) {
    return <Navigate to="/admin" replace />;
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

  if (session && !isAdmin) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(180deg,_#eff6ff_0%,_#ffffff_45%,_#f8fafc_100%)] px-4 py-12">
        <SEO title="Admin Login | Vizag Jobs" description="Sign in to the Vizag Jobs admin panel." canonical="/admin/login" />
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">Signed in</p>
          <h1 className="mt-3 text-3xl font-black text-slate-950">This user is not an admin yet.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            <span className="font-semibold text-slate-900">{user?.email}</span> can authenticate successfully, but it
            still needs an entry in `public.admin_users`.
          </p>
          {authError ? (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {authError}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Sign out
            </button>
            <a
              href="/"
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Back to site
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.2),_transparent_35%),linear-gradient(180deg,_#eff6ff_0%,_#ffffff_45%,_#f8fafc_100%)] px-4 py-12">
      <SEO title="Admin Login | Vizag Jobs" description="Sign in to the Vizag Jobs admin panel." canonical="/admin/login" />
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-2xl shadow-blue-950/20 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">Vizag Jobs Admin</p>
          <h1 className="mt-4 max-w-md text-4xl font-black leading-tight">Post and manage jobs without leaving the app.</h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300">
            Approved admins can sign in here to create new job posts, keep drafts unpublished, and manage featured
            listings directly from the dashboard.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ['Drafts', 'Prepare jobs before they go live.'],
              ['Publishing', 'Push openings live in one click.'],
              ['Management', 'Edit, archive, and feature listings.'],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-2 text-xs leading-5 text-slate-300">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/80 sm:p-10">
          <h2 className="text-2xl font-black text-slate-950">Sign in</h2>
          <p className="mt-2 text-sm text-slate-600">Use a Supabase Auth account that has been allowlisted as an admin.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                placeholder="admin@jobsinvizag.in"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                placeholder="Enter your password"
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
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-cyan-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Signing in...' : 'Continue to admin'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
