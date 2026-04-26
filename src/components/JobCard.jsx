import { Link } from 'react-router-dom';

const JobCard = ({
  jobId,
  companyLogo,
  jobTitle,
  companyName,
  location,
  experience,
  salary,
  description,
  tags = []
}) => {
  const fallbackLogoText = companyName
    ? companyName
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    : 'JB';

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg sm:p-4">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-12 sm:w-12">
            {companyLogo ? (
              <img src={companyLogo} alt={`${companyName} logo`} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-slate-600">{fallbackLogoText}</span>
            )}
          </div>
          <div>
            <h3 className="text-[15px] font-bold leading-snug text-slate-900 sm:text-base">{jobTitle}</h3>
            <p className="text-xs text-slate-600 sm:text-sm">{companyName}</p>
          </div>
        </div>

        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600 sm:p-2"
          aria-label={`Bookmark ${jobTitle}`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
          </svg>
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 sm:text-sm">
        <span>{location}</span>
        <span className="text-slate-300">|</span>
        <span>{experience}</span>
        {salary ? (
          <>
            <span className="text-slate-300">|</span>
            <span>{salary}</span>
          </>
        ) : null}
      </div>

      {description ? (
        <p className="mb-3 line-clamp-2 text-xs text-slate-600 sm:text-sm">{description}</p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-1.5 sm:gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 sm:px-2.5 sm:text-xs"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto">
        <Link
          to={`/jobs/${jobId}`}
          className="block w-full rounded-xl bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        >
          Full Job Details
        </Link>
      </div>
    </article>
  );
};

export default JobCard;