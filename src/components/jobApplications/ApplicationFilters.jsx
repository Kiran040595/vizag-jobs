import {
  ALL_APPLICATION_STATUSES,
  APPLICATION_STATUS_FILTER_OPTIONS,
} from '../../lib/applicationFilters';

const fieldClassName =
  'rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100';

export default function ApplicationFilters({
  status = ALL_APPLICATION_STATUSES,
  onStatusChange,
  filteredCount = 0,
  totalCount = 0,
}) {
  const isFiltered = status !== ALL_APPLICATION_STATUSES;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <p className="text-sm font-bold text-slate-950">Filter by status</p>
        <p className="mt-1 text-xs text-slate-500">
          Showing {filteredCount} of {totalCount} application{totalCount === 1 ? '' : 's'}
          {isFiltered ? ' (filtered)' : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="application-status-filter">
          Application status
        </label>
        <select
          id="application-status-filter"
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          className={fieldClassName}
        >
          {APPLICATION_STATUS_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {isFiltered ? (
          <button
            type="button"
            onClick={() => onStatusChange(ALL_APPLICATION_STATUSES)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
