import {
  formatRelativePostedAt,
  shouldHighlightPostedTime,
} from '../lib/jobFreshness';
import FullJobDetailsLink from './FullJobDetailsLink';
import FeaturedBadge from './FeaturedBadge';
import SaveJobButton from './SaveJobButton';

const JobCard = ({
  jobId,
  jobSnapshot,
  jobPath,
  jobTitle,
  companyName,
  highlightItems = [],
  description,
  postedAt,
  isFeatured = false,
  directBadge = null,
}) => {
  const relativePostedAt = formatRelativePostedAt(postedAt);
  const highlightPostedTime = shouldHighlightPostedTime(postedAt);

  return (
    <article
      className={`group relative flex h-full flex-col rounded-2xl border bg-white p-3.5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg sm:p-4 ${
        isFeatured
          ? 'border-cyan-300 hover:border-cyan-400'
          : directBadge
            ? 'border-emerald-200 hover:border-emerald-300 ring-1 ring-emerald-100/50'
            : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <SaveJobButton jobId={jobId} jobSnapshot={jobSnapshot} jobTitle={jobTitle} variant="card" />

      <div className="mb-3 min-w-0 pr-11 sm:pr-12">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          {directBadge ? (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                directBadge.tone === 'emerald'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                  : directBadge.tone === 'cyan'
                    ? 'border border-cyan-200 bg-cyan-50 text-cyan-800'
                    : 'border border-indigo-200 bg-indigo-50 text-indigo-800'
              }`}
            >
              <span>{directBadge.icon}</span>
              <span>{directBadge.label}</span>
            </span>
          ) : null}
          {isFeatured ? <FeaturedBadge /> : null}
        </div>
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-slate-900 sm:text-base">
          {jobTitle}
        </h3>
        {companyName ? (
          <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-600 sm:text-sm">{companyName}</p>
        ) : null}
      </div>

      {highlightItems.length > 0 ? (
        <ul className="mb-3 space-y-1 text-xs text-slate-600 sm:text-sm">
          {highlightItems.map(({ key, label, value }) => (
            <li key={key} className="leading-snug">
              <span className="font-medium text-slate-800">{label}:</span> {value}
            </li>
          ))}
        </ul>
      ) : null}

      {relativePostedAt ? (
        <p
          className={`mb-2 text-xs sm:text-sm ${
            highlightPostedTime ? 'font-semibold text-red-600' : 'text-slate-500'
          }`}
        >
          Posted {relativePostedAt}
        </p>
      ) : null}

      {description ? (
        <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-slate-600 sm:text-sm">{description}</p>
      ) : null}

      <div className="mt-auto">
        <FullJobDetailsLink jobPath={jobPath} />
      </div>
    </article>
  );
};

export default JobCard;
