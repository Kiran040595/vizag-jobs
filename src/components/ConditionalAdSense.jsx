import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';

import { getAdSenseClientId, shouldLoadAdSenseScript } from '../lib/adsense.js';
import { useOptionalCookieConsent } from '../context/CookieConsentContext.jsx';

const ADSENSE_SCRIPT_ID = 'vizag-adsense-script';

/**
 * Loads the AdSense JS only after the visitor accepts advertising cookies.
 * Site verification uses the google-adsense-account meta tag instead.
 */
export default function ConditionalAdSense() {
  const client = getAdSenseClientId();
  const consent = useOptionalCookieConsent();
  const advertisingEnabled = consent?.advertisingEnabled ?? false;
  const loadScript = shouldLoadAdSenseScript(advertisingEnabled);

  useEffect(() => {
    if (!client || typeof window === 'undefined') return undefined;

    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.requestNonPersonalizedAds = advertisingEnabled ? 0 : 1;

    return undefined;
  }, [client, advertisingEnabled]);

  if (!loadScript) {
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
