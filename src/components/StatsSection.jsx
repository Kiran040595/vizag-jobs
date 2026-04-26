const statsItems = [
  { icon: 'briefcase', value: '2500+', label: 'Active Jobs' },
  { icon: 'building', value: '350+', label: 'Companies' },
  { icon: 'users', value: '50K+', label: 'Job Seekers' },
  { icon: 'bell', value: 'Daily Updates', label: 'Fresh Jobs Everyday' }
];

function StatIcon({ icon }) {
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

  if (icon === 'users') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5M14 19c0-2.1 1.6-3.8 4-4.4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0" />
    </svg>
  );
}

export default function StatsSection() {
  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 shadow-lg">
      <div className="grid gap-2.5 px-3 py-4 text-center sm:grid-cols-2 sm:gap-3 sm:px-6 sm:py-5 md:grid-cols-4 md:gap-4 md:py-6">
        {statsItems.map((item) => (
          <article key={item.label} className="flex flex-col items-center justify-center rounded-xl bg-white/10 p-2.5 sm:p-3">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 sm:h-10 sm:w-10">
              <StatIcon icon={item.icon} />
            </div>
            <h3 className="text-lg font-extrabold text-white sm:text-xl md:text-2xl">{item.value}</h3>
            <p className="mt-1 text-xs font-medium text-blue-100 sm:text-sm">{item.label}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
