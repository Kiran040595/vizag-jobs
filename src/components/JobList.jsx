import { Link } from 'react-router-dom';
import JobCard from './JobCard';
import { getJobDetailPath } from '../lib/jobRoutes';
import { stripMarkdownForPlainText } from '../lib/jobDescriptionDisplay';
import {
  buildCardHighlightItems,
  cardCompanyName,
} from '../lib/jobCardDisplay';
import { resolveJobExperienceForDisplay } from '../lib/jobRecordInference';
import { getDirectPostingBadge } from '../lib/jobDirectPosting';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { jobApplicationCount, shouldShowAdminApplicantCount } from '../lib/jobApplicationCount';

/**
 * Pure presentational list. The parent owns filtering/pagination and passes
 * the page's slice of jobs in via `jobs`. `total` is the unfiltered total
 * across all pages — used for the "showing N of M" hint and for deciding
 * whether to render the "Reset filters" CTA in the empty state.
 */
const JobList = ({
  jobs,
  total,
  title = 'Recent Job Openings',
  subtitle = '',
  emptyState = null,
  onResetFilters,
  headerRef,
  isLoading = false,
}) => {
  const { isAdmin } = useAdminAuth();
  const jobsToShow = Array.isArray(jobs) ? jobs : [];
  const totalCount = typeof total === 'number' ? total : jobsToShow.length;

  if (jobsToShow.length === 0 && isLoading) {
    return (
      <section
        ref={headerRef}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        aria-busy="true"
      >
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Loading recent jobs…</h2>
        <p className="mt-2 text-sm text-slate-600">
          Fetching the latest openings in Visakhapatnam.
        </p>
      </section>
    );
  }

  if (jobsToShow.length === 0) {
    if (emptyState) {
      return (
        <section
          ref={headerRef}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          {emptyState}
        </section>
      );
    }

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
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 sm:text-2xl">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-slate-600 sm:text-sm">{subtitle}</p> : null}
        </div>
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

          const hasMatchMeta = Boolean(
            job._eligibility || (Array.isArray(job._matchReasons) && job._matchReasons.length > 0),
          );

          const cardElement = (
            <JobCard
              jobId={job.id}
              job={job}
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
              directBadge={getDirectPostingBadge(job)}
              applicationCount={jobApplicationCount(job)}
              showApplicantCount={shouldShowAdminApplicantCount(job, isAdmin)}
            />
          );

          if (!hasMatchMeta) {
            return (
              <div key={job.id} className="h-full">
                {cardElement}
              </div>
            );
          }

          return (
            <div key={job.id} className="flex h-full flex-col gap-2">
              {job._eligibility?.status === 'needs_information' ? (
                <Link to="/student/profile" className="text-xs text-amber-800 hover:underline">
                  Complete profile to check: {job._eligibility.missing.join(', ')}
                </Link>
              ) : null}
              {job._eligibility?.status === 'unverified' ? (
                <p className="text-xs text-slate-500">Eligibility not verified</p>
              ) : null}
              {job._eligibility?.status === 'eligible' ? (
                <p className="text-xs font-medium text-emerald-700">Meets listed requirements</p>
              ) : null}
              {Array.isArray(job._matchReasons) && job._matchReasons.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {job._matchReasons.slice(0, 3).map((reason) => (
                    <span
                      key={`${job.id}-${reason}`}
                      className="rounded-full border border-cyan-200 bg-cyan-50/70 px-2 py-0.5 text-[11px] font-semibold text-cyan-800"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              ) : null}
              {cardElement}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default JobList;
