import { track } from '@vercel/analytics';
import { hasAnalyticsConsent, readCookieConsent } from './cookieConsent';

const canTrack = () => hasAnalyticsConsent(readCookieConsent());

export const trackStudentFunnel = (eventName, data = {}) => {
  if (!canTrack()) {
    return;
  }

  try {
    track(eventName, data);
  } catch {
    // Ignore analytics failures.
  }
};
