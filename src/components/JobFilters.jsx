import {
  CATEGORY_OPTIONS,
  FRESHNESS_OPTIONS,
  JOB_TYPE_OPTIONS,
  isAnyFilterActive,
} from '../lib/jobFilters';

const PILL_ON_COLOR = {
  blue: 'border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-200',
  emerald: 'border-emerald-500 bg-emerald-600 text-white shadow-sm shadow-emerald-200',
};
const PILL_OFF =
  'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700';

function FilterPill({ id, label, current, onSelect, color = 'blue' }) {
  const isOn = current === id;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={isOn}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        isOn ? PILL_ON_COLOR[color] : PILL_OFF
      }`}
    >
      {label}
    </button>
  );
}

function ActiveFilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="rounded-full p-0.5 text-blue-700 transition hover:bg-blue-200 hover:text-blue-900"
      >
        <svg
          className="h-3 w-3"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M2 2 L10 10 M10 2 L2 10" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
}

const labelFor = (id, options) => options.find((o) => o.id === id)?.label ?? id;

/**
 * Inline filter bar shown above the job list. The hero already owns the
 * search input + category select; this component adds the secondary filters
 * (job type, freshness) and surfaces removable chips for active filters so
 * the user can always see — and undo — what's applied.
 *
 * Props:
 * - filters: { q, category, jobType, freshness }
 * - onUpdate(partial): merges into filters, resets page to 1
 * - onClearAll(): resets all filters
 * - resultCount: number — shown in the "X jobs" pill
 * - isRefreshing: optional boolean — renders a subtle "Updating..." spinner
 */
export default function JobFilters({
  filters,
  onUpdate,
  onClearAll,
  resultCount,
  isRefreshing = false,
}) {
  const active = isAnyFilterActive(filters);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Refine results</p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{resultCount}</span>{' '}
            {resultCount === 1 ? 'job' : 'jobs'} match your search
            {isRefreshing ? (
              <span className="ml-2 inline-flex items-center text-xs text-blue-600">
                <svg
                  className="mr-1 h-3 w-3 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Updating…
              </span>
            ) : null}
          </p>
        </div>
        {active ? (
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            Clear all filters
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:gap-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Job type
          </p>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPE_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.id}
                id={opt.id}
                label={opt.label}
                current={filters.jobType}
                onSelect={(next) => onUpdate({ jobType: next })}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Posted
          </p>
          <div className="flex flex-wrap gap-2">
            {FRESHNESS_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.id}
                id={opt.id}
                label={opt.label}
                current={filters.freshness}
                onSelect={(next) => onUpdate({ freshness: next })}
                color="emerald"
              />
            ))}
          </div>
        </div>
      </div>

      {active ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Active:
          </span>
          {filters.q?.trim() ? (
            <ActiveFilterChip
              label={`Search: "${filters.q.trim()}"`}
              onRemove={() => onUpdate({ q: '' })}
            />
          ) : null}
          {filters.category !== 'all' ? (
            <ActiveFilterChip
              label={labelFor(filters.category, CATEGORY_OPTIONS)}
              onRemove={() => onUpdate({ category: 'all' })}
            />
          ) : null}
          {filters.jobType !== 'all' ? (
            <ActiveFilterChip
              label={labelFor(filters.jobType, JOB_TYPE_OPTIONS)}
              onRemove={() => onUpdate({ jobType: 'all' })}
            />
          ) : null}
          {filters.freshness !== 'all' ? (
            <ActiveFilterChip
              label={labelFor(filters.freshness, FRESHNESS_OPTIONS)}
              onRemove={() => onUpdate({ freshness: 'all' })}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
