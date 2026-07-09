import { resolveJobSourceAttribution } from '../lib/jobSourceAttribution';

export default function JobSourceAttribution({ job }) {
  const attribution = resolveJobSourceAttribution(job);

  if (!attribution) {
    return null;
  }

  return (
    <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
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
  );
}
