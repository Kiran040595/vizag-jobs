import { Link } from 'react-router-dom';
import { resolveJobSourceAttribution } from '../lib/jobSourceAttribution';
import { buildListingReportPath } from '../lib/listingReport';

export default function JobSourceAttribution({ job, jobPath }) {
  const attribution = resolveJobSourceAttribution(job);
  const reportPath = buildListingReportPath({
    jobTitle: job?.title,
    jobId: job?.id,
    jobPath,
  });

  return (
    <div className="mt-5 space-y-2">
      {attribution ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Source:</span>{' '}
          Originally listed on{' '}
          {attribution.href ? (
            <a
              href={attribution.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cyan-700 hover:text-cyan-800"
            >
              {attribution.label}
            </a>
          ) : (
            <span className="font-semibold text-slate-800">{attribution.label}</span>
          )}
          . {job?.applyLink ? 'Use Apply Now above to visit the employer or original listing.' : null}
        </p>
      ) : null}
      <p className="text-sm text-slate-500">
        Think this listing is a scam, outdated, or infringing?{' '}
        <Link to={reportPath} className="font-semibold text-cyan-700 hover:text-cyan-800">
          Report this listing
        </Link>
        .
      </p>
    </div>
  );
}
