import { NavLink } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const navItems = [
  { label: 'New Job', to: '/admin/new' },
  { label: 'Existing Jobs', to: '/admin/jobs' },
  { label: 'Employer registrations', to: '/admin/employers' },
  { label: 'Fetch external jobs', to: '/admin/fetch' },
  { label: 'Blog posts', to: '/admin/blog' },
  { label: 'New post', to: '/admin/blog/new' },
  { label: 'Site feedback', to: '/admin/feedback' },
];

export default function AdminShell({ children, title, description }) {
  const { signOut, user } = useAdminAuth();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(15,23,42,0.08),_transparent_25%),linear-gradient(180deg,_#f8fbff_0%,_#f8fafc_55%,_#ffffff_100%)]">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-600">Vizag Jobs Admin</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">{title}</h1>
            {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
              Signed in as <span className="font-semibold text-slate-900">{user?.email}</span>
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
                    ? 'bg-cyan-500 text-slate-950'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
