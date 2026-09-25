import { Link } from 'react-router-dom';
import { BROWSE_CATEGORY_LINKS } from '../lib/jobCategoryTaxonomy';

export default function JobCategoryBrowse() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Browse by field</p>
        <p className="mt-1 text-sm text-slate-600">
          Find jobs by branch or role — IT, civil, mechanical, banking, BPO, fresher, and more.
        </p>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500 sm:hidden">Swipe to browse categories</p>
      <div className="mobile-chip-scroll mt-2 sm:mt-4 sm:flex-wrap sm:overflow-visible">
        {BROWSE_CATEGORY_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800 sm:px-3 sm:py-1.5 sm:text-xs"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
