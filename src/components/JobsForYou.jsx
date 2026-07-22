import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import JobCard from './JobCard';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { getJobDetailPath } from '../lib/jobRoutes';
import { stripMarkdownForPlainText } from '../lib/jobDescriptionDisplay';
import { buildCardHighlightItems, cardCompanyName } from '../lib/jobCardDisplay';
import { resolveJobExperienceForDisplay } from '../lib/jobRecordInference';
import { JOBS_FOR_YOU_LIMIT, rankJobsForStudent } from '../lib/studentJobMatch';

/**
 * Personalized job suggestions for signed-in students with a complete profile.
 * Guests and incomplete profiles see nothing (public filters stay unchanged).
 */
export default function JobsForYou({ jobs = [] }) {
  const { isStudent, profile, profileComplete, session } = useStudentAuth();

  const ranked = useMemo(() => {
    if (!session || !isStudent || !profileComplete || !profile) {
      return [];
    }
    return rankJobsForStudent(jobs, profile, JOBS_FOR_YOU_LIMIT);
  }, [isStudent, jobs, profile, profileComplete, session]);

  if (ranked.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50/80 via-white to-slate-50 p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">For you</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Jobs matching your profile</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ranked from your skills, target roles, and preferred locations.
          </p>
        </div>
        <Link
          to="/student/profile"
          className="text-sm font-semibold text-cyan-700 hover:text-cyan-800"
        >
          Update preferences
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ranked.map(({ job, reasons }) => {
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
            <div key={job.id} className="flex h-full flex-col gap-2">
              {reasons.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {reasons.slice(0, 3).map((reason) => (
                    <span
                      key={`${job.id}-${reason}`}
                      className="rounded-full border border-cyan-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-cyan-800"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              ) : null}
              <JobCard
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
