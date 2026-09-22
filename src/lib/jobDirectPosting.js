/**
 * Pure helpers for identifying, filtering, and badging direct job postings
 * (jobs posted directly by registered employers or admin) vs external
 * aggregator scrapes (Naukri, LinkedIn, Indeed, etc.).
 */

import { inferJobAdminSourceId } from './jobSourceFilter.js';

const KNOWN_AGGREGATOR_PATTERNS = [
  'naukri',
  'linkedin',
  'indeed',
  'glassdoor',
  'shine.com',
  'foundit',
  'monsterindia',
  'timesjobs',
];

const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const jobUrls = (job) =>
  [job?.sourceUrl, job?.source_url, job?.applyLink, job?.apply_link]
    .map(normalize)
    .filter(Boolean);

/**
 * Check whether a job originates from an external job aggregator/board.
 *
 * @param {object} job
 * @returns {boolean}
 */
export const isExternalAggregatorJob = (job) => {
  if (!job) return false;

  const sourceName = normalize(job.source ?? job.source_name);
  const urls = jobUrls(job);
  const blob = [sourceName, ...urls].join(' ');

  return KNOWN_AGGREGATOR_PATTERNS.some((pattern) => blob.includes(pattern));
};

/**
 * True when the job was posted directly by an authenticated employer/company.
 *
 * @param {object} job
 * @returns {boolean}
 */
export const isEmployerPosting = (job) =>
  Boolean(job?.createdBy || job?.created_by);

/**
 * True when the candidate applies directly through the Vizag Jobs portal.
 *
 * @param {object} job
 * @returns {boolean}
 */
export const isInternalApplyPosting = (job) =>
  job?.applyMode === 'internal' || job?.apply_mode === 'internal';

/**
 * Check whether a job is a direct company or admin posting.
 *
 * A job is direct if:
 * 1. It was posted by a registered employer (createdBy).
 * 2. OR it supports direct internal application on the portal.
 * 3. OR its source is inferred as admin/direct and NOT an external aggregator.
 *
 * @param {object} job
 * @returns {boolean}
 */
export const isDirectPosting = (job) => {
  if (!job) return false;

  if (isEmployerPosting(job)) {
    return true;
  }

  if (isInternalApplyPosting(job)) {
    return true;
  }

  if (isExternalAggregatorJob(job)) {
    return false;
  }

  const sourceName = (job.source ?? job.source_name ?? '').trim();
  if (!sourceName) {
    return false;
  }

  const bucket = inferJobAdminSourceId(job);
  return bucket === 'admin' || bucket === 'employer';
};

/**
 * Get display badge configuration for direct company / admin jobs.
 *
 * @param {object} job
 * @returns {{ label: string, icon: string, tone: 'emerald' | 'cyan' | 'indigo' } | null}
 */
export const getDirectPostingBadge = (job) => {
  if (!isDirectPosting(job)) {
    return null;
  }

  if (isEmployerPosting(job)) {
    return {
      label: 'Direct Employer',
      icon: '🏢',
      tone: 'emerald',
    };
  }

  if (isInternalApplyPosting(job)) {
    return {
      label: 'Easy Apply on Vizag Jobs',
      icon: '⚡',
      tone: 'cyan',
    };
  }

  return {
    label: 'Verified Direct',
    icon: '🛡️',
    tone: 'indigo',
  };
};

/**
 * Count the number of direct postings in a list of jobs.
 *
 * @param {object[]} jobs
 * @returns {number}
 */
export const countDirectJobs = (jobs) => {
  if (!Array.isArray(jobs) || jobs.length === 0) return 0;
  return jobs.filter(isDirectPosting).length;
};
