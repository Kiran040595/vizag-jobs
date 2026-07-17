import {
  formatRelativePostedAt,
  shouldHighlightPostedTime,
} from '../lib/jobFreshness';
import { useSavedJob } from '../lib/useSavedJob';
import FullJobDetailsLink from './FullJobDetailsLink';

const BookmarkIcon = ({ filled = false }) => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
  </svg>
);

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
}) => {
  const relativePostedAt = formatRelativePostedAt(postedAt);
  const highlightPostedTime = shouldHighlightPostedTime(postedAt);
  const { saved, toggle } = useSavedJob(jobId, jobSnapshot);

  return (
    <article
      className={`group relative flex h-full flex-col rounded-2xl border bg-white p-3.5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg sm:p-4 ${
        isFeatured
          ? 'border-cyan-300 hover:border-cyan-400'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        className={`absolute right-3 top-3 z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 sm:right-4 sm:top-4 ${
          saved
            ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
            : 'border-transparent text-slate-400 hover:border-slate-200 hover:bg-slate-100 hover:text-blue-600'
        }`}
        aria-label={saved ? `Remove ${jobTitle} from saved jobs` : `Save ${jobTitle}`}
        aria-pressed={saved}
        title={saved ? 'Saved — click to remove' : 'Save job'}
      >
        <BookmarkIcon filled={saved} />
      </button>

      <div className="mb-3 min-w-0 pr-11 sm:pr-12">
        {isFeatured ? (
          <span className="mb-1.5 inline-flex rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-800">
            Featured
          </span>
        ) : null}
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
