import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminShell from '../components/admin/AdminShell';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  FEEDBACK_TYPE_LABELS,
  deleteSiteFeedback,
  fetchAdminSiteFeedback,
  formatFeedbackAuthor,
  formatFeedbackTime,
  ignoreSiteFeedback,
  publishSiteFeedback,
} from '../services/siteFeedback';

const STATUS_TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'published', label: 'Published' },
  { value: 'ignored', label: 'Ignored' },
];

function FeedbackModerationCard({ feedback, userId, highlighted, onUpdated }) {
  const [adminReply, setAdminReply] = useState(feedback.adminReply || '');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setAdminReply(feedback.adminReply || '');
  }, [feedback.adminReply]);

  const runAction = async (action) => {
    setError('');
    setIsBusy(true);
    try {
      await action();
      onUpdated?.();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed.');
    } finally {
      setIsBusy(false);
    }
  };

  if (feedback.status === 'deleted') {
    return null;
  }

  const typeLabel = FEEDBACK_TYPE_LABELS[feedback.feedbackType] || feedback.feedbackType;

  return (
    <article
      id={`site-feedback-${feedback.id}`}
      className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
        highlighted
          ? 'border-cyan-300 bg-cyan-50/60 ring-2 ring-cyan-200'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            {feedback.status}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{formatFeedbackAuthor(feedback)}</p>
          <p className="mt-1 text-xs text-slate-500">{formatFeedbackTime(feedback.createdAt)}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {typeLabel}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-700 whitespace-pre-wrap">{feedback.body}</p>

      <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        {feedback.pageUrl ? (
          <div>
            <dt className="font-semibold text-slate-700">Page</dt>
            <dd className="mt-0.5 break-all">{feedback.pageUrl}</dd>
          </div>
        ) : null}
      </dl>

      {feedback.status !== 'ignored' ? (
        <label className="mt-4 block text-sm">
          <span className="font-medium text-slate-700">Admin reply (shown on public board)</span>
          <textarea
            value={adminReply}
            onChange={(event) => setAdminReply(event.target.value)}
            rows={3}
            placeholder="Optional response visitors will see when published…"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </label>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {feedback.status === 'pending' ? (
          <>
            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                runAction(() =>
                  publishSiteFeedback({
                    feedbackId: feedback.id,
                    userId,
                    adminReply,
                  }),
                )
              }
              className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
            >
              Publish
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => runAction(() => ignoreSiteFeedback({ feedbackId: feedback.id, userId }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
            >
              Ignore
            </button>
          </>
        ) : null}

        {feedback.status === 'published' && adminReply !== (feedback.adminReply || '') ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() =>
              runAction(() =>
                publishSiteFeedback({
                  feedbackId: feedback.id,
                  userId,
                  adminReply,
                }),
              )
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
          >
            Update reply
          </button>
        ) : null}

        <button
          type="button"
          disabled={isBusy}
          onClick={() => runAction(() => deleteSiteFeedback(feedback.id))}
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

export default function AdminFeedbackPage() {
  const { user } = useAdminAuth();
  const [searchParams] = useSearchParams();
  const highlightFeedbackId = searchParams.get('feedback');
  const [activeStatus, setActiveStatus] = useState('pending');
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadFeedback = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const items = await fetchAdminSiteFeedback(activeStatus);
      setFeedbackItems(items);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load feedback.');
    } finally {
      setIsLoading(false);
    }
  }, [activeStatus]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  useEffect(() => {
    if (!highlightFeedbackId) return;

    setActiveStatus('pending');
  }, [highlightFeedbackId]);

  useEffect(() => {
    if (!highlightFeedbackId || isLoading) return;

    const timer = window.setTimeout(() => {
      const element = document.getElementById(`site-feedback-${highlightFeedbackId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [highlightFeedbackId, feedbackItems.length, isLoading]);

  return (
    <AdminShell
      title="Site feedback"
      description="Review feature requests, problem reports, and general feedback from visitors."
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveStatus(tab.value)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              activeStatus === tab.value
                ? 'bg-cyan-500 text-slate-950'
                : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Loading feedback…</p> : null}

      {!isLoading && loadError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
      ) : null}

      {!isLoading && !loadError && feedbackItems.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No {activeStatus} feedback right now.
        </p>
      ) : null}

      {!isLoading && feedbackItems.length > 0 ? (
        <ul className="space-y-3">
          {feedbackItems.map((feedback) => (
            <li key={feedback.id}>
              <FeedbackModerationCard
                feedback={feedback}
                userId={user?.id}
                highlighted={highlightFeedbackId === feedback.id}
                onUpdated={loadFeedback}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </AdminShell>
  );
}
