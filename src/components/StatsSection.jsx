import { formatStatCount } from '../lib/siteStats';

const StatIcon = ({ icon }) => {
  const iconClass = 'h-5 w-5 text-blue-100';

  if (icon === 'briefcase') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-12 6h18" />
      </svg>
    );
  }

  if (icon === 'building') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
        <path d="M4 20V6a1 1 0 0 1 1-1h6v15M14 20V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v17M8 9h2m-2 4h2m-2 4h2m8-8h1m-1 4h1m-1 4h1" />
      </svg>
    );
  }

  if (icon === 'spark') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
        <path d="M12 3v4m0 10v4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8M3 12h4m10 0h4M5.6 18.4l2.8-2.8m7.2-7.2 2.8-2.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
      <path d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  );
};

/**
 * @param {{
 *   stats?: { activeJobs: number, companies: number, newThisWeek: number, categories: number, postedToday: number } | null,
 *   isLoading?: boolean,
 * }} props
 */
export default function StatsSection({ stats = null, isLoading = false }) {
  const items = [
    { icon: 'briefcase', value: formatStatCount(stats?.activeJobs), label: 'Active Jobs' },
    { icon: 'building', value: formatStatCount(stats?.companies), label: 'Companies Hiring' },
    { icon: 'spark', value: formatStatCount(stats?.newThisWeek), label: 'New This Week' },
    { icon: 'list', value: formatStatCount(stats?.categories), label: 'Job Categories' },
  ];

  return (
    <section
      className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 shadow-lg"
      aria-label="Site statistics"
      aria-busy={isLoading}
    >
      <div className="grid gap-2.5 px-3 py-4 text-center sm:grid-cols-2 sm:gap-3 sm:px-6 sm:py-5 md:grid-cols-4 md:gap-4 md:py-6">
        {items.map((item) => (
          <article key={item.label} className="flex flex-col items-center justify-center rounded-xl bg-white/10 p-2.5 sm:p-3">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 sm:h-10 sm:w-10">
              <StatIcon icon={item.icon} />
            </div>
            <h3 className="text-lg font-extrabold text-white sm:text-xl md:text-2xl">
              {isLoading && !stats ? '…' : item.value}
            </h3>
            <p className="mt-1 text-xs font-medium text-blue-100 sm:text-sm">{item.label}</p>
          </article>
        ))}
      </div>
      {stats && stats.postedToday > 0 ? (
        <p className="border-t border-white/10 px-4 py-2 text-center text-xs text-blue-100 sm:text-sm">
          {formatStatCount(stats.postedToday)} new {stats.postedToday === 1 ? 'listing' : 'listings'} added in the last 24 hours
        </p>
      ) : null}
    </section>
  );
}
