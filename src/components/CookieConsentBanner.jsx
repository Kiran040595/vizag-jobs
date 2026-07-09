import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { useCookieConsent } from '../context/CookieConsentContext.jsx';

export default function CookieConsentBanner() {
  const {
    isBannerOpen,
    hasDecision,
    consent,
    acceptAll,
    acceptEssentialOnly,
    savePreferences,
    closeSettings,
  } = useCookieConsent();

  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    if (!isBannerOpen) {
      return;
    }

    setAnalytics(Boolean(consent?.analytics));
    setAdvertising(Boolean(consent?.advertising));
    setShowDetails(hasDecision);
  }, [consent?.advertising, consent?.analytics, hasDecision, isBannerOpen]);

  if (!isBannerOpen) {
    return null;
  }

  const handleSave = () => {
    savePreferences({ analytics, advertising });
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white/95 p-4 shadow-[0_-12px_40px_rgba(15,23,42,0.12)] backdrop-blur sm:p-5"
      role="dialog"
      aria-modal={showDetails && hasDecision ? 'true' : 'false'}
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <h2 id="cookie-consent-title" className="text-base font-bold text-slate-900 sm:text-lg">
              Cookie preferences
            </h2>
            <p id="cookie-consent-description" className="mt-2 text-sm leading-6 text-slate-600">
              We use essential cookies to run the site (for example, saved jobs in your browser). With your
              permission, we also use analytics cookies and advertising cookies for services such as Vercel
              Analytics and Google AdSense. Read our{' '}
              <Link to="/privacy-policy" className="font-semibold text-cyan-700 hover:text-cyan-800">
                Privacy Policy
              </Link>{' '}
              for details.
            </p>
          </div>

          {!showDetails ? (
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              <button
                type="button"
                onClick={() => setShowDetails(true)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Manage
              </button>
              <button
                type="button"
                onClick={acceptEssentialOnly}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Essential only
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Accept all
              </button>
            </div>
          ) : null}
        </div>

        {showDetails ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <ul className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <p className="font-semibold text-slate-900">Essential</p>
                  <p className="mt-1 text-slate-600">Required for core features such as saved jobs and site security.</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Always on
                </span>
              </li>

              <li className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <label htmlFor="cookie-analytics" className="font-semibold text-slate-900">
                    Analytics
                  </label>
                  <p className="mt-1 text-slate-600">Helps us understand traffic with anonymous page-view analytics.</p>
                </div>
                <input
                  id="cookie-analytics"
                  type="checkbox"
                  checked={analytics}
                  onChange={(event) => setAnalytics(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </li>

              <li className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <label htmlFor="cookie-advertising" className="font-semibold text-slate-900">
                    Advertising
                  </label>
                  <p className="mt-1 text-slate-600">
                    Allows personalized ads through Google AdSense and related partners.
                  </p>
                </div>
                <input
                  id="cookie-advertising"
                  type="checkbox"
                  checked={advertising}
                  onChange={(event) => setAdvertising(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </li>
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Save preferences
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Accept all
              </button>
              {hasDecision ? (
                <button
                  type="button"
                  onClick={closeSettings}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Close
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
