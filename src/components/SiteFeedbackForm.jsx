import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FEEDBACK_TYPE_OPTIONS,
  submitSiteFeedback,
  validateSiteFeedbackInput,
} from '../services/siteFeedback';
import { useStudentAuth } from '../hooks/useStudentAuth';

const MESSAGE_PROMPTS = {
  feature_request: 'What feature would help you find jobs faster?',
  problem: 'What went wrong? Include the page or action if you can.',
  general: 'Share your thoughts about Jobs in Vizag.',
};

export default function SiteFeedbackForm({
  compact = false,
  onSubmitted,
  capturePageUrl = true,
}) {
  const { isStudent, session, profile } = useStudentAuth();
  const didPrefill = useRef(false);
  const [feedbackType, setFeedbackType] = useState('feature_request');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [body, setBody] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignedInStudent = Boolean(session && isStudent);

  useEffect(() => {
    if (!isSignedInStudent || didPrefill.current) return;

    const nextName = profile?.full_name || profile?.fullName || '';
    const nextEmail = session.user?.email || profile?.contact_email || profile?.contactEmail || '';

    if (nextName) setAuthorName(nextName);
    if (nextEmail) setAuthorEmail(nextEmail);
    didPrefill.current = true;
  }, [isSignedInStudent, profile, session]);

  const messagePlaceholder = useMemo(
    () => MESSAGE_PROMPTS[feedbackType] || MESSAGE_PROMPTS.general,
    [feedbackType],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateSiteFeedbackInput({
      feedbackType,
      authorName,
      authorEmail,
      body,
      honeypot,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await submitSiteFeedback({
        feedbackType,
        authorName,
        authorEmail,
        body,
        pageUrl: capturePageUrl && typeof window !== 'undefined' ? window.location.pathname : '',
        honeypot,
        authorUserId: isSignedInStudent ? session.user.id : null,
      });
      setAuthorName('');
      setAuthorEmail('');
      setBody('');
      setHoneypot('');
      setSuccess(
        isSignedInStudent
          ? 'Thanks — we received your feedback. When we reply, you will see it on the notification bell.'
          : 'Thanks — we received your feedback.',
      );
      didPrefill.current = false;
      onSubmitted?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-2xl border border-slate-200 bg-slate-50 ${compact ? 'p-4' : 'p-4 sm:p-5'}`}
    >
      {!compact ? (
        <>
          <h2 className="text-lg font-bold text-slate-900">Send feedback</h2>
          <p className="mt-1 text-sm text-slate-600">
            {isSignedInStudent ? (
              'Tell us what you need or what is not working. Replies appear on the notification bell.'
            ) : (
              <>
                Tell us what you need or what is not working.{' '}
                <Link to="/student/login" className="font-semibold text-cyan-700 hover:text-cyan-800">
                  Sign in
                </Link>{' '}
                to get replies on the notification bell.
              </>
            )}
          </p>
        </>
      ) : (
        <h2 className="text-base font-bold text-slate-900">Share feedback</h2>
      )}

      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Leave blank
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </label>
      </div>

      <label className="mt-4 block text-sm">
        <span className="font-medium text-slate-700">Type</span>
        <select
          value={feedbackType}
          onChange={(event) => setFeedbackType(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
        >
          {FEEDBACK_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Your name</span>
          <input
            type="text"
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="Optional if email is provided"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-slate-700">Your email</span>
          <input
            type="email"
            value={authorEmail}
            onChange={(event) => setAuthorEmail(event.target.value)}
            placeholder="Optional"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </label>
      </div>

      <label className="mt-3 block text-sm">
        <span className="font-medium text-slate-700">Message</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={compact ? 4 : 5}
          placeholder={messagePlaceholder}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
        />
      </label>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  );
}
