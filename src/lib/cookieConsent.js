/** @typedef {{ essential: true, analytics: boolean, advertising: boolean, decidedAt: string | null }} CookieConsent */

export const COOKIE_CONSENT_STORAGE_KEY = 'vizag_cookie_consent_v1';

/** @type {Set<() => void>} */
const listeners = new Set();

const getStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** @returns {CookieConsent | null} */
export const parseCookieConsent = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const decidedAt = typeof raw.decidedAt === 'string' && raw.decidedAt.trim() ? raw.decidedAt.trim() : null;
  if (!decidedAt) {
    return null;
  }

  return {
    essential: true,
    analytics: Boolean(raw.analytics),
    advertising: Boolean(raw.advertising),
    decidedAt,
  };
};

/** @returns {CookieConsent | null} */
export const readCookieConsent = () => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return parseCookieConsent(JSON.parse(raw));
  } catch {
    return null;
  }
};

/** @param {Partial<Pick<CookieConsent, 'analytics' | 'advertising'>> & { decidedAt?: string }} values */
export const writeCookieConsent = (values) => {
  const consent = {
    essential: true,
    analytics: Boolean(values.analytics),
    advertising: Boolean(values.advertising),
    decidedAt: values.decidedAt || new Date().toISOString(),
  };

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent));
    } catch {
      // Ignore quota / private mode errors.
    }
  }

  for (const listener of listeners) {
    listener();
  }

  return consent;
};

export const acceptAllCookies = () =>
  writeCookieConsent({
    analytics: true,
    advertising: true,
  });

export const acceptEssentialCookiesOnly = () =>
  writeCookieConsent({
    analytics: false,
    advertising: false,
  });

/** @param {() => void} listener */
export const subscribeCookieConsent = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** @param {CookieConsent | null | undefined} consent */
export const hasCookieConsentDecision = (consent) => Boolean(consent?.decidedAt);

/** @param {CookieConsent | null | undefined} consent */
export const hasAnalyticsConsent = (consent) => Boolean(consent?.analytics);

/** @param {CookieConsent | null | undefined} consent */
export const hasAdvertisingConsent = (consent) => Boolean(consent?.advertising);
