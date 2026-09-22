import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { supabase } from '../lib/supabaseClient';
import { notifyReplyByEmailSafe } from '../lib/replyNotification';
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
  requestJobAiAnswer,
} from '../services/jobQuestions';

function QuestionAskForm({ jobId, job = null, onSubmitted }) {
  const { isStudent, session: studentSession, profile } = useStudentAuth();
  const { isAdmin, session: adminSession, user: adminUser } = useAdminAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answeredResult, setAnsweredResult] = useState(null);

  const isAuthenticated = Boolean((isStudent && studentSession) || (isAdmin && (adminSession || adminUser)));
  const activeSession = (isStudent && studentSession) ? studentSession : adminSession;
  const activeUserId = studentSession?.user?.id || adminUser?.id || adminSession?.user?.id || null;

  // Auto-fill name/email from profile, admin session, or student session
  const askerName =
    profile?.full_name ||
    profile?.fullName ||
    (isAdmin ? (adminUser?.user_metadata?.full_name || adminUser?.email?.split('@')[0] || 'Admin') : '') ||
    activeSession?.user?.email?.split('@')[0] ||
    '';
  const askerEmail =
    activeSession?.user?.email ||
    adminUser?.email ||
    profile?.contact_email ||
    profile?.contactEmail ||
    '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setAnsweredResult(null);

    if (!body.trim() || body.trim().length < 3) {
      setError('Please enter a question with at least 3 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestJobAiAnswer({
        jobId,
        job,
        body,
        askerName,
        askerEmail,
        askerUserId: activeUserId,
      });

      if (res?.isAiAnswer && res?.answer && res?.question?.id) {
        setAnsweredResult({
          question: body.trim(),
          answer: res.answer,
          questionId: res.question.id,
        });
        setBody('');

        // Fire notification so it shows up in the bell
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token || activeSession?.access_token;
          if (accessToken) {
            await notifyReplyByEmailSafe(accessToken, {
              kind: 'job_question',
              id: res.question.id,
            });
          }
        } catch {
          // notification is best-effort; never block the user
        }

        onSubmitted?.();
      } else {
        setBody('');
        setAnsweredResult({ question: body.trim(), answer: null, pending: true });
        onSubmitted?.();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guest: show sign-in prompt instead of form
  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center sm:p-5">
        <p className="text-xs sm:text-sm font-semibold text-slate-900">Have a doubt about this job?</p>
        <p className="mt-1 text-xs text-slate-600">
          Sign in to ask a question and get an instant verified answer.
        </p>
        <Link
          to="/student/login"
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-500"
        >
          Sign in to ask a question
        </Link>
      </div>
    );
  }

  // Show the answer card after submission
  if (answeredResult) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white">
                ✓
              </span>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                Answer received
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAnsweredResult(null)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              ✕ Dismiss
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Your question</p>
            <p className="mt-0.5 text-xs sm:text-sm font-semibold text-slate-900">&ldquo;{answeredResult.question}&rdquo;</p>
          </div>

          {answeredResult.answer ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-sm">
              <p className="text-xs sm:text-sm leading-relaxed text-slate-800">{answeredResult.answer}</p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-600">
              Your question was submitted. Check your notification bell for a reply.
            </p>
          )}

          {answeredResult.answer ? (
            <p className="mt-2.5 text-[11px] text-slate-500">
              🔔 A notification has been sent to your account. Check the bell icon in the navbar.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setAnsweredResult(null);
              setIsOpen(true);
            }}
            className="mt-3 text-xs font-bold text-cyan-700 hover:underline"
          >
            Ask another question →
          </button>
        </div>
      </div>
    );
  }

  // Collapsed state
  if (!isOpen) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3.5 text-center sm:p-4">
        <p className="text-xs text-slate-600">Have a specific question about this opening?</p>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-cyan-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-cyan-50"
        >
          <span>💬 Ask a Question</span>
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Ask a Question About This Job</h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-xs font-semibold text-slate-400 hover:text-slate-600"
        >
          ✕ Cancel
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        Asking as <span className="font-semibold text-slate-800">{askerName || askerEmail}</span>{isAdmin && !isStudent ? ' (Admin)' : ''}. Your answer will appear in your notification bell.
      </p>

      <label className="mt-3 block text-xs">
        <span className="font-medium text-slate-700">Your question</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          placeholder="e.g. Is this role open for 2026 batch freshers? Is work from home available?"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
        />
      </label>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span>Reviewing your question…</span>
            </>
          ) : (
            <span>Submit Question</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
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
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">
              VizagJobs Team
            </p>
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
  job = null,
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

      <QuestionAskForm jobId={jobId} job={job} onSubmitted={loadQuestions} />
    </section>
  );
}
