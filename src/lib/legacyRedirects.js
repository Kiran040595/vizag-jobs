import { JOB_CATEGORY_PAGES } from './jobCategoryPages.js';
import {
  INSTAGRAM_BIO_JOBS_PATH,
  LEGACY_INSTAGRAM_BIO_JOBS_PATH,
} from './instagramBioJobsPath.js';

/** Legacy marketing URLs mapped to canonical listing routes. */
export const LEGACY_ROUTE_REDIRECTS = {
  '/jobs-in-vizag': '/jobs',
  '/it-jobs-in-vizag': '/jobs/it',
  '/fresher-jobs-in-vizag': '/jobs/fresher',
  '/part-time-jobs-vizag': '/jobs/part-time',
  [LEGACY_INSTAGRAM_BIO_JOBS_PATH]: INSTAGRAM_BIO_JOBS_PATH,
  ...Object.fromEntries(JOB_CATEGORY_PAGES.map((page) => [page.legacyPath, page.path])),
};

/** Shape used by vercel.json redirect rules. */
export const LEGACY_VERCEL_REDIRECTS = Object.entries(LEGACY_ROUTE_REDIRECTS).map(
  ([source, destination]) => ({
    source,
    destination,
    permanent: true,
  }),
);
