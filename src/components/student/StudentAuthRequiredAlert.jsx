import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { buildStudentAuthPath } from '../../lib/studentApplyRedirect';

/**
 * Modal shown when a guest opens a job URL before signing in.
 * Requires an explicit action — does not dismiss on backdrop click or Escape.
 */
export default function StudentAuthRequiredAlert({ returnPath }) {
  const signInRef = useRef(null);
  const authQuery = buildStudentAuthPath({ pathname: returnPath });
  const signInPath = `/student/login${authQuery}`;
  const registerPath = `/student/register${authQuery}`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        signInRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleEscape);
    signInRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-950/50" aria-hidden="true" />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="student-auth-alert-title"
        aria-describedby="student-auth-alert-description"
        className="relative z-10 w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:rounded-2xl sm:p-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <h2 id="student-auth-alert-title" className="text-xl font-black text-slate-950">
          You are not signed in
        </h2>
        <p id="student-auth-alert-description" className="mt-3 text-sm leading-6 text-slate-600">
          You are not yet signed in. If you have an account, please sign in. Or register first to
          apply for this job.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            ref={signInRef}
            to={signInPath}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-indigo-500 px-5 text-sm font-semibold text-white transition hover:bg-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
          >
            Sign In
          </Link>
          <Link
            to={registerPath}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            Register
          </Link>
          <Link
            to={signInPath}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            OK
          </Link>
        </div>
      </div>
    </div>
  );
}
