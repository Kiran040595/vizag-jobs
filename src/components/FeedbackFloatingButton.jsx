import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import SiteFeedbackForm from './SiteFeedbackForm';
import { useOptionalCookieConsent } from '../context/CookieConsentContext.jsx';

const HIDDEN_PREFIXES = ['/admin', '/employer', '/oauth'];

export default function FeedbackFloatingButton() {
  const location = useLocation();
  const cookieConsent = useOptionalCookieConsent();
  const [isOpen, setIsOpen] = useState(false);

  const isHidden = HIDDEN_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));
  const cookieBannerOpen = Boolean(cookieConsent?.isBannerOpen);
  const isJobDetailPage =
    /^\/jobs\/[^/]+\/[^/]+/.test(location.pathname) ||
    /^\/job\/[^/]+/.test(location.pathname) ||
    /^\/jobs\/[^/]+$/.test(location.pathname);

  // Listing pages like /jobs/it should keep the default feedback position.
  const isCategoryListing =
    /^\/jobs\/(it|fresher|part-time|civil|mechanical|electrical|ece|engineering)$/.test(
      location.pathname,
    );
  const hasStickyApplyChrome = isJobDetailPage && !isCategoryListing && location.pathname !== '/jobs';

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  if (isHidden) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`fixed z-40 rounded-full bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300 right-[max(1rem,env(safe-area-inset-right))] ${
          cookieBannerOpen
            ? 'bottom-[calc(11rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(8rem+env(safe-area-inset-bottom,0px))]'
            : hasStickyApplyChrome
              ? 'bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] sm:bottom-6'
              : 'bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:bottom-6'
        }`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        Feedback
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close feedback form"
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setIsOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            className="relative z-10 w-full max-w-lg max-h-[min(90dvh,40rem)] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="feedback-dialog-title" className="text-lg font-bold text-slate-900">
                Site feedback
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <SiteFeedbackForm
              compact
              onSubmitted={() => {
                window.setTimeout(() => setIsOpen(false), 1800);
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
