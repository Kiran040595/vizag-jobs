import { useCallback, useContext, useMemo, useState, useSyncExternalStore } from 'react';

import {
  acceptAllCookies,
  acceptEssentialCookiesOnly,
  hasAnalyticsConsent,
  hasAdvertisingConsent,
  hasCookieConsentDecision,
  readCookieConsent,
  subscribeCookieConsent,
  writeCookieConsent,
} from '../lib/cookieConsent.js';
import { CookieConsentContext } from './cookieConsentContext.js';

const serverSnapshot = null;

/**
 * @typedef {{
 *   consent: import('../lib/cookieConsent.js').CookieConsent | null,
 *   hasDecision: boolean,
 *   isBannerOpen: boolean,
 *   analyticsEnabled: boolean,
 *   advertisingEnabled: boolean,
 *   acceptAll: () => void,
 *   acceptEssentialOnly: () => void,
 *   savePreferences: (preferences: { analytics: boolean, advertising: boolean }) => void,
 *   openSettings: () => void,
 *   closeSettings: () => void,
 * }} CookieConsentContextValue
 */

export function CookieConsentProvider({ children }) {
  const consent = useSyncExternalStore(
    subscribeCookieConsent,
    readCookieConsent,
    () => serverSnapshot,
  );

  const hasDecision = hasCookieConsentDecision(consent);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const acceptAll = useCallback(() => {
    acceptAllCookies();
    setSettingsOpen(false);
  }, []);

  const acceptEssentialOnly = useCallback(() => {
    acceptEssentialCookiesOnly();
    setSettingsOpen(false);
  }, []);

  const savePreferences = useCallback(({ analytics, advertising }) => {
    writeCookieConsent({ analytics, advertising });
    setSettingsOpen(false);
  }, []);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    if (hasCookieConsentDecision(readCookieConsent())) {
      setSettingsOpen(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      consent,
      hasDecision,
      isBannerOpen: !hasDecision || settingsOpen,
      analyticsEnabled: hasAnalyticsConsent(consent),
      advertisingEnabled: hasAdvertisingConsent(consent),
      acceptAll,
      acceptEssentialOnly,
      savePreferences,
      openSettings,
      closeSettings,
    }),
    [
      acceptAll,
      acceptEssentialOnly,
      closeSettings,
      consent,
      hasDecision,
      openSettings,
      savePreferences,
      settingsOpen,
    ],
  );

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider.');
  }
  return context;
}

export function useOptionalCookieConsent() {
  return useContext(CookieConsentContext);
}
