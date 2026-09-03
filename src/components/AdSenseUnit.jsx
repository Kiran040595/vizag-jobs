import { useEffect, useRef } from 'react';

import { getAdSenseClientId, isAdSenseConfigured } from '../lib/adsense.js';
import { useOptionalCookieConsent } from '../context/CookieConsentContext.jsx';

/**
 * Renders a display ad unit only when AdSense is configured and advertising
 * cookies were accepted. Pass your AdSense slot id after approval.
 *
 * @param {{ slot: string, format?: string, responsive?: boolean, className?: string }} props
 */
export default function AdSenseUnit({
  slot,
  format = 'auto',
  responsive = true,
  className = '',
}) {
  const pushedRef = useRef(false);
  const consent = useOptionalCookieConsent();
  const advertisingEnabled = consent?.advertisingEnabled ?? false;
  const client = getAdSenseClientId();

  useEffect(() => {
    if (!client || !slot || !advertisingEnabled || pushedRef.current) return undefined;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch (error) {
      console.warn('AdSense unit push failed:', error);
    }
    return undefined;
  }, [advertisingEnabled, client, slot]);

  if (!isAdSenseConfigured() || !slot || !advertisingEnabled) {
    return null;
  }

  return (
    <div className={className} data-adsense-unit={slot}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  );
}
