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
