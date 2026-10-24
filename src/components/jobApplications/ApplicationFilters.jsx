import {
  ALL_APPLICATION_STATUSES,
  APPLICATION_STATUS_FILTER_OPTIONS,
  QUALIFICATION_CATEGORIES,
} from '../../lib/applicationFilters.js';

const selectClassName =
  'min-h-11 w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100';

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 text-slate-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export default function ApplicationFilters({
  searchQuery = '',
  onSearchChange,
  status = ALL_APPLICATION_STATUSES,
  onStatusChange,
  qualification = 'all',
  onQualificationChange,
  passoutYear = 'all',
  onPassoutYearChange,
  skill = 'all',
  onSkillChange,
  isStarredOnly = false,
  onStarredToggle,
  sortBy = 'newest',
  onSortChange,
  filteredCount = 0,
  totalCount = 0,
  onClear,
  availableYears = [],
  topSkills = [],
  starredCount = 0,
}) {
  const isFiltered =
    Boolean(searchQuery.trim()) ||
    status !== ALL_APPLICATION_STATUSES ||
    qualification !== 'all' ||
    passoutYear !== 'all' ||
    skill !== 'all' ||
    isStarredOnly ||
    sortBy !== 'newest';

  return (
    <div className="mb-6 space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {/* Search Input Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search candidate name, skills, college, phone, email..."
            aria-label="Search applicants"
            className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-10 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100 sm:text-sm"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              className="absolute inset-y-0 right-1 flex min-w-11 items-center justify-center text-xs font-bold text-slate-400 hover:text-slate-700"
              aria-label="Clear search text"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* Starred / Referred Quick Toggle */}
        <button
          type="button"
          onClick={() => onStarredToggle?.(!isStarredOnly)}
          className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold transition ${
            isStarredOnly
              ? 'border border-amber-400 bg-amber-500 text-white shadow-xs'
              : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
          }`}
          title={isStarredOnly ? 'Currently showing only Starred candidates. Click to show all.' : 'Filter for candidates starred or referred by Admin'}
        >
          <span>⭐</span>
          <span>{isStarredOnly ? 'Showing Starred Only' : 'Starred'} {starredCount > 0 ? `(${starredCount})` : ''}</span>
          {isStarredOnly ? <span className="ml-1 text-[11px] font-black underline">✕</span> : null}
        </button>
      </div>

      {/* Dropdown Filters Row */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
        {/* Status Filter */}
        <div>
          <label htmlFor="filter-app-status" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Status
          </label>
          <select
            id="filter-app-status"
            value={status}
            onChange={(e) => onStatusChange?.(e.target.value)}
            className={selectClassName}
          >
            {APPLICATION_STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Qualification Filter */}
        <div>
          <label htmlFor="filter-app-qualification" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Qualification
          </label>
          <select
            id="filter-app-qualification"
            value={qualification}
            onChange={(e) => onQualificationChange?.(e.target.value)}
            className={selectClassName}
          >
            {QUALIFICATION_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Passout Year Filter */}
        <div>
          <label htmlFor="filter-app-passout" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Passout Year
          </label>
          <select
            id="filter-app-passout"
            value={passoutYear}
            onChange={(e) => onPassoutYearChange?.(e.target.value)}
            className={selectClassName}
          >
            <option value="all">All Passout Years</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                Class of {yr}
              </option>
            ))}
          </select>
        </div>

        {/* Skill Filter */}
        <div>
          <label htmlFor="filter-app-skill" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Skill
          </label>
          <select
            id="filter-app-skill"
            value={skill}
            onChange={(e) => onSkillChange?.(e.target.value)}
            className={selectClassName}
          >
            <option value="all">All Skills</option>
            {topSkills.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label} ({s.count})
              </option>
            ))}
          </select>
        </div>

        {/* Sort By */}
        <div>
          <label htmlFor="filter-app-sort" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Sort By
          </label>
          <select
            id="filter-app-sort"
            value={sortBy}
            onChange={(e) => onSortChange?.(e.target.value)}
            className={selectClassName}
          >
            <option value="newest">Newest applied first</option>
            <option value="oldest">Earliest applied (Early register)</option>
            <option value="starred_first">⭐ Starred first</option>
            <option value="name_asc">Name (A–Z)</option>
            <option value="has_resume">Has resume first</option>
          </select>
        </div>
      </div>

      {/* Active Filter Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Showing <span className="font-black text-slate-950">{filteredCount}</span> of{' '}
            <span className="font-black text-slate-950">{totalCount}</span> application{totalCount === 1 ? '' : 's'}
            {isFiltered ? <span className="ml-1 text-cyan-800 font-bold">(filtered)</span> : null}
          </span>
          {isStarredOnly ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-300">
              ⭐ Starred only
            </span>
          ) : null}
        </div>

        {isFiltered ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-11 items-center font-bold text-cyan-700 hover:text-cyan-800 hover:underline"
          >
            Clear all filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
