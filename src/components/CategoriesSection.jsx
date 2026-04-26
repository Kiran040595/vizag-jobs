const categoryItems = [
  { title: 'IT & Software', jobs: '1,250+ Jobs', icon: 'monitor' },
  { title: 'Non-IT', jobs: '860+ Jobs', icon: 'briefcase' },
  { title: 'Fresher Jobs', jobs: '620+ Jobs', icon: 'graduation' },
  { title: 'Walk-in Interviews', jobs: '320+ Jobs', icon: 'users' },
  { title: 'Part-time Jobs', jobs: '210+ Jobs', icon: 'clock' },
  { title: 'Internships', jobs: '180+ Jobs', icon: 'clipboard' }
];

function CategoryIcon({ icon }) {
  const baseClass = 'h-6 w-6 text-blue-600';

  if (icon === 'monitor') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={baseClass}>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8m-6-4v4m4-4v4" />
      </svg>
    );
  }

  if (icon === 'briefcase') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={baseClass}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-12 6h18" />
      </svg>
    );
  }

  if (icon === 'graduation') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={baseClass}>
        <path d="M3 9l9-5 9 5-9 5-9-5Z" />
        <path d="M7 11.2V15c0 1.5 2.2 3 5 3s5-1.5 5-3v-3.8" />
      </svg>
    );
  }

  if (icon === 'users') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={baseClass}>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5M14 19c0-2.1 1.6-3.8 4-4.4" />
      </svg>
    );
  }

  if (icon === 'clock') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={baseClass}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={baseClass}>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 9h6M9 13h6M9 17h4" />
    </svg>
  );
}

export default function CategoriesSection() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-4 sm:mb-5">
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Browse Jobs by Category</h2>
        <button
          type="button"
          className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
        >
          View All Categories
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {categoryItems.map((item) => (
          <article
            key={item.title}
            className="group rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-center transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-lg sm:p-4"
          >
            <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 transition group-hover:bg-blue-100 sm:mb-3 sm:h-12 sm:w-12">
              <CategoryIcon icon={item.icon} />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
            <p className="mt-1 text-xs font-medium text-slate-500">{item.jobs}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
