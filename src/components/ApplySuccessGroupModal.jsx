import { useEffect, useRef } from 'react';
import ApplicationCommunicationPrompt from './ApplicationCommunicationPrompt';

export default function ApplySuccessGroupModal({ jobTitle = '', jobCompany = '', groupLink, onClose }) {
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
  function handleKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const controls = panelRef.current?.querySelectorAll('a[href],button');
    if (!controls?.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) {
      event.preventDefault(); first.focus();
    }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button type="button" tabIndex={-1} aria-label="Close" className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} onKeyDown={handleKeyDown} role="alertdialog" aria-modal="true" aria-labelledby="apply-success-title" className="relative z-10 max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl outline-none sm:p-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <h2 id="apply-success-title" className="break-words text-xl font-black text-emerald-800">Application submitted</h2>
        <p className="mt-3 break-words text-base leading-7 text-slate-600">
          You applied successfully for <span className="font-semibold text-slate-900">{jobTitle || 'this job'}</span>{jobCompany ? <> at <span className="font-semibold text-slate-900">{jobCompany}</span></> : null}.
        </p>
        <ApplicationCommunicationPrompt job={{ groupLink }} />
        <button type="button" onClick={onClose} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50">Done</button>
      </div>
    </div>
  );
}
