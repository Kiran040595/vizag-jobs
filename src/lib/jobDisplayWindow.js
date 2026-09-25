/** Published jobs older than this many days are hidden from the public site. */
export const JOB_DISPLAY_MAX_AGE_DAYS = 30;

/** Minimum `posted_at` (inclusive) for jobs shown on the site and sitemap. */
export const getMinPostedAtIsoForPublicDisplay = () => {
  const ms = JOB_DISPLAY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
};

/** @param {string | null | undefined} postedAtIso */
export const isPostedAtWithinPublicDisplayWindow = (postedAtIso) => {
  if (!postedAtIso) return false;
  return new Date(postedAtIso).getTime() >= new Date(getMinPostedAtIsoForPublicDisplay()).getTime();
};

/** @param {Array<{ postedAt?: string }>} jobs */
export const filterProcessedJobsForPublicDisplay = (jobs) =>
  jobs.filter((job) => isPostedAtWithinPublicDisplayWindow(job.postedAt));
