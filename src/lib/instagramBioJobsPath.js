import { SITE_URL } from './site.js';

/** Public Instagram / social bio landing — featured “latest openings” list. */
export const INSTAGRAM_BIO_JOBS_PATH = '/jobs/latest';

/** Former short bio path; keep redirecting so existing Link-in-bio URLs still work. */
export const LEGACY_INSTAGRAM_BIO_JOBS_PATH = '/ig';

/** Host + path for captions and admin toasts, e.g. jobsinvizag.in/jobs/latest */
export const getInstagramBioJobsDisplayUrl = () => {
  const host = String(SITE_URL || 'https://jobsinvizag.in')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  return `${host}${INSTAGRAM_BIO_JOBS_PATH}`;
};
