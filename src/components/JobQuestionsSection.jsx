import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteJobQuestion,
  fetchModeratorJobQuestions,
  fetchPublishedJobQuestions,
  formatQuestionAsker,
  formatQuestionTime,
  ignoreJobQuestion,
  publishJobQuestion,
  saveJobQuestionAnswer,
  submitJobQuestion,
  validateQuestionInput,
} from '../services/jobQuestions';

function QuestionAskForm({ jobId, onSubmitted }) {
  const [askerName, setAskerName] = useState('');
  const [askerEmail, setAskerEmail] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateQuestionInput({ askerName, askerEmail, body });
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await submitJobQuestion({ jobId, askerName, askerEmail, body });
      setAskerName('');
      setAskerEmail('');
      setBody('');
      setSuccess('Thanks! Your question was sent. It will appear here after review.');
      onSubmitted?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your question.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <h3 className="text-base font-bold text-slate-900">Have a doubt about this job?</h3>
      <p className="mt-1 text-sm text-slate-600">
        Ask your question below. No login needed — enter your name or email so we can follow up if needed.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Your name</span>
          <input
            type="text"
            value={askerName}
            onChange={(event) => setAskerName(event.target.value)}
            placeholder="Optional if email is provided"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-slate-700">Your email</span>
          <input
            type="email"
            value={askerEmail}
            onChange={(event) => setAskerEmail(event.target.value)}
            placeholder="Optional if name is provided"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </label>
      </div>

      <label className="mt-3 block text-sm">
        <span className="font-medium text-slate-700">Your question</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          placeholder="e.g. Is this role open for freshers?"
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
        {isSubmitting ? 'Sending…' : 'Ask question'}
      </button>
    </form>
  );
}

function PublishedQuestionItem({ question }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{formatQuestionAsker(question)}</p>
        <p className="text-xs text-slate-500">{formatQuestionTime(question.publishedAt || question.createdAt)}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-700">{question.body}</p>
      {question.answerBody ? (
        <div className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Answer</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{question.answerBody}</p>
        </div>
      ) : null}
    </article>
  );
}

function ModeratorQuestionCard({
  question,
  userId,
  highlighted,
  onUpdated,
}) {
  const [answerDraft, setAnswerDraft] = useState(question.answerBody || '');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setAnswerDraft(question.answerBody || '');
  }, [question.answerBody]);

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

  if (question.status === 'deleted') {
    return null;
  }

  return (
    <article
      id={`job-question-${question.id}`}
      className={`rounded-2xl border p-4 ${
        highlighted
          ? 'border-cyan-300 bg-cyan-50/60 ring-2 ring-cyan-200'
          : 'border-amber-200 bg-amber-50/50'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            {question.status === 'pending' ? 'Pending review' : question.status}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{formatQuestionAsker(question)}</p>
        </div>
        <p className="text-xs text-slate-500">{formatQuestionTime(question.createdAt)}</p>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-700">{question.body}</p>

      <label className="mt-3 block text-sm">
        <span className="font-medium text-slate-700">Answer (optional before publish)</span>
        <textarea
          value={answerDraft}
          onChange={(event) => setAnswerDraft(event.target.value)}
          rows={3}
          placeholder="Write an answer for the asker and other visitors…"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
        />
      </label>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={() =>
            runAction(() => saveJobQuestionAnswer({ questionId: question.id, answerBody: answerDraft, userId }))
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
        >
          Save answer
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() =>
            runAction(() =>
              publishJobQuestion({ questionId: question.id, userId, answerBody: answerDraft }),
            )
          }
          className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
        >
          Publish
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => runAction(() => ignoreJobQuestion({ questionId: question.id, userId }))}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
        >
          Ignore
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => runAction(() => deleteJobQuestion(question.id))}
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

export default function JobQuestionsSection({
  jobId,
  canModerate = false,
  userId = null,
  highlightQuestionId = null,
}) {
  const [publishedQuestions, setPublishedQuestions] = useState([]);
  const [moderatorQuestions, setModeratorQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadQuestions = useCallback(async () => {
    if (!jobId) return;

    setLoadError('');
    try {
      const published = await fetchPublishedJobQuestions(jobId);
      setPublishedQuestions(published);

      if (canModerate && userId) {
        const moderationQueue = await fetchModeratorJobQuestions(jobId);
        setModeratorQuestions(moderationQueue.filter((item) => item.status !== 'published'));
      } else {
        setModeratorQuestions([]);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load questions.');
    } finally {
      setIsLoading(false);
    }
  }, [canModerate, jobId, userId]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    if (!highlightQuestionId) return;

    const timer = window.setTimeout(() => {
      const element = document.getElementById(`job-question-${highlightQuestionId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [highlightQuestionId, moderatorQuestions.length]);

  const pendingQuestions = useMemo(
    () => moderatorQuestions.filter((item) => item.status === 'pending'),
    [moderatorQuestions],
  );

  return (
    <section className="mt-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Questions &amp; answers</h2>
        <p className="mt-1 text-sm text-slate-600">
          See what others asked about this role, or submit your own doubt.
        </p>
      </div>

      {canModerate && pendingQuestions.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700">Needs your review</h3>
          {pendingQuestions.map((question) => (
            <ModeratorQuestionCard
              key={question.id}
              question={question}
              userId={userId}
              highlighted={highlightQuestionId === question.id}
              onUpdated={loadQuestions}
            />
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading questions…</p>
      ) : null}

      {!isLoading && loadError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
      ) : null}

      {!isLoading && publishedQuestions.length > 0 ? (
        <div className="space-y-3">
          {publishedQuestions.map((question) => (
            <PublishedQuestionItem key={question.id} question={question} />
          ))}
        </div>
      ) : null}

      {!isLoading && !loadError && publishedQuestions.length === 0 ? (
        <p className="text-sm text-slate-500">No published questions yet. Be the first to ask!</p>
      ) : null}

      <QuestionAskForm jobId={jobId} onSubmitted={loadQuestions} />
    </section>
  );
}
