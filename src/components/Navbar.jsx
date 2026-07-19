import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import NavbarPostJobLink from './NavbarPostJobLink';
import NavbarSavedJobsLink from './NavbarSavedJobsLink';
import NavbarAppliedJobsLink from './NavbarAppliedJobsLink';
import NavbarStudentAuth from './NavbarStudentAuth';
import QuestionNotificationBell from './QuestionNotificationBell';

const primaryLinks = [
  { label: 'Home', to: '/' },
  { label: 'Blog', to: '/blog' },
  { label: 'Feedback', to: '/feedback' },
];

const jobCategoryLinks = [
  { label: 'All Jobs', to: '/jobs' },
  { label: 'IT Jobs', to: '/jobs/it' },
  { label: 'Civil Jobs', to: '/jobs/civil' },
  { label: 'Mechanical Jobs', to: '/jobs/mechanical' },
  { label: 'Engineering', to: '/jobs/engineering' },
  { label: 'Fresher Jobs', to: '/jobs/fresher' },
];

const getLinkClassName = ({ isActive }) =>
  `whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-cyan-50 text-cyan-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
  }`;

const getMobileLinkClassName = ({ isActive }) =>
  `rounded-xl px-3 py-3 text-base font-medium transition ${
    isActive ? 'bg-cyan-50 text-cyan-700' : 'text-slate-700 hover:bg-slate-50 hover:text-cyan-600'
  }`;

const isJobsSectionActive = (pathname) =>
  pathname === '/jobs' || pathname.startsWith('/jobs/');

function JobsDropdown({ isOpen, onToggle, onClose }) {
  const location = useLocation();
  const menuRef = useRef(null);
  const jobsActive = isJobsSectionActive(location.pathname);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        onClose();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
          jobsActive
            ? 'bg-cyan-50 text-cyan-700'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        Jobs
        <svg
          className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 min-w-[13rem] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-200/70"
        >
          {jobCategoryLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              role="menuitem"
              onClick={onClose}
              className={({ isActive }) =>
                `block whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-cyan-50 text-cyan-700'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-cyan-600'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Navbar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isJobsMenuOpen, setIsJobsMenuOpen] = useState(false);
  const [menuLocationKey, setMenuLocationKey] = useState(location.key);
  const closeJobsMenu = () => setIsJobsMenuOpen(false);

  // Close menus when the route changes (React-recommended render-time reset).
  if (menuLocationKey !== location.key) {
    setMenuLocationKey(location.key);
    if (isOpen) setIsOpen(false);
    if (isJobsMenuOpen) setIsJobsMenuOpen(false);
  }

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
      {isOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 top-14 z-40 bg-slate-950/40 lg:hidden sm:top-16"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      <div className="relative z-50 mx-auto flex h-14 w-full max-w-7xl items-center px-3 sm:h-16 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="mr-6 min-w-0 shrink-0 text-lg font-black tracking-tight text-slate-950 sm:mr-10 sm:text-2xl"
        >
          Vizag<span className="text-cyan-500">Jobs</span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
          <NavLink to="/" end className={getLinkClassName}>
            Home
          </NavLink>
          <JobsDropdown
            isOpen={isJobsMenuOpen}
            onToggle={() => setIsJobsMenuOpen((current) => !current)}
            onClose={closeJobsMenu}
          />
          {primaryLinks
            .filter((link) => link.to !== '/')
            .map((link) => (
              <NavLink key={link.to} to={link.to} className={getLinkClassName}>
                {link.label}
              </NavLink>
            ))}
          <NavbarAppliedJobsLink />
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <NavbarSavedJobsLink />
          <QuestionNotificationBell />
          <NavbarPostJobLink className="inline-flex h-9 items-center whitespace-nowrap rounded-xl border border-slate-200 px-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50" />
          <Link
            to="/contact"
            className="inline-flex h-9 items-center whitespace-nowrap rounded-xl bg-cyan-500 px-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Contact
          </Link>
          <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-3">
            <NavbarStudentAuth />
          </div>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 lg:hidden">
          <NavbarStudentAuth variant="mobileHeader" />
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setIsOpen((currentValue) => !currentValue)}
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      <div
        id="mobile-nav-drawer"
        className={`relative z-50 border-t border-slate-200 bg-white transition-[max-height] duration-300 lg:hidden ${
          isOpen ? 'max-h-[min(85dvh,720px)] overflow-y-auto overscroll-contain' : 'max-h-0 overflow-hidden'
        }`}
      >
        <nav className="mx-auto flex w-full max-w-7xl flex-col px-3 py-3 sm:px-6">
          <NavLink to="/" end className={getMobileLinkClassName} onClick={() => setIsOpen(false)}>
            Home
          </NavLink>

          <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Jobs
          </p>
          {jobCategoryLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={getMobileLinkClassName}
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}

          {primaryLinks
            .filter((link) => link.to !== '/')
            .map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={getMobileLinkClassName}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}

          <NavbarAppliedJobsLink variant="mobile" onClick={() => setIsOpen(false)} />

          <NavbarStudentAuth variant="mobile" onNavigate={() => setIsOpen(false)} />

          <div className="mt-3 flex flex-col gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-center gap-2 pb-1">
              <NavbarSavedJobsLink onClick={() => setIsOpen(false)} />
              <QuestionNotificationBell />
            </div>
            <NavbarPostJobLink
              onClick={() => setIsOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-center text-base font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            />
            <Link
              to="/contact"
              onClick={() => setIsOpen(false)}
              className="rounded-xl bg-cyan-500 px-4 py-3 text-center text-base font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Contact
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
