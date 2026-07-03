/** @typedef {{ essential: true, analytics: boolean, advertising: boolean, decidedAt: string | null }} CookieConsent */

export const COOKIE_CONSENT_STORAGE_KEY = 'vizag_cookie_consent_v1';

/** @type {Set<() => void>} */
const listeners = new Set();

/** @type {{ raw: string | null | undefined, value: CookieConsent | null | undefined }} */
const snapshotCache = {
  raw: undefined,
  value: undefined,
};

const getStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const readStoredRaw = () => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
};

const updateSnapshotCache = (raw) => {
  snapshotCache.raw = raw;

  if (!raw) {
    snapshotCache.value = null;
    return null;
  }

  try {
    snapshotCache.value = parseCookieConsent(JSON.parse(raw));
    return snapshotCache.value;
  } catch {
    snapshotCache.value = null;
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

/**
 * Read consent for useSyncExternalStore. Returns a stable object reference until
 * localStorage changes — a fresh object on every read causes infinite re-renders.
 * @returns {CookieConsent | null}
 */
export const readCookieConsent = () => {
  const raw = readStoredRaw();

  if (snapshotCache.raw === raw) {
    return snapshotCache.value ?? null;
  }

  return updateSnapshotCache(raw);
};

/** @param {Partial<Pick<CookieConsent, 'analytics' | 'advertising'>> & { decidedAt?: string }} values */
export const writeCookieConsent = (values) => {
  const consent = {
    essential: true,
    analytics: Boolean(values.analytics),
    advertising: Boolean(values.advertising),
    decidedAt: values.decidedAt || new Date().toISOString(),
  };

  const serialized = JSON.stringify(consent);
  const storage = getStorage();

  if (storage) {
    try {
      storage.setItem(COOKIE_CONSENT_STORAGE_KEY, serialized);
    } catch {
      // Ignore quota / private mode errors.
    }
  }

  snapshotCache.raw = serialized;
  snapshotCache.value = consent;

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

/** Test helper — reset module cache between tests. */
export const resetCookieConsentCacheForTests = () => {
  snapshotCache.raw = undefined;
  snapshotCache.value = undefined;
};
