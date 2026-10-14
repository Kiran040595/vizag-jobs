import { buildPaginationItems } from '../lib/jobFilters';

/**
 * Reusable pagination control.
 *
 * Props:
 * - page: current 1-based page
 * - totalPages: total number of pages (>= 1)
 * - onPageChange(nextPage): called with a clamped, valid page number
 * - className: optional wrapper class
 *
 * The component is self-contained: it never goes out of bounds, exposes
 * sensible aria attributes, and renders nothing when there is only one page.
 */
export default function Pagination({ page, totalPages, onPageChange, className = '' }) {
  if (!Number.isFinite(totalPages) || totalPages <= 1) {
    return null;
  }

  const safePage = Math.min(Math.max(1, page), totalPages);
  const items = buildPaginationItems(safePage, totalPages);
  const goto = (next) => {
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (clamped !== safePage) {
      onPageChange(clamped);
    }
  };

  const baseBtn =
    'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40';
  const inactiveBtn =
    'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700';
  const activeBtn = 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700';

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={`flex flex-wrap items-center justify-center gap-2 ${className}`}
    >
      <button
        type="button"
        onClick={() => goto(safePage - 1)}
        disabled={safePage <= 1}
        className={`${baseBtn} ${inactiveBtn}`}
        aria-label="Previous page"
      >
        <span aria-hidden="true">&larr;</span>
        <span className="ml-1 hidden sm:inline">Prev</span>
      </button>

      <span className="min-w-0 text-center text-sm font-semibold text-slate-700 sm:hidden" aria-live="polite" aria-atomic="true">
        Page {safePage} of {totalPages}
      </span>
      <ul className="hidden flex-wrap items-center justify-center gap-1.5 sm:flex">
        {items.map((item, idx) =>
          item === '…' ? (
            <li key={`ellipsis-${idx}`} aria-hidden="true" className="px-1 text-slate-400">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                onClick={() => goto(item)}
                aria-label={`Go to page ${item}`}
                aria-current={item === safePage ? 'page' : undefined}
                className={`${baseBtn} ${item === safePage ? activeBtn : inactiveBtn}`}
              >
                {item}
              </button>
            </li>
          ),
        )}
      </ul>

      <button
        type="button"
        onClick={() => goto(safePage + 1)}
        disabled={safePage >= totalPages}
        className={`${baseBtn} ${inactiveBtn}`}
        aria-label="Next page"
      >
        <span className="mr-1 hidden sm:inline">Next</span>
        <span aria-hidden="true">&rarr;</span>
      </button>
    </nav>
  );
}
