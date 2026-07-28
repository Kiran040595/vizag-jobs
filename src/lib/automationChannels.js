/** @typedef {'naukri' | 'linkedin_jobs' | 'linkedin_posts'} AutomationChannel */

export const AUTOMATION_CHANNELS = {
  naukri: {
    id: 'naukri',
    label: 'Naukri',
    fetchHint: '2 Apify scrapes (fresher + roles, ~90s wait), then SEO + publish',
  },
  linkedin_jobs: {
    id: 'linkedin_jobs',
    label: 'LinkedIn Jobs',
    fetchHint: 'Apify jobs scraper, then SEO + publish',
  },
  linkedin_posts: {
    id: 'linkedin_posts',
    label: 'LinkedIn Posts',
    fetchHint: 'Hiring post search (preset), then SEO + publish',
  },
};

/** @param {AutomationChannel} channel */
export function getAutomationChannelMeta(channel) {
  return AUTOMATION_CHANNELS[channel] || { id: channel, label: channel, fetchHint: '' };
}

/** @param {AutomationChannel} channel */
export function buildAutomationConfirmMessage(channel, seoGapMs) {
  const meta = getAutomationChannelMeta(channel);
  const gapMin = Math.round(seoGapMs / 60_000);
  let fetchStep = '1. Fetch listings from the source';
  if (channel === 'naukri') {
    fetchStep = '1. Fetch Naukri jobs via Apify (fresher + roles, ~90s wait)';
  } else if (channel === 'linkedin_jobs') {
    fetchStep = '1. Fetch LinkedIn Jobs listings (Apify)';
  } else if (channel === 'linkedin_posts') {
    fetchStep = '1. Fetch LinkedIn hiring posts for the selected preset';
  }

  return (
    `Start ${meta.label} automation?\n\n` +
    `This will:\n` +
    `${fetchStep}\n` +
    `2. Run Make SEO on each new job (${gapMin} min between jobs)\n` +
    `3. Auto-publish jobs with a valid apply link (not already in the database)\n\n` +
    'Keep this tab open until finished. You can cancel anytime.'
  );
}
