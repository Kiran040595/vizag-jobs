import { isInternalApplyJob } from './jobApplyMode.js';

export const normalizeApplicationCount = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
};

export const jobOnPlatformApplicationCount = (job) =>
  normalizeApplicationCount(job?.applicationCount ?? job?.application_count);

export const jobApplyClickCount = (job) =>
  normalizeApplicationCount(job?.applyClickCount ?? job?.apply_click_count);

/** On-platform applications + unique external apply redirects. */
export const jobApplicationCount = (job) =>
  jobOnPlatformApplicationCount(job) + jobApplyClickCount(job);

export const resolveOnPlatformApplicationCount = (job, countsById = {}) => {
  if (job?.id != null && countsById[job.id] != null) {
    return normalizeApplicationCount(countsById[job.id]);
  }
  return jobOnPlatformApplicationCount(job);
};

export const resolveJobApplicationCount = (job, countsById = {}) =>
  resolveOnPlatformApplicationCount(job, countsById) + jobApplyClickCount(job);

/** Applicant and unique-click totals are admin-only. */
export const shouldShowAdminApplicantCount = (job, isAdmin = false) => {
  if (!isAdmin) {
    return false;
  }
  return (
    jobApplicationCount(job) > 0 || isInternalApplyJob(job) || job?.apply_mode === 'internal'
  );
};

export const summarizeApplyClickCounts = (jobs = []) => {
  let uniqueClicks = 0;
  let jobsWithClicks = 0;
  const list = Array.isArray(jobs) ? jobs : [];
  for (const job of list) {
    const n = jobApplyClickCount(job);
    uniqueClicks += n;
    if (n > 0) jobsWithClicks += 1;
  }
  return {
    jobCount: list.length,
    uniqueClicks,
    jobsWithClicks,
  };
};

export const formatApplicantCountLabel = (count) => {
  const n = normalizeApplicationCount(count);
  if (n === 1) return '1 applied';
  return `${n} applied`;
};

export const formatApplicationCountNoun = (count) => {
  const n = normalizeApplicationCount(count);
  return n === 1 ? '1 application' : `${n} applications`;
};

export const formatUniqueApplyClickNoun = (count) => {
  const n = normalizeApplicationCount(count);
  return n === 1 ? '1 unique apply click' : `${n} unique apply clicks`;
};
