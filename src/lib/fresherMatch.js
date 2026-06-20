const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, ' ');

/** DB / processed job flag (`is_fresher` column or processed `isFresher` "Yes"/"No"). */
export function isFresherFlagSet(job = {}) {
  const raw = job.isFresher ?? job.is_fresher;
  if (raw === true) {
    return true;
  }
  const v = normalize(raw);
  return v === 'yes' || v === 'true' || v === 't' || v === '1';
}

/**
 * Experience column contains zero years of experience.
 * Uses the digit `0` but avoids matching "10 years", "20 years", etc.
 */
export function experienceContainsZero(experience) {
  const text = String(experience ?? '').trim();
  if (!text.includes('0')) {
    return false;
  }
  return /\b0\b/.test(text) || text.startsWith('0');
}

/**
 * Fresher filter (UI category + /jobs/fresher):
 * - `is_fresher` flag is true, OR
 * - `experience` column contains 0 (zero-year roles).
 */
export function isPublicFresherListingJob(job = {}) {
  return isFresherFlagSet(job) || experienceContainsZero(job.experience);
}
