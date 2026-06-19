/**
 * Check if a job is fresh (posted within 3-4 days)
 * @param {string} postedAtDate - ISO date string
 * @param {number} days - Number of days to consider as fresh (default: 4)
 * @returns {boolean}
 */
export const isJobFresh = (postedAtDate, days = 4) => {
  if (!postedAtDate) return false;
  
  const jobDate = new Date(postedAtDate);
  const currentDate = new Date();
  const timeDifference = currentDate - jobDate;
  const daysDifference = timeDifference / (1000 * 60 * 60 * 24);
  
  return daysDifference <= days && daysDifference >= 0;
};

/**
 * Check if a job was posted within the last day (24 hours).
 * @param {string} postedAtDate - ISO date string
 * @returns {boolean}
 */
export const isPostedWithinLastDay = (postedAtDate) => {
  if (!postedAtDate) return false;

  const timestamp = Date.parse(postedAtDate);
  if (!Number.isFinite(timestamp)) return false;

  const ageMs = Date.now() - timestamp;
  return ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1000;
};

/**
 * Check if a job was posted about one day ago (24-48 hours).
 * @param {string} postedAtDate - ISO date string
 * @returns {boolean}
 */
export const isPostedOneDayAgo = (postedAtDate) => {
  if (!postedAtDate) return false;

  const timestamp = Date.parse(postedAtDate);
  if (!Number.isFinite(timestamp)) return false;

  const ageMs = Date.now() - timestamp;
  const oneDayMs = 24 * 60 * 60 * 1000;
  return ageMs > oneDayMs && ageMs <= 2 * oneDayMs;
};

/**
 * Format a posted date as relative text (e.g. "a day ago").
 * @param {string} postedAtDate - ISO date string
 * @returns {string}
 */
export const formatRelativePostedAt = (postedAtDate) => {
  if (!postedAtDate) return '';

  const timestamp = Date.parse(postedAtDate);
  if (!Number.isFinite(timestamp)) return '';

  const diffSec = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;

  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return 'a day ago';

  return `${diffDay} days ago`;
};

/**
 * Whether a job should show red relative posted text.
 * @param {string} postedAtDate - ISO date string
 * @returns {boolean}
 */
export const shouldHighlightPostedTime = (postedAtDate) =>
  isPostedWithinLastDay(postedAtDate) || isPostedOneDayAgo(postedAtDate);
