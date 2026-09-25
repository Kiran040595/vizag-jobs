import { useEffect } from 'react';

/**
 * Shown after a successful on-platform application when the job has a group_link.
 */
export default function ApplySuccessGroupModal({
  jobTitle = '',
  jobCompany = '',
  groupLink,
  onClose,
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-950/50"
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="apply-success-title"
        className="relative z-10 w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:rounded-2xl sm:p-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <h2 id="apply-success-title" className="text-xl font-black text-emerald-800">
          Application submitted
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          You applied successfully for{' '}
          <span className="font-semibold text-slate-900">{jobTitle || 'this job'}</span>
          {jobCompany ? (
            <>
              {' '}
              at <span className="font-semibold text-slate-900">{jobCompany}</span>
            </>
          ) : null}
          .
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Join this group for the further recruitment process and updates from the employer.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <a
            href={groupLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Join recruitment group
          </a>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
