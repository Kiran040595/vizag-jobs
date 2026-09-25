import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';

import { getAdSenseClientId, isAdSenseConfigured } from '../lib/adsense.js';
import { useOptionalCookieConsent } from '../context/CookieConsentContext.jsx';

const ADSENSE_SCRIPT_ID = 'vizag-adsense-script';

/**
 * Loads the AdSense loader when a publisher id is configured.
 * The script is available for site verification; display units should still
 * respect advertising consent (see AdSenseUnit).
 */
export default function ConditionalAdSense() {
  const client = getAdSenseClientId();
  const consent = useOptionalCookieConsent();
  const advertisingEnabled = consent?.advertisingEnabled ?? false;

  useEffect(() => {
    if (!client || typeof window === 'undefined') return undefined;

    window.adsbygoogle = window.adsbygoogle || [];
    // Hint non-personalized until the user accepts advertising cookies.
    window.adsbygoogle.requestNonPersonalizedAds = advertisingEnabled ? 0 : 1;

    return undefined;
  }, [client, advertisingEnabled]);

  if (!isAdSenseConfigured()) {
    return null;
  }

  return (
    <Helmet>
      <script
        id={ADSENSE_SCRIPT_ID}
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
        crossOrigin="anonymous"
      />
    </Helmet>
  );
}
