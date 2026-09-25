import { Link } from 'react-router-dom';
import { BROWSE_CATEGORY_LINKS } from '../lib/jobCategoryTaxonomy';

export default function JobCategoryBrowse() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Browse by field</p>
        <p className="mt-1 text-sm text-slate-600">
          Find jobs by branch or role — IT, civil, mechanical, banking, BPO, fresher, and more.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {BROWSE_CATEGORY_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
