import { NavLink, useLocation } from 'react-router-dom';
import { useSavedJobsList } from '../lib/useSavedJob';

const HIDDEN_PREFIXES = ['/admin', '/employer', '/oauth'];

const CATEGORY_LISTING_SLUGS = new Set([
  'it',
  'fresher',
  'part-time',
  'civil',
  'mechanical',
  'electrical',
  'ece',
  'engineering',
  'vizagjobs',
]);

function HomeIcon({ active }) {
  return (
    <svg
      className="h-5 w-5 transition-transform group-active:scale-90"
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? '2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function JobsIcon({ active }) {
  return (
    <svg
      className="h-5 w-5 transition-transform group-active:scale-90"
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? '2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function CompaniesIcon({ active }) {
  return (
    <svg
      className="h-5 w-5 transition-transform group-active:scale-90"
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? '2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

function QaIcon({ active }) {
  return (
    <svg
      className="h-5 w-5 transition-transform group-active:scale-90"
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? '2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function BookmarkIcon({ active }) {
  return (
    <svg
      className="h-5 w-5 transition-transform group-active:scale-90"
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? '2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function MobileBottomNav() {
  const location = useLocation();
  const savedJobs = useSavedJobsList();
  const savedCount = savedJobs.length;

  const isHiddenPrefix = HIDDEN_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix),
  );

  // Check if on an individual job detail page where the sticky Apply Now bar is active
  const isJobDetailPage = (() => {
    if (/^\/jobs\/[^/]+\/[^/]+/.test(location.pathname)) return true;
    if (/^\/job\/[^/]+/.test(location.pathname)) return true;
    const singleSegmentMatch = location.pathname.match(/^\/jobs\/([^/]+)$/);
    if (singleSegmentMatch) {
      const segment = singleSegmentMatch[1].toLowerCase();
      return !CATEGORY_LISTING_SLUGS.has(segment);
    }
    return false;
  })();

  if (isHiddenPrefix || isJobDetailPage) {
    return null;
  }

  const navItems = [
    { to: '/', label: 'Home', exact: true, Icon: HomeIcon },
    {
      to: '/jobs',
      label: 'Jobs',
      exact: false,
      isActiveMatch: (pathname) =>
        pathname === '/jobs' ||
        (pathname.startsWith('/jobs/') &&
          CATEGORY_LISTING_SLUGS.has(pathname.split('/')[2]?.toLowerCase())),
      Icon: JobsIcon,
    },
    { to: '/companies', label: 'Companies', exact: false, Icon: CompaniesIcon },
    { to: '/qa', label: 'Q&A', exact: false, Icon: QaIcon },
    {
      to: '/saved-jobs',
      label: 'Saved',
      exact: false,
      badge: savedCount > 0 ? (savedCount > 9 ? '9+' : savedCount) : null,
      Icon: BookmarkIcon,
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_20px_rgba(15,23,42,0.08)] backdrop-blur-md lg:hidden"
      aria-label="Mobile Navigation Bar"
    >
      <div className="grid h-14 grid-cols-5 items-center sm:h-16">
        {navItems.map(({ to, label, exact, isActiveMatch, Icon, badge }) => {
          const isActive = isActiveMatch
            ? isActiveMatch(location.pathname)
            : exact
              ? location.pathname === to
              : location.pathname.startsWith(to);

          return (
            <NavLink
              key={to}
              to={to}
              className={`group relative flex h-full flex-col items-center justify-center gap-0.5 px-1 py-1 text-center transition-colors focus:outline-none focus-visible:bg-slate-100 ${
                isActive ? 'text-cyan-600' : 'text-slate-500 hover:text-slate-800'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative inline-flex items-center justify-center">
                <Icon active={isActive} />
                {badge ? (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-bold leading-none text-slate-950 shadow-sm">
                    {badge}
                  </span>
                ) : null}
              </div>
              <span
                className={`text-[10px] tracking-tight leading-tight sm:text-[11px] ${
                  isActive ? 'font-bold' : 'font-medium'
                }`}
              >
                {label}
              </span>
              {isActive ? (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-cyan-600 sm:w-10" />
              ) : null}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
