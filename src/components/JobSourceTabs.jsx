import { memo } from 'react';

/**
 * Tab switcher component displayed above the job list on the homepage.
 * Allows candidates to toggle between:
 * - "All Openings" (combined feed from all sources)
 * - "Direct Company & Admin" (exclusive jobs posted directly by local employers or admins)
 */
function JobSourceTabs({
  activeTab = 'all',
  onTabChange,
  totalCount = 0,
  directCount = 0,
}) {
  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label="Filter job listings by source type"
        className="flex w-full items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1.5 shadow-inner sm:w-auto sm:inline-flex"
      >
        {/* Tab 1: All Openings */}
        <button
          type="button"
          role="tab"
          id="tab-all-jobs"
          aria-selected={activeTab === 'all'}
          aria-controls="job-list-section"
          onClick={() => onTabChange('all')}
          className={`group flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 sm:flex-initial sm:px-5 sm:py-2.5 ${
            activeTab === 'all'
              ? 'bg-white text-slate-900 shadow-sm shadow-slate-300/40 ring-1 ring-slate-950/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <svg
              className={`h-4 w-4 transition-colors ${
                activeTab === 'all' ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            </svg>
            <span>All Openings</span>
          </span>
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold transition-colors ${
              activeTab === 'all'
                ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                : 'bg-slate-200/70 text-slate-600'
            }`}
          >
            {totalCount}
          </span>
        </button>

        {/* Tab 2: Direct Company & Admin */}
        <button
          type="button"
          role="tab"
          id="tab-direct-jobs"
          aria-selected={activeTab === 'direct'}
          aria-controls="job-list-section"
          onClick={() => onTabChange('direct')}
          className={`group relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 sm:flex-initial sm:px-5 sm:py-2.5 ${
            activeTab === 'direct'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-700/20'
              : 'text-slate-700 hover:text-emerald-800 hover:bg-emerald-50/60'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <svg
              className={`h-4 w-4 transition-colors ${
                activeTab === 'direct' ? 'text-white' : 'text-emerald-600'
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
                clipRule="evenodd"
              />
            </svg>
            <span className="whitespace-nowrap">Direct Company Jobs</span>
          </span>

          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold transition-colors ${
              activeTab === 'direct'
                ? 'bg-white text-emerald-800'
                : 'bg-emerald-100/80 text-emerald-800'
            }`}
          >
            {directCount}
          </span>

          {activeTab !== 'direct' && directCount > 0 ? (
            <span className="hidden rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 sm:inline-block">
              Verified
            </span>
          ) : null}
        </button>
      </div>

      {/* Helpful banner when viewing Direct tab */}
      {activeTab === 'direct' ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 text-xs text-emerald-800 shadow-sm sm:text-sm">
          <span className="text-base">🏢</span>
          <p>
            <strong className="font-semibold">Direct Openings:</strong> Jobs posted directly by
            local Visakhapatnam employers and verified by admin. No external redirects.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default memo(JobSourceTabs);
