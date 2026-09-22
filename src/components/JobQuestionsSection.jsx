import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudentAuth } from '../hooks/useStudentAuth';
import {
  hasUserVotedHelpful,
  voteQuestionHelpful,
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
  const { isStudent, session, profile } = useStudentAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [askerName, setAskerName] = useState('');
  const [askerEmail, setAskerEmail] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!session || !isStudent) return;
    if (!askerName && (profile?.full_name || profile?.fullName)) {
      setAskerName(profile.full_name || profile.fullName || '');
    }
    if (!askerEmail && (session.user?.email || profile?.contact_email || profile?.contactEmail)) {
      setAskerEmail(session.user?.email || profile?.contact_email || profile?.contactEmail || '');
    }
  }, [askerEmail, askerName, isStudent, profile, session]);

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
      await submitJobQuestion({
        jobId,
        askerName,
        askerEmail,
        body,
        askerUserId: session?.user?.id || null,
      });
      setAskerName('');
      setAskerEmail('');
      setBody('');
      setSuccess(
        session && isStudent
          ? 'Thanks! Your question was sent. When we reply, you will see it in the notification bell.'
          : 'Thanks! Your question was sent. Sign in next time to get replies in your notification bell.',
      );
      onSubmitted?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your question.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3.5 text-center sm:p-4">
        <p className="text-xs text-slate-600">Have a specific question about this opening?</p>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-cyan-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-cyan-50"
        >
          <span>💬 Ask Question About This Job</span>
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Have a doubt about this job?</h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-xs font-semibold text-slate-400 hover:text-slate-600"
        >
          ✕ Cancel
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        {session && isStudent
          ? 'Ask below. When we reply, a notification will appear on the bell icon in the navbar.'
          : (
            <>
              Ask below. For reply notifications on the bell icon,{' '}
              <Link to="/student/login" className="font-semibold text-cyan-700 hover:text-cyan-800">
                sign in
              </Link>{' '}
              first.
            </>
          )}
      </p>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="font-medium text-slate-700">Your name</span>
          <input
            type="text"
            value={askerName}
            onChange={(event) => setAskerName(event.target.value)}
            placeholder="Optional if email is provided"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </label>

        <label className="block text-xs">
          <span className="font-medium text-slate-700">Your email</span>
          <input
            type="email"
            value={askerEmail}
            onChange={(event) => setAskerEmail(event.target.value)}
            placeholder="For reply notification (recommended)"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </label>
      </div>

      <label className="mt-2.5 block text-xs">
        <span className="font-medium text-slate-700">Your question</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          placeholder="e.g. Is this role open for 2026 batch freshers?"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
        />
      </label>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {success ? <p className="mt-2 text-xs text-emerald-700">{success}</p> : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Sending…' : 'Submit Question'}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function HelpfulButton({ questionId, initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);
  const [hasVoted, setHasVoted] = useState(() => hasUserVotedHelpful(questionId));
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async () => {
    if (hasVoted || isVoting) return;
    setIsVoting(true);
    setCount((prev) => prev + 1);
    setHasVoted(true);
    try {
      await voteQuestionHelpful(questionId);
    } catch {
      // ignore
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleVote}
      disabled={hasVoted || isVoting}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
        hasVoted
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
          : 'bg-slate-100 text-slate-600 hover:bg-cyan-50 hover:text-cyan-700'
      }`}
      title={hasVoted ? 'You marked this as helpful' : 'Mark this answer as helpful'}
    >
      <svg
        className={`h-3.5 w-3.5 ${hasVoted ? 'fill-emerald-600' : 'fill-none stroke-current'}`}
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
        />
      </svg>
      <span>Helpful ({count})</span>
    </button>
  );
}

function PublishedQuestionItem({ question, highlighted = false }) {
  return (
    <article
      id={`job-question-${question.id}`}
      className={`rounded-2xl border p-4 sm:p-5 transition ${
        highlighted
          ? 'border-cyan-300 bg-cyan-50/60 ring-2 ring-cyan-200'
          : 'border-slate-200 bg-white shadow-sm'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-100 text-[11px] font-bold text-cyan-800">
            Q
          </span>
          <p className="text-sm font-bold text-slate-900">{formatQuestionAsker(question)}</p>
        </div>
        <p className="text-xs text-slate-400">{formatQuestionTime(question.publishedAt || question.createdAt)}</p>
      </div>

      <p className="mt-2 text-sm leading-6 font-medium text-slate-900">&ldquo;{question.body}&rdquo;</p>

      {question.answerBody ? (
        <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5">
          <div className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white">
              ✓
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">Verified Answer</p>
          </div>
          <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-700">{question.answerBody}</p>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
        <HelpfulButton questionId={question.id} initialCount={question.helpfulCount || 0} />
      </div>
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
  const [showAllQuestions, setShowAllQuestions] = useState(false);

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
  }, [highlightQuestionId, moderatorQuestions.length, publishedQuestions.length]);

  const pendingQuestions = useMemo(
    () => moderatorQuestions.filter((item) => item.status === 'pending'),
    [moderatorQuestions],
  );

  return (
    <section className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Questions &amp; answers</h2>
            {publishedQuestions.length > 0 ? (
              <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-bold text-cyan-800">
                {publishedQuestions.length} answered
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            See what others asked about this role, or submit your own doubt.
          </p>
        </div>
        <Link
          to="/qa"
          className="text-xs font-bold text-cyan-700 hover:text-cyan-800 hover:underline"
        >
          Browse All Community Doubts →
        </Link>
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
          {(showAllQuestions ? publishedQuestions : publishedQuestions.slice(0, 2)).map((question) => (
            <PublishedQuestionItem
              key={question.id}
              question={question}
              highlighted={highlightQuestionId === question.id}
            />
          ))}
          {publishedQuestions.length > 2 ? (
            <button
              type="button"
              onClick={() => setShowAllQuestions(!showAllQuestions)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-cyan-700 transition hover:bg-slate-50"
            >
              {showAllQuestions
                ? 'Show fewer questions ↑'
                : `Show all ${publishedQuestions.length} questions ↓`}
            </button>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !loadError && publishedQuestions.length === 0 ? (
        <p className="text-sm text-slate-500">No published questions yet. Be the first to ask!</p>
      ) : null}

      <QuestionAskForm jobId={jobId} onSubmitted={loadQuestions} />
    </section>
  );
}
