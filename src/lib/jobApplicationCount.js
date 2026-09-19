import { isInternalApplyJob } from './jobApplyMode.js';

export const normalizeApplicationCount = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
};

export const jobApplicationCount = (job) =>
  normalizeApplicationCount(job?.applicationCount ?? job?.application_count);

export const resolveJobApplicationCount = (job, countsById = {}) => {
  if (job?.id != null && countsById[job.id] != null) {
    return normalizeApplicationCount(countsById[job.id]);
  }
  return jobApplicationCount(job);
};

/** Show on public cards/details for on-platform jobs, or any job that already has applicants. */
export const shouldShowPublicApplicantCount = (job) =>
  jobApplicationCount(job) > 0 ||
  isInternalApplyJob(job) ||
  job?.apply_mode === 'internal';

export const formatApplicantCountLabel = (count) => {
  const n = normalizeApplicationCount(count);
  if (n === 1) return '1 applied';
  return `${n} applied`;
};

export const formatApplicationCountNoun = (count) => {
  const n = normalizeApplicationCount(count);
  return n === 1 ? '1 application' : `${n} applications`;
};
