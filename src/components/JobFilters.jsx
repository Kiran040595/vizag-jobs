import { useState } from 'react';
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
      className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition sm:px-3 sm:py-1.5 sm:text-xs ${
        isOn ? PILL_ON_COLOR[color] : PILL_OFF
      }`}
    >
      {label}
    </button>
  );
}

function ActiveFilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="rounded-full p-1 text-blue-700 transition hover:bg-blue-200 hover:text-blue-900"
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

function PillRow({ children, label }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mobile-chip-scroll sm:flex sm:flex-wrap sm:overflow-visible">
        {children}
      </div>
    </div>
  );
}

const labelFor = (id, options) => options.find((o) => o.id === id)?.label ?? id;

/**
 * Inline filter bar shown above the job list. The hero already owns the
 * search input + category select; this component adds the secondary filters
 * (job type, freshness) and surfaces removable chips for active filters so
 * the user can always see — and undo — what's applied.
 *
 * On mobile the full pill grids collapse behind a "Filters" toggle so the
 * job list stays above the fold.
 */
export default function JobFilters({
  filters,
  onUpdate,
  onClearAll,
  resultCount,
  isRefreshing = false,
}) {
  const active = isAnyFilterActive(filters);
  // Start collapsed on mobile so jobs stay above the fold; user can expand.
  // Active filter chips remain visible even when collapsed.
  const [expanded, setExpanded] = useState(false);

  const activeChips = (
    <>
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
    </>
  );

  const filterPanels = (
    <div className="grid gap-4 sm:gap-5">
      <PillRow label="Category / field">
        {CATEGORY_OPTIONS.map((opt) => (
          <FilterPill
            key={opt.id}
            id={opt.id}
            label={opt.label}
            current={filters.category}
            onSelect={(next) => onUpdate({ category: next })}
          />
        ))}
      </PillRow>

      <PillRow label="Job type">
        {JOB_TYPE_OPTIONS.map((opt) => (
          <FilterPill
            key={opt.id}
            id={opt.id}
            label={opt.label}
            current={filters.jobType}
            onSelect={(next) => onUpdate({ jobType: next })}
          />
        ))}
      </PillRow>

      <PillRow label="Posted">
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
      </PillRow>
    </div>
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
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

        <div className="flex flex-wrap items-center gap-2">
          {active ? (
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            >
              Clear all
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 sm:hidden"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Hide filters' : 'Show filters'}
            <svg
              className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-180' : ''}`}
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
        </div>
      </div>

      {active ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:hidden">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Active:
          </span>
          {activeChips}
        </div>
      ) : null}

      <div className={`mt-4 ${expanded ? 'block' : 'hidden'} sm:block`}>
        {filterPanels}
      </div>

      {active ? (
        <div className="mt-4 hidden flex-wrap items-center gap-2 border-t border-slate-100 pt-3 sm:flex">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Active:
          </span>
          {activeChips}
        </div>
      ) : null}
    </section>
  );
}
