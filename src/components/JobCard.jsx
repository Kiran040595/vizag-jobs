import { Link } from 'react-router-dom';
import {
  formatRelativePostedAt,
  shouldHighlightPostedTime,
} from '../lib/jobFreshness';
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
}) => {
  const relativePostedAt = formatRelativePostedAt(postedAt);
  const highlightPostedTime = shouldHighlightPostedTime(postedAt);
  const snapshot = jobSnapshot;

  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg sm:p-4">
      <SaveJobButton jobId={jobId} jobSnapshot={snapshot} jobTitle={jobTitle} variant="card" />

      <div className="mb-3 min-w-0 pr-11 sm:pr-12">
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
        <Link
          to={jobPath}
          className="block w-full rounded-xl bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        >
          Full Job Details
        </Link>
      </div>
    </article>
  );
};

export default JobCard;
