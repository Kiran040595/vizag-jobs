import { isDirectPosting } from './jobDirectPosting.js';
import { isJobExpired } from './jobPostingSchema.js';

/** Aggregated external jobs older than this many days are hidden from the public site. */
export const JOB_DISPLAY_MAX_AGE_DAYS = 30;

/** Direct company & admin jobs stay visible for 180 days unless explicitly expired. */
export const DIRECT_JOB_DISPLAY_MAX_AGE_DAYS = 180;

/** Minimum `posted_at` (inclusive) for jobs shown on the site and sitemap. */
export const getMinPostedAtIsoForPublicDisplay = (days = JOB_DISPLAY_MAX_AGE_DAYS) => {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
};

/**
 * Check whether a job falls within the public display window.
 * Direct company & admin jobs stay visible up to 180 days unless expired.
 * External aggregator jobs stay visible for 30 days.
 *
 * @param {object} job
 * @returns {boolean}
 */
export const isJobWithinPublicDisplayWindow = (job) => {
  if (!job) return false;
  if (isJobExpired(job)) return false;

  const isDirect = isDirectPosting(job);
  const maxDays = isDirect ? DIRECT_JOB_DISPLAY_MAX_AGE_DAYS : JOB_DISPLAY_MAX_AGE_DAYS;
  const postedAt = job.postedAt ?? job.posted_at;
  if (!postedAt) return false;

  const ms = maxDays * 24 * 60 * 60 * 1000;
  return new Date(postedAt).getTime() >= Date.now() - ms;
};

/** @param {string | null | undefined} postedAtIso */
export const isPostedAtWithinPublicDisplayWindow = (postedAtIso) => {
  if (!postedAtIso) return false;
  return new Date(postedAtIso).getTime() >= new Date(getMinPostedAtIsoForPublicDisplay()).getTime();
};

/** @param {Array<object>} jobs */
export const filterProcessedJobsForPublicDisplay = (jobs) => {
  if (!Array.isArray(jobs)) return [];
  return jobs.filter((job) => isJobWithinPublicDisplayWindow(job));
};
