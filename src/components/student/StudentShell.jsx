import { NavLink } from 'react-router-dom';
import { useStudentAuth } from '../../hooks/useStudentAuth';

const navItems = [
  { label: 'My profile', to: '/student/profile' },
  { label: 'Applied jobs', to: '/student/applied-jobs' },
  { label: 'Browse jobs', to: '/jobs' },
];

export default function StudentShell({ children, title, description }) {
  const { profile, signOut, user } = useStudentAuth();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.12),_transparent_30%),linear-gradient(180deg,_#f8fbff_0%,_#f8fafc_55%,_#ffffff_100%)]">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">Student portal</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">{title}</h1>
            {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
            {profile?.full_name ? (
              <p className="mt-1 text-sm font-medium text-slate-500">{profile.full_name}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
              {user?.email}
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-7xl flex-wrap gap-3 px-4 pb-5 sm:px-6 lg:px-8">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-indigo-500 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <a
            href="/"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            View site
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
