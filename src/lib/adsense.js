/**
 * Google AdSense config. Set VITE_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXX in env
 * (and Vercel) after you create / are approved for AdSense.
 */

const viteEnv = import.meta.env || {};
const DEFAULT_ADSENSE_CLIENT_ID = 'ca-pub-5930737756240618';
const rawClientId = String(
  viteEnv.VITE_ADSENSE_CLIENT_ID || DEFAULT_ADSENSE_CLIENT_ID,
).trim();

/** @returns {string} e.g. ca-pub-123… or '' when unset */
export const getAdSenseClientId = () => {
  if (!/^ca-pub-\d+$/i.test(rawClientId)) {
    return '';
  }
  return rawClientId;
};

export const isAdSenseConfigured = () => Boolean(getAdSenseClientId());

/** True only after the visitor accepts advertising cookies. */
export const shouldLoadAdSenseScript = (advertisingEnabled) =>
  isAdSenseConfigured() && Boolean(advertisingEnabled);

/** ads.txt line for this publisher (Google AdSense). */
export const buildAdsTxtLine = (clientId = getAdSenseClientId()) => {
  if (!clientId) return '';
  const pubId = clientId.replace(/^ca-pub-/i, '');
  return `google.com, pub-${pubId}, DIRECT, f08c47fec0942fa0`;
};
