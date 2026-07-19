/**
 * Google AdSense config. Set VITE_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXX in env
 * (and Vercel) after you create / are approved for AdSense.
 */

const rawClientId = String(import.meta.env.VITE_ADSENSE_CLIENT_ID || '').trim();

/** @returns {string} e.g. ca-pub-123… or '' when unset */
export const getAdSenseClientId = () => {
  if (!/^ca-pub-\d+$/i.test(rawClientId)) {
    return '';
  }
  return rawClientId;
};

export const isAdSenseConfigured = () => Boolean(getAdSenseClientId());

/** ads.txt line for this publisher (Google AdSense). */
export const buildAdsTxtLine = (clientId = getAdSenseClientId()) => {
  if (!clientId) return '';
  const pubId = clientId.replace(/^ca-pub-/i, '');
  return `google.com, pub-${pubId}, DIRECT, f08c47fec0942fa0`;
};
