/**
 * Admin-only home-page source filters.
 *
 * Jobs do not store `source_kind` in the database, so we infer the filter bucket
 * from source_name, source_url, apply_link, and created_by — matching how admin
 * external-fetch channels are labeled in the dashboard.
 */

export const ADMIN_SOURCE_OPTIONS = [
  { id: 'all', label: 'All sources' },
  { id: 'naukri', label: 'Naukri' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'linkedin_jobs', label: 'LinkedIn Jobs' },
  { id: 'linkedin_posts', label: 'LinkedIn Posts' },
  { id: 'indeed', label: 'Indeed' },
  { id: 'admin', label: 'Admin posted' },
  { id: 'employer', label: 'Employer posted' },
];

const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const jobUrls = (job) =>
  [job?.sourceUrl, job?.source_url, job?.applyLink, job?.apply_link]
    .map(normalize)
    .filter(Boolean);

const isLinkedInJobListingUrl = (url) =>
  url.includes('linkedin.com/jobs/') || url.includes('/jobs/view');

const isLinkedInPostUrl = (url) =>
  url.includes('linkedin.com/posts/') ||
  url.includes('linkedin.com/feed/update') ||
  url.includes('linkedin.com/search/results/content') ||
  url.includes('/pulse/');

const inferLinkedInKind = (job) => {
  const urls = jobUrls(job);
  if (urls.some(isLinkedInJobListingUrl)) {
    return 'linkedin_jobs';
  }
  if (urls.some(isLinkedInPostUrl)) {
    return 'linkedin_posts';
  }
  // Ambiguous linkedin.com rows default to posts (feed/search scrapes).
  return 'linkedin_posts';
};

/**
 * Resolve the admin source bucket for a public job row.
 *
 * @returns {'naukri' | 'linkedin_jobs' | 'linkedin_posts' | 'indeed' | 'admin' | 'employer'}
 */
export const inferJobAdminSourceId = (job) => {
  if (job?.createdBy || job?.created_by) {
    return 'employer';
  }

  const sourceName = normalize(job?.source ?? job?.source_name);
  const urls = jobUrls(job);
  const blob = [sourceName, ...urls].join(' ');

  if (blob.includes('naukri')) {
    return 'naukri';
  }

  if (blob.includes('indeed')) {
    return 'indeed';
  }

  if (blob.includes('linkedin')) {
    return inferLinkedInKind(job);
  }

  return 'admin';
};

export const matchesAdminSourceFilter = (job, sourceId) => {
  if (!sourceId || sourceId === 'all') {
    return true;
  }

  const bucket = inferJobAdminSourceId(job);

  if (sourceId === 'linkedin') {
    return bucket === 'linkedin_jobs' || bucket === 'linkedin_posts';
  }

  return bucket === sourceId;
};
