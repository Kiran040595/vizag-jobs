import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'All Jobs', to: '/jobs' },
  { label: 'IT Jobs', to: '/jobs/it' },
  { label: 'Fresher Jobs', to: '/jobs/fresher' },
  { label: 'Part-Time Jobs', to: '/jobs/part-time' },
];

const getLinkClassName = ({ isActive }) =>
  `text-sm font-medium transition-colors ${
    isActive ? 'text-cyan-600' : 'text-slate-700 hover:text-cyan-600'
  }`;

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
          Vizag<span className="text-cyan-500">Jobs</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <NavLink key={link.to} to={link.to} className={getLinkClassName}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          <Link
            to="/jobs"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Browse jobs
          </Link>
          <Link
            to="/admin/login"
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Admin login
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl p-2 text-slate-700 transition hover:bg-slate-100 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((currentValue) => !currentValue)}
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      <div className={`overflow-hidden border-t border-slate-200 bg-white transition-all duration-300 md:hidden ${isOpen ? 'max-h-[420px]' : 'max-h-0'}`}>
        <nav className="mx-auto flex w-full max-w-7xl flex-col px-4 py-3 sm:px-6">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-cyan-50 text-cyan-700' : 'text-slate-700 hover:bg-slate-50 hover:text-cyan-600'
                }`
              }
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}

          <div className="mt-3 flex flex-col gap-2 pb-2">
            <Link
              to="/jobs"
              onClick={() => setIsOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Browse jobs
            </Link>
            <Link
              to="/admin/login"
              onClick={() => setIsOpen(false)}
              className="rounded-xl bg-cyan-500 px-4 py-2.5 text-center text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Admin login
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
