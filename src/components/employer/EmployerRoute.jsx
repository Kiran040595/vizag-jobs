import { Navigate } from 'react-router-dom';
import LoadingSpinner from '../LoadingSpinner';
import { useEmployerAuth } from '../../hooks/useEmployerAuth';

function EmployerAccessDenied() {
  const { authError, signOut, user } = useEmployerAuth();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_35%),linear-gradient(180deg,_#eff6ff_0%,_#ffffff_45%,_#f8fafc_100%)] px-4 py-12">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">Employer access required</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">Complete your company profile</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Signed in as <span className="font-semibold text-slate-900">{user?.email}</span>. Save your company
          details to post jobs for review.
        </p>
        {authError ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {authError}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/employer/profile"
            className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Company profile
          </a>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmployerRoute({ children }) {
  const { isEmployer, isLoading, isSupabaseConfigured, session } = useEmployerAuth();

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <h1 className="text-2xl font-black">Supabase is not configured.</h1>
          <p className="mt-3 text-sm text-slate-300">
            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before using employer features.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <LoadingSpinner message="Checking employer access..." />
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/employer/login" replace />;
  }

  if (!isEmployer) {
    return <EmployerAccessDenied />;
  }

  return children;
}
