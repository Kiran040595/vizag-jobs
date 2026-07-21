import { useEffect, useRef } from 'react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {onDismiss ? (
        <button
          type="button"
          aria-label="Close sign in dialog"
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          onClick={handleDismiss}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" aria-hidden="true" />
      )}

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="student-auth-alert-title"
        aria-describedby="student-auth-alert-description"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
      >
        {onDismiss ? (
          <button
            type="button"
            aria-label="Close"
            onClick={handleDismiss}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 11V7a4 4 0 1 1 8 0v4" strokeLinecap="round" />
            <rect x="4" y="11" width="16" height="10" rx="2" />
          </svg>
        </div>

        <h2 id="student-auth-alert-title" className="mt-5 text-center text-xl font-black text-slate-950">
          Sign in to continue
        </h2>
        <p
          id="student-auth-alert-description"
          className="mt-3 text-center text-sm leading-6 text-slate-600"
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

        <div className="mt-6 flex flex-col gap-3">
          <Link
            ref={signInRef}
            to={signInPath}
            onClick={() => trackAction('sign_in')}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
          >
            Sign In
          </Link>
          <Link
            to={registerPath}
            onClick={() => trackAction('register')}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            Create account
          </Link>
          {onDismiss ? (
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-100"
            >
              Not now
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
