import {
  APPLICATION_EXPERIENCE_FILTER_OPTIONS,
  APPLICATION_STATUS_FILTER_OPTIONS,
  EMPTY_APPLICATION_FILTERS,
  collectApplicationColleges,
  hasActiveApplicationFilters,
} from '../../lib/applicationFilters';

const fieldClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100';

export default function ApplicationFilters({
  applications = [],
  filters,
  onChange,
  filteredCount = 0,
  totalCount = 0,
}) {
  const colleges = collectApplicationColleges(applications);
  const isFiltered = hasActiveApplicationFilters(filters);

  const update = (patch) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-950">Filter applicants</h2>
          <p className="mt-1 text-xs text-slate-500">
            Showing {filteredCount} of {totalCount} application{totalCount === 1 ? '' : 's'}
            {isFiltered ? ' (filtered)' : ''}
          </p>
        </div>
        {isFiltered ? (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_APPLICATION_FILTERS })}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <label className="block sm:col-span-2 lg:col-span-3 xl:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search
          </span>
          <input
            type="search"
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
            placeholder="Name, phone, or email…"
            className={fieldClassName}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
          </span>
          <select
            value={filters.status}
            onChange={(event) => update({ status: event.target.value })}
            className={fieldClassName}
          >
            {APPLICATION_STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Experience
          </span>
          <select
            value={filters.experience}
            onChange={(event) => update({ experience: event.target.value })}
            className={fieldClassName}
          >
            {APPLICATION_EXPERIENCE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            College
          </span>
          <select
            value={filters.college}
            onChange={(event) => update({ college: event.target.value })}
            className={fieldClassName}
          >
            <option value="all">All colleges</option>
            {colleges.map((college) => (
              <option key={college} value={college}>
                {college}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2 lg:col-span-3 xl:col-span-5">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Skills
          </span>
          <input
            type="search"
            value={filters.skills}
            onChange={(event) => update({ skills: event.target.value })}
            placeholder="e.g. python, excel, communication…"
            className={fieldClassName}
          />
        </label>
      </div>
    </div>
  );
}
