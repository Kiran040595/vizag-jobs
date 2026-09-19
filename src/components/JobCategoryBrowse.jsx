import { Link } from 'react-router-dom';
import { BROWSE_CATEGORY_LINKS } from '../lib/jobCategoryTaxonomy';

export default function JobCategoryBrowse() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Browse by field</p>
          <p className="mt-1 text-sm text-slate-600 lg:text-base">
            Jump to popular Vizag job categories — IT, civil, mechanical, banking, fresher, and more.
          </p>
        </div>
        <Link
          to="/jobs"
          className="hidden text-sm font-semibold text-cyan-700 transition hover:text-cyan-800 lg:inline"
        >
          View all jobs →
        </Link>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500 sm:hidden">Swipe to browse categories</p>
      <div className="mobile-chip-scroll mt-2 sm:mt-4 sm:flex-wrap sm:gap-2.5 sm:overflow-visible lg:mt-5">
        {BROWSE_CATEGORY_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800 sm:px-3.5 sm:py-2 sm:text-sm"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
