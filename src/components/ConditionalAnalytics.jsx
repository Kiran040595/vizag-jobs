import { Analytics } from '@vercel/analytics/react';

import { useOptionalCookieConsent } from '../context/CookieConsentContext.jsx';

export default function ConditionalAnalytics() {
  const consentContext = useOptionalCookieConsent();
  const enabled = consentContext?.analyticsEnabled ?? false;

  if (!enabled) {
    return null;
  }

  return <Analytics />;
}
