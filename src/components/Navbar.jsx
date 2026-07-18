import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import NavbarPostJobLink from './NavbarPostJobLink';
import NavbarSavedJobsLink from './NavbarSavedJobsLink';
import NavbarAppliedJobsLink from './NavbarAppliedJobsLink';
import NavbarStudentAuth from './NavbarStudentAuth';
import QuestionNotificationBell from './QuestionNotificationBell';

const primaryLinks = [
  { label: 'Home', to: '/' },
  { label: 'All Jobs', to: '/jobs' },
  { label: 'Blog', to: '/blog' },
  { label: 'Feedback', to: '/feedback' },
];

const jobsMenuLinks = [
  { label: 'IT Jobs', to: '/jobs/it' },
  { label: 'Civil Jobs', to: '/jobs/civil' },
  { label: 'Mechanical Jobs', to: '/jobs/mechanical' },
  { label: 'Engineering', to: '/jobs/engineering' },
  { label: 'Fresher Jobs', to: '/jobs/fresher' },
  { label: 'Part-Time Jobs', to: '/jobs/part-time' },
];

const mobileNavLinks = [
  ...primaryLinks.slice(0, 2),
  ...jobsMenuLinks,
  ...primaryLinks.slice(2),
];

const getLinkClassName = ({ isActive }) =>
  `whitespace-nowrap text-sm font-medium transition-colors ${
    isActive ? 'text-cyan-600' : 'text-slate-700 hover:text-cyan-600'
  }`;

function JobsDropdown() {
  const [open, setOpen] = useState(false);
  const [openForPath, setOpenForPath] = useState('');
  const menuId = useId();
  const containerRef = useRef(null);
  const location = useLocation();
  const isJobsSectionActive = jobsMenuLinks.some(
    (link) => location.pathname === link.to || location.pathname.startsWith(`${link.to}/`),
  );

  if (openForPath !== location.pathname) {
    setOpenForPath(location.pathname);
    if (open) {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium transition-colors ${
          isJobsSectionActive || open ? 'text-cyan-600' : 'text-slate-700 hover:text-cyan-600'
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        Categories
        <svg
          className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`}
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

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 top-full z-50 min-w-[13rem] pt-2"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70">
            {jobsMenuLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                role="menuitem"
                className={({ isActive }) =>
                  `block rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-cyan-50 text-cyan-700'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-cyan-700'
                  }`
                }
                onClick={() => setOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Navbar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [menuLocationKey, setMenuLocationKey] = useState(location.key);

  // Close the drawer when the route changes (React-recommended render-time reset).
  if (menuLocationKey !== location.key) {
    setMenuLocationKey(location.key);
    if (isOpen) {
      setIsOpen(false);
    }
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

      <div className="relative z-50 mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="min-w-0 shrink text-lg font-black tracking-tight text-slate-950 sm:text-2xl"
        >
          Vizag<span className="text-cyan-500">Jobs</span>
        </Link>

        <nav className="hidden items-center gap-5 xl:gap-6 lg:flex">
          {primaryLinks.map((link) => (
            <NavLink key={link.to} to={link.to} className={getLinkClassName} end={link.to === '/'}>
              {link.label}
            </NavLink>
          ))}
          <JobsDropdown />
        </nav>

        <div className="hidden items-center gap-2 lg:flex xl:gap-2.5">
          <NavbarAppliedJobsLink />
          <NavbarSavedJobsLink />
          <QuestionNotificationBell />
          <NavbarPostJobLink className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 xl:px-4" />
          <Link
            to="/contact"
            className="rounded-xl bg-cyan-500 px-3.5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 xl:px-4"
          >
            Contact
          </Link>
          <NavbarStudentAuth />
        </div>

        <div className="flex min-w-0 items-center gap-1.5 lg:hidden">
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
          {mobileNavLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `rounded-xl px-3 py-3 text-base font-medium transition ${
                  isActive ? 'bg-cyan-50 text-cyan-700' : 'text-slate-700 hover:bg-slate-50 hover:text-cyan-600'
                }`
              }
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
