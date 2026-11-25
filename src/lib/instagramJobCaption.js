import { getJobDetailPath } from './jobRoutes.js';
import { toAbsoluteUrl } from './site.js';
import { displayCompanyName, displayLocation } from './jobDisplayLabels.js';
import { getInstagramBioJobsDisplayUrl } from './instagramBioJobsPath.js';

/** Absolute public job URL for sharing (clean link, no tracking params). */
export const buildJobShareUrl = (job = {}) => toAbsoluteUrl(getJobDetailPath(job));

/**
 * Ready-to-paste Instagram reel caption.
 * Captions often cannot have clickable links — point people to Link in bio (/jobs/latest).
 */
export const buildInstagramJobCaption = (job = {}) => {
  const title = String(job.title || 'Job opening').trim();
  const company = displayCompanyName(job.company);
  const location = displayLocation(job.location);

  return [
    `Hiring: ${title} at ${company}`,
    `Location: ${location}`,
    '',
    'Apply from Link in bio 👆',
    getInstagramBioJobsDisplayUrl(),
  ].join('\n');
};

export const copyInstagramJobCaption = async (job) => {
  const caption = buildInstagramJobCaption(job);
  await navigator.clipboard.writeText(caption);
  return caption;
};
