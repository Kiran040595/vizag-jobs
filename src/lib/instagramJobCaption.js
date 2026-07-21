import { getJobDetailPath } from './jobRoutes';
import { toAbsoluteUrl } from './site';
import { displayCompanyName, displayLocation } from './jobDisplayLabels';

/** Absolute public job URL for sharing (clean link, no tracking params). */
export const buildJobShareUrl = (job = {}) => toAbsoluteUrl(getJobDetailPath(job));

/**
 * Ready-to-paste Instagram reel caption with the direct apply link.
 * Paste into the reel caption so candidates apply without joining a group.
 */
export const buildInstagramJobCaption = (job = {}) => {
  const title = String(job.title || 'Job opening').trim();
  const company = displayCompanyName(job.company);
  const location = displayLocation(job.location);
  const url = buildJobShareUrl(job);

  return [
    `Hiring: ${title} at ${company}`,
    `Location: ${location}`,
    '',
    'Apply here (free):',
    url,
    '',
    'Sign in or register on Vizag Jobs to apply.',
  ].join('\n');
};

export const copyInstagramJobCaption = async (job) => {
  const caption = buildInstagramJobCaption(job);
  await navigator.clipboard.writeText(caption);
  return caption;
};
