/** Default Instagram channel for daily Vizag job updates (Link in bio / external apply). */
export const DEFAULT_INSTAGRAM_CHANNEL_URL =
  'https://www.instagram.com/channel/Abb3Uh4CEdmuzv6D/';

export const normalizeGroupLink = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

/** Custom group link for a job, if admin set one. */
export const getJobGroupLink = (job = {}) =>
  normalizeGroupLink(job.groupLink || job.group_link || '');

/** Instagram channel shown before external apply (always the daily updates channel). */
export const getDailyUpdatesChannelUrl = () => DEFAULT_INSTAGRAM_CHANNEL_URL;

const EXTERNAL_APPLY_PROMPT_KEY = 'vizagjobs:external-apply-prompt';

export const stashExternalApplyPrompt = ({ applyUrl, channelUrl, jobTitle } = {}) => {
  if (!applyUrl) {
    return;
  }
  try {
    sessionStorage.setItem(
      EXTERNAL_APPLY_PROMPT_KEY,
      JSON.stringify({
        applyUrl,
        channelUrl: channelUrl || DEFAULT_INSTAGRAM_CHANNEL_URL,
        jobTitle: jobTitle || '',
      }),
    );
    window.dispatchEvent(new Event('vizagjobs:external-apply-prompt'));
  } catch {
    window.open(applyUrl, '_blank', 'noopener,noreferrer');
  }
};

export const consumeExternalApplyPrompt = () => {
  try {
    const raw = sessionStorage.getItem(EXTERNAL_APPLY_PROMPT_KEY);
    sessionStorage.removeItem(EXTERNAL_APPLY_PROMPT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.applyUrl) {
      return null;
    }
    return {
      applyUrl: parsed.applyUrl,
      channelUrl: parsed.channelUrl || DEFAULT_INSTAGRAM_CHANNEL_URL,
      jobTitle: parsed.jobTitle || '',
    };
  } catch {
    return null;
  }
};

export const subscribeExternalApplyPrompt = (listener) => {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = () => listener();
  window.addEventListener('vizagjobs:external-apply-prompt', handler);
  return () => window.removeEventListener('vizagjobs:external-apply-prompt', handler);
};
