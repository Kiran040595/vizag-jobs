import { useMemo } from 'react';
import JobCard from './JobCard';
import { useCachedPublicJobs } from '../lib/useCachedPublicJobs';
import { getJobCategorySegment, getJobDetailPath } from '../lib/jobRoutes';
import { stripMarkdownForPlainText } from '../lib/jobDescriptionDisplay';
import { buildCardHighlightItems, buildJobSaveSnapshot, cardCompanyName } from '../lib/jobCardDisplay';
import { resolveJobExperienceForDisplay } from '../lib/jobRecordInference';

const MAX_SIMILAR_JOBS = 6;

const toSkillSet = (skills) =>
  new Set(
    String(skills || '')
      .split(',')
      .map((skill) => skill.trim().toLowerCase())
      .filter(Boolean),
  );

const normalize = (value) => String(value || '').trim().toLowerCase();

/**
 * Score how similar `candidate` is to `job`. Higher is more similar.
 * Weighted so that a shared coarse category segment dominates, with skill
 * overlap and other shared facets acting as tie-breakers.
 */
const scoreSimilarity = (job, candidate, baseSegment, baseSkills) => {
  let score = 0;

  if (getJobCategorySegment(candidate) === baseSegment) score += 5;

  if (normalize(candidate.category) && normalize(candidate.category) === normalize(job.category)) {
    score += 3;
  }

  const candidateSkills = toSkillSet(candidate.skills);
  let overlap = 0;
  baseSkills.forEach((skill) => {
    if (candidateSkills.has(skill)) overlap += 1;
  });
  score += overlap * 2;

  if (normalize(candidate.jobType) && normalize(candidate.jobType) === normalize(job.jobType)) {
    score += 2;
  }

  if (normalize(candidate.isFresher) === normalize(job.isFresher)) score += 1;

  if (normalize(candidate.company) && normalize(candidate.company) === normalize(job.company)) {
    score += 1;
  }

  if (normalize(candidate.location) && normalize(candidate.location) === normalize(job.location)) {
    score += 1;
  }

  return score;
};

/**
 * "Similar Jobs" block for the job detail page. Ranks the already-cached
 * public job list against the current job and shows the closest matches.
 * Renders nothing until at least one relevant match is found.
 */
export default function SimilarJobs({ job }) {
  const { allJobs } = useCachedPublicJobs();

  const similarJobs = useMemo(() => {
    if (!job || !Array.isArray(allJobs) || allJobs.length === 0) return [];

    const baseSegment = getJobCategorySegment(job);
    const baseSkills = toSkillSet(job.skills);

    return allJobs
      .filter((candidate) => candidate && candidate.id !== job.id)
      .map((candidate) => ({
        job: candidate,
        score: scoreSimilarity(job, candidate, baseSegment, baseSkills),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SIMILAR_JOBS)
      .map((entry) => entry.job);
  }, [allJobs, job]);

  if (similarJobs.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-4 sm:mb-5">
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Similar Jobs</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {similarJobs.map((similar) => {
          const company = cardCompanyName(similar.company);
          const highlightItems = buildCardHighlightItems({
            category: similar.category,
            jobType: similar.jobType,
            experience: resolveJobExperienceForDisplay(similar),
            isFresher: similar.isFresher,
            salary: similar.salary,
            workMode: similar.workMode,
          });

          return (
            <JobCard
              key={similar.id}
              jobId={similar.id}
              jobSnapshot={buildJobSaveSnapshot(similar)}
              jobPath={getJobDetailPath(similar)}
              jobTitle={similar.title}
              companyName={company}
              highlightItems={highlightItems}
              description={
                similar.shortDescription ||
                stripMarkdownForPlainText(similar.description, 160)
              }
              postedAt={similar.postedAt}
            />
          );
        })}
      </div>
    </section>
  );
}
