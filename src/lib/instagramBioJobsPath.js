import { SITE_URL } from './site.js';

/** Public Instagram / social bio landing — featured “latest openings” list. */
export const INSTAGRAM_BIO_JOBS_PATH = '/apply';

/** Former short bio paths; keep redirecting so existing Link-in-bio URLs still work. */
export const LEGACY_INSTAGRAM_BIO_JOBS_PATH = '/ig';
export const LEGACY_INSTAGRAM_LATEST_PATH = '/jobs/latest';

/** Host + path for captions and admin toasts, e.g. jobsinvizag.in/apply */
export const getInstagramBioJobsDisplayUrl = () => {
  const host = String(SITE_URL || 'https://jobsinvizag.in')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  return `${host}${INSTAGRAM_BIO_JOBS_PATH}`;
};
