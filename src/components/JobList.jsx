import JobCard from './JobCard';
import { getJobDetailPath } from '../lib/jobRoutes';
import { stripMarkdownForPlainText } from '../lib/jobDescriptionDisplay';
import {
  buildCardHighlightItems,
  cardCompanyName,
} from '../lib/jobCardDisplay';
import { resolveJobExperienceForDisplay } from '../lib/jobRecordInference';

/**
 * Pure presentational list. The parent owns filtering/pagination and passes
 * the page's slice of jobs in via `jobs`. `total` is the unfiltered total
 * across all pages — used for the "showing N of M" hint and for deciding
 * whether to render the "Reset filters" CTA in the empty state.
 */
const JobList = ({ jobs, total, onResetFilters, headerRef }) => {
  const jobsToShow = Array.isArray(jobs) ? jobs : [];
  const totalCount = typeof total === 'number' ? total : jobsToShow.length;

  if (jobsToShow.length === 0) {
    return (
      <section
        ref={headerRef}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">No jobs match your filters</h2>
        <p className="mt-2 text-sm text-slate-600">
          Try a different keyword, broaden your category, or remove a filter.
        </p>
        {onResetFilters ? (
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-4 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          >
            Reset all filters
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section
      ref={headerRef}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="mb-3 flex items-end justify-between gap-3 sm:mb-5">
        <h2 className="text-lg font-bold text-slate-900 sm:text-2xl">Recent Job Openings</h2>
        <p className="shrink-0 text-xs font-semibold text-slate-500">
          {jobsToShow.length} of {totalCount}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {jobsToShow.map((job) => {
          const company = cardCompanyName(job.company);
          const highlightItems = buildCardHighlightItems({
            category: job.category,
            jobType: job.jobType,
            experience: resolveJobExperienceForDisplay(job),
            isFresher: job.isFresher,
            salary: job.salary,
            workMode: job.workMode,
          });

          return (
          <JobCard
            key={job.id}
            jobId={job.id}
            jobSnapshot={{
              id: job.id,
              slug: job.slug,
              title: job.title,
              company: company || '',
              location: '',
              jobPath: getJobDetailPath(job),
            }}
            jobPath={getJobDetailPath(job)}
            jobTitle={job.title}
            companyName={company}
            highlightItems={highlightItems}
            description={
              job.shortDescription || stripMarkdownForPlainText(job.description, 160)
            }
            postedAt={job.postedAt}
            isFeatured={Boolean(job.isFeatured)}
          />
          );
        })}
      </div>
    </section>
  );
};

export default JobList;
