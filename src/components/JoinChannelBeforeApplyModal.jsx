import { useEffect, useRef } from 'react';

/**
 * Popup before external apply: invite to daily Vizag jobs Instagram channel.
 */
export default function JoinChannelBeforeApplyModal({
  channelUrl,
  jobTitle = '',
  onContinue,
  onClose,
}) {
  const panelRef = useRef(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        className="absolute inset-0 bg-slate-950/50"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); onClose(); }
          if (event.key !== 'Tab') return;
          const controls = panelRef.current?.querySelectorAll('a[href],button');
          if (!controls?.length) return;
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) { event.preventDefault(); first.focus(); }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-channel-title"
        className="relative z-10 max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto outline-none rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <h2 id="join-channel-title" className="text-xl font-black text-slate-950">
          Daily Vizag jobs updates
        </h2>
        <p className="mt-3 break-words text-base leading-7 text-slate-600">
          {jobTitle ? (
            <>
              Before you apply for <span className="font-semibold text-slate-900">{jobTitle}</span>, join our
              Instagram channel for daily Vizag job updates.
            </>
          ) : (
            <>Join our Instagram channel for daily Vizag job updates before you continue to apply.</>
          )}
        </p>

        <p className="mt-3 text-sm text-slate-500">Joining is optional. Continue below to open the employer’s application page.</p>
        <div className="mt-6 flex flex-col gap-3">
          <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 py-3 text-center items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 px-5 text-base font-semibold text-white transition hover:opacity-95"
          >
            Join Instagram channel
          </a>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex min-h-12 py-3 text-center items-center justify-center rounded-2xl bg-blue-600 px-5 text-base font-semibold text-white transition hover:bg-blue-700"
          >
            Continue to apply
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-base font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
