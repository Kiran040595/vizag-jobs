import test from 'node:test';
import assert from 'node:assert/strict';

import {
  acceptAllCookies,
  acceptEssentialCookiesOnly,
  COOKIE_CONSENT_STORAGE_KEY,
  hasAdvertisingConsent,
  hasAnalyticsConsent,
  hasCookieConsentDecision,
  parseCookieConsent,
  readCookieConsent,
  writeCookieConsent,
} from '../src/lib/cookieConsent.js';

const createMemoryStorage = () => {
  /** @type {Map<string, string>} */
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
};

test('parseCookieConsent requires a decidedAt timestamp', () => {
  assert.equal(parseCookieConsent(null), null);
  assert.equal(parseCookieConsent({ analytics: true }), null);
  assert.deepEqual(parseCookieConsent({ analytics: true, advertising: false, decidedAt: '2026-07-03T00:00:00.000Z' }), {
    essential: true,
    analytics: true,
    advertising: false,
    decidedAt: '2026-07-03T00:00:00.000Z',
  });
});

test('writeCookieConsent persists and readCookieConsent restores preferences', () => {
  const storage = createMemoryStorage();
  const originalWindow = globalThis.window;

  globalThis.window = /** @type {any} */ ({ localStorage: storage });

  try {
    writeCookieConsent({ analytics: true, advertising: true });
    const stored = readCookieConsent();

    assert.ok(hasCookieConsentDecision(stored));
    assert.equal(hasAnalyticsConsent(stored), true);
    assert.equal(hasAdvertisingConsent(stored), true);
    assert.ok(storage.getItem(COOKIE_CONSENT_STORAGE_KEY));
  } finally {
    globalThis.window = originalWindow;
  }
});

test('acceptEssentialCookiesOnly disables optional categories', () => {
  const storage = createMemoryStorage();
  const originalWindow = globalThis.window;

  globalThis.window = /** @type {any} */ ({ localStorage: storage });

  try {
    acceptAllCookies();
    acceptEssentialCookiesOnly();
    const stored = readCookieConsent();

    assert.equal(hasAnalyticsConsent(stored), false);
    assert.equal(hasAdvertisingConsent(stored), false);
    assert.ok(hasCookieConsentDecision(stored));
  } finally {
    globalThis.window = originalWindow;
  }
});
