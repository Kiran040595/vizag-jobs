import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminShell from '../components/admin/AdminShell';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  fetchAdminAllJobQuestions,
  formatQuestionAsker,
  formatQuestionTime,
  publishJobQuestion,
  saveJobQuestionAnswer,
  ignoreJobQuestion,
  deleteJobQuestion,
} from '../services/jobQuestions';
import { getJobDetailPath } from '../lib/jobRoutes';

const STATUS_TABS = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'published', label: 'Published' },
  { value: 'ignored', label: 'Ignored' },
];

const QUICK_TEMPLATES = [
  'Freshers from 2024 to 2026 batches are eligible for this opening.',
  'Strictly NO fees, bond, or training charges are collected for this job.',
  'Work location is Visakhapatnam (On-site). Check job details for address.',
  'Shortlisted candidates will receive direct interview calls within 2–4 working days.',
];

function QuestionModerationCard({ question, userId, highlighted, onUpdated }) {
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

  const applyTemplate = (text) => {
    setAnswerDraft((prev) => (prev ? `${prev} ${text}` : text));
  };

  return (
    <article
      id={`admin-question-${question.id}`}
      className={`rounded-2xl border p-4 shadow-sm sm:p-6 ${
        highlighted
          ? 'border-cyan-300 bg-cyan-50/60 ring-2 ring-cyan-200'
          : question.status === 'pending'
            ? 'border-amber-200/80 bg-amber-50/30'
            : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
              question.status === 'pending'
                ? 'bg-amber-100 text-amber-800'
                : question.status === 'published'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-700'
            }`}
          >
            {question.status}
          </span>
          <p className="mt-1.5 text-sm font-bold text-slate-950">{formatQuestionAsker(question)}</p>
          {question.askerEmail ? (
            <p className="text-xs text-slate-500">{question.askerEmail}</p>
          ) : null}
        </div>
        <span className="text-xs text-slate-400">
          {formatQuestionTime(question.createdAt)}
        </span>
      </div>

      {question.job ? (
        <div className="mt-2.5">
          <Link
            to={getJobDetailPath(question.job)}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-cyan-50 hover:text-cyan-800"
          >
            <span>💼 Job:</span>
            <span>{question.job.title}</span>
            {question.job.company ? <span>· {question.job.company}</span> : null}
            <span className="text-cyan-700">↗</span>
          </Link>
        </div>
      ) : (
        <div className="mt-2.5">
          <span className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            🌐 General Vizag Career Question
          </span>
        </div>
      )}

      {/* Question Body */}
      <div className="mt-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Question Body</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{question.body}</p>
      </div>

      {/* Answer Form */}
      {question.status !== 'ignored' ? (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">
              Answer (shown to visitors and sent to asker):
            </label>
          </div>

          {/* Quick reply templates */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 self-center">Templates:</span>
            {QUICK_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
              >
                + {tmpl.slice(0, 30)}…
              </button>
            ))}
          </div>

          <textarea
            value={answerDraft}
            onChange={(event) => setAnswerDraft(event.target.value)}
            rows={3}
            placeholder="Type answer for the candidate..."
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs font-semibold text-red-600">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-slate-100">
        <button
          type="button"
          disabled={isBusy}
          onClick={() =>
            runAction(() =>
              publishJobQuestion({
                questionId: question.id,
                userId,
                answerBody: answerDraft,
              }),
            )
          }
          className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
        >
          {question.status === 'published' ? 'Update & Publish' : 'Publish with Answer'}
        </button>

        {question.status === 'pending' ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() =>
              runAction(() =>
                saveJobQuestionAnswer({
                  questionId: question.id,
                  answerBody: answerDraft,
                  userId,
                }),
              )
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Save Draft
          </button>
        ) : null}

        {question.status !== 'ignored' ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => runAction(() => ignoreJobQuestion({ questionId: question.id, userId }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Ignore
          </button>
        ) : null}

        <button
          type="button"
          disabled={isBusy}
          onClick={() => runAction(() => deleteJobQuestion(question.id))}
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 ml-auto"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

export default function AdminQuestionsPage() {
  const { user } = useAdminAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeStatus = searchParams.get('status') || 'pending';
  const highlightQuestionId = searchParams.get('question');

  const [questions, setQuestions] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadQuestions = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const items = await fetchAdminAllJobQuestions({
        status: activeStatus,
        search,
      });
      setQuestions(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load questions.');
    } finally {
      setIsLoading(false);
    }
  }, [activeStatus, search]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const setStatusTab = (status) => {
    const next = new URLSearchParams(searchParams);
    next.set('status', status);
    next.delete('question');
    setSearchParams(next);
  };

  return (
    <AdminShell
      title="Candidate Questions &amp; Answers"
      description="Review candidate doubts, provide verified answers, and publish to the public website."
    >
      <div className="space-y-6">
        {/* Status Tabs & Search */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusTab(tab.value)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  activeStatus === tab.value
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate doubts..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Loading questions…
          </div>
        ) : null}

        {!isLoading && questions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            No questions found in {activeStatus} queue.
          </div>
        ) : null}

        {!isLoading && questions.length > 0 ? (
          <div className="space-y-4">
            {questions.map((question) => (
              <QuestionModerationCard
                key={question.id}
                question={question}
                userId={user?.id}
                highlighted={highlightQuestionId === question.id}
                onUpdated={loadQuestions}
              />
            ))}
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
