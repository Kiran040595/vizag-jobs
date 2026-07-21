import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { buildStudentAuthPath } from '../../lib/studentApplyRedirect';
import { trackStudentFunnel } from '../../lib/studentFunnelAnalytics';

/**
 * Modal shown when a guest must sign in before viewing or applying to a job.
 */
export default function StudentAuthRequiredAlert({
  returnPath,
  jobTitle = '',
  jobCompany = '',
  intent = 'view',
  source = 'job_gate',
  apply = false,
  onDismiss,
}) {
  const signInRef = useRef(null);
  const authQuery = buildStudentAuthPath({ pathname: returnPath, apply });
  const signInPath = `/student/login${authQuery}`;
  const registerPath = `/student/register${authQuery}`;

  const jobLabel =
    jobTitle && jobCompany
      ? `${jobTitle} at ${jobCompany}`
      : jobTitle || jobCompany || '';

  useEffect(() => {
    trackStudentFunnel('student_auth_alert_shown', {
      intent,
      source,
      hasJobLabel: Boolean(jobLabel),
    });
  }, [intent, jobLabel, source]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      if (onDismiss) {
        onDismiss();
        return;
      }

      signInRef.current?.focus();
    };

    window.addEventListener('keydown', handleEscape);
    signInRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onDismiss]);

  const trackAction = (action) => {
    trackStudentFunnel('student_auth_alert_action', {
      action,
      intent,
      source,
    });
  };

  const handleDismiss = () => {
    trackAction('dismiss');
    onDismiss?.();
  };

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        {onDismiss ? (
          <button
            type="button"
            aria-label="Close sign in dialog"
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={handleDismiss}
          />
        ) : (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" aria-hidden="true" />
        )}

        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="student-auth-alert-title"
          aria-describedby="student-auth-alert-description"
          className="relative z-10 my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-8"
        >
          {onDismiss ? (
            <button
              type="button"
              aria-label="Close"
              onClick={handleDismiss}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-100 sm:right-4 sm:top-4"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}

          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 sm:h-14 sm:w-14">
            <svg viewBox="0 0 24 24" className="h-6 w-6 sm:h-7 sm:w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 11V7a4 4 0 1 1 8 0v4" strokeLinecap="round" />
              <rect x="4" y="11" width="16" height="10" rx="2" />
            </svg>
          </div>

          <h2 id="student-auth-alert-title" className="mt-4 text-center text-lg font-black text-slate-950 sm:mt-5 sm:text-xl">
            Sign in to continue
          </h2>
          <p
            id="student-auth-alert-description"
            className="mt-2 text-center text-sm leading-6 text-slate-600 sm:mt-3"
          >
            {jobLabel ? (
              <>
                Sign in to view <span className="font-semibold text-slate-900">{jobLabel}</span>
                {intent === 'apply' ? ' and apply.' : ' and apply for this job.'}
              </>
            ) : (
              <>
                You are not signed in yet. Sign in with your account or register to{' '}
                {intent === 'apply' ? 'apply for this job' : 'view and apply for this job'}.
              </>
            )}
          </p>

          <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:gap-3">
            <Link
              ref={signInRef}
              to={signInPath}
              onClick={() => trackAction('sign_in')}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 sm:h-12"
            >
              Sign In
            </Link>
            <Link
              to={registerPath}
              onClick={() => trackAction('register')}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 sm:h-12"
            >
              Create account
            </Link>
            {onDismiss ? (
              <button
                type="button"
                onClick={handleDismiss}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl px-5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-100 sm:h-11"
              >
                Not now
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
