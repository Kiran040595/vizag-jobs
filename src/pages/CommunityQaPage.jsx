import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import {
  QA_CATEGORIES,
  fetchAllCommunityQuestions,
  hasUserVotedHelpful,
  voteQuestionHelpful,
  submitJobQuestion,
  formatQuestionTime,
} from '../services/jobQuestions';
import { getJobDetailPath } from '../lib/jobRoutes';
import { useStudentAuth } from '../hooks/useStudentAuth';

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
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
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
      <span>{hasVoted ? 'Helpful' : 'Helpful'} ({count})</span>
    </button>
  );
}

function AskQuestionModal({ isOpen, onClose, defaultCategory = 'general', onSubmitted }) {
  const { session, profile, isStudent } = useStudentAuth();
  const [askerName, setAskerName] = useState('');
  const [askerEmail, setAskerEmail] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
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

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await submitJobQuestion({
        jobId: null,
        category,
        askerName,
        askerEmail,
        body,
        askerUserId: session?.user?.id || null,
      });
      setSuccess(true);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your question.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {success ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-4 text-xl font-bold text-slate-900">Doubt Submitted!</h3>
            <p className="mt-2 text-sm text-slate-600">
              Our moderation team reviews and answers candidate questions. Once approved, your answer will be
              published here for other job seekers to learn from.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-bold text-cyan-800">
              Ask VizagJobs Community
            </div>
            <h3 className="mt-2 text-xl font-black text-slate-950">Ask a Career or Hiring Doubt</h3>
            <p className="mt-1 text-xs text-slate-600">
              Free and open to all students, freshers, and professionals in Visakhapatnam.
            </p>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="general">General Hiring Doubt</option>
                  <option value="fresher">Freshers &amp; Walk-ins</option>
                  <option value="it">IT &amp; Software Jobs</option>
                  <option value="salary">Salary, Bond &amp; CTC</option>
                  <option value="scam_prevention">Job Verification &amp; Safety</option>
                  <option value="application">Application &amp; Interview Process</option>
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Your Name</label>
                  <input
                    type="text"
                    value={askerName}
                    onChange={(e) => setAskerName(e.target.value)}
                    placeholder="e.g. Rahul (Madhurawada)"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Your Email (for notification)</label>
                  <input
                    type="email"
                    value={askerEmail}
                    onChange={(e) => setAskerEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Your Question</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  required
                  placeholder="e.g. Do IT SEZ companies in Rushikonda hire 2026 passouts through direct walk-in or only campus placements?"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
            </div>

            {error ? <p className="mt-3 text-xs font-medium text-red-600">{error}</p> : null}

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-cyan-500 px-5 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting…' : 'Submit Question'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function CommunityQaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputId = useId();
  const initialCategory = searchParams.get('category') || 'all';
  const initialSearch = searchParams.get('q') || '';
  const shouldOpenAsk = searchParams.get('ask') === '1';

  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAskModalOpen, setIsAskModalOpen] = useState(shouldOpenAsk);

  const loadQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await fetchAllCommunityQuestions({
        category: activeCategory,
        search: searchQuery,
      });
      setQuestions(items);
    } catch {
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleCategorySelect = (catId) => {
    setActiveCategory(catId);
    const next = new URLSearchParams(searchParams);
    if (catId === 'all') next.delete('category');
    else next.set('category', catId);
    setSearchParams(next, { replace: true });
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    const next = new URLSearchParams(searchParams);
    if (!val.trim()) next.delete('q');
    else next.set('q', val.trim());
    setSearchParams(next, { replace: true });
  };

  // Structured Data Schema for Google FAQ rich snippet
  const structuredData = useMemo(() => {
    if (!questions.length) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: questions.slice(0, 10).map((q) => ({
        '@type': 'Question',
        name: q.body,
        acceptedAnswer: {
          '@type': 'Answer',
          text: q.answerBody,
        },
      })),
    };
  }, [questions]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-cyan-50/20 to-white">
      <SEO
        title="Candidate Questions & Answers | Visakhapatnam Jobs Community Q&A"
        description="Got doubts about jobs, interview rounds, freshers eligibility, or companies in Vizag? Browse authentic questions and verified answers from the JobsInVizag team."
        canonical="/qa"
        structuredData={structuredData}
      />
      <Navbar />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Header Hero */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-800">
                <span className="h-2 w-2 rounded-full bg-cyan-500" />
                Community Doubts &amp; Official Answers
              </span>
              <h1 className="mt-3 text-2xl font-black text-slate-950 sm:text-4xl">
                Vizag Jobs Community Q&amp;A
              </h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Real questions asked by job seekers in Visakhapatnam — answered by our team and verified employers.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAskModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-md shadow-cyan-500/20 transition hover:bg-cyan-400 md:self-auto"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Ask a Doubt</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="mt-6">
            <label htmlFor={searchInputId} className="sr-only">
              Search questions and answers
            </label>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-slate-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                id={searchInputId}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search doubts (e.g. freshers walk-in, salary bond, Fluentgrid, training fees)..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {QA_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat.id)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  activeCategory === cat.id
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Questions Feed */}
        <section className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {activeCategory === 'all'
                ? 'All Doubts'
                : QA_CATEGORIES.find((c) => c.id === activeCategory)?.label || 'Doubts'}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {questions.length}
              </span>
            </h2>
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Loading questions &amp; answers…
            </div>
          ) : null}

          {!isLoading && questions.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center sm:p-12">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                ❓
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">No questions found</h3>
              <p className="mt-1 text-sm text-slate-600">
                {searchQuery
                  ? `No doubts matching "${searchQuery}". Be the first to ask!`
                  : 'No published doubts in this category yet.'}
              </p>
              <button
                type="button"
                onClick={() => setIsAskModalOpen(true)}
                className="mt-4 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400"
              >
                Ask This Question Now
              </button>
            </div>
          ) : null}

          {!isLoading && questions.length > 0 ? (
            <div className="space-y-4">
              {questions.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-cyan-200 sm:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-800">
                        Q
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {item.askerName || 'Candidate in Vizag'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {formatQuestionTime(item.publishedAt || item.createdAt)}
                    </span>
                  </div>

                  {item.job ? (
                    <div className="mt-2.5">
                      <Link
                        to={getJobDetailPath(item.job)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-cyan-50 hover:text-cyan-800"
                      >
                        <span>📌 Regarding Job:</span>
                        <strong className="text-slate-900">{item.job.title}</strong>
                        {item.job.company ? <span>at {item.job.company}</span> : null}
                        <span className="text-cyan-700">View Job →</span>
                      </Link>
                    </div>
                  ) : null}

                  <h3 className="mt-3 text-base font-bold text-slate-900 sm:text-lg">
                    {item.body}
                  </h3>

                  {/* Verified Answer Section */}
                  <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 via-slate-50/50 to-white p-4 sm:p-5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                        ✓
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                        {item.answeredByRole || 'Verified VizagJobs Response'}
                      </span>
                    </div>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-700 sm:text-base">
                      {item.answerBody}
                    </p>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
                    <HelpfulButton questionId={item.id} initialCount={item.helpfulCount || 0} />
                    <button
                      type="button"
                      onClick={() => setIsAskModalOpen(true)}
                      className="font-semibold text-cyan-700 hover:text-cyan-800"
                    >
                      Have a related question? Ask now →
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        {/* Safety & Trust Callout */}
        <section className="mt-12 rounded-3xl border border-cyan-200/80 bg-gradient-to-r from-cyan-50/80 to-blue-50/50 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Report a Fraud or Consult Fee Scam
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                JobsInVizag is strictly committed to free and genuine hiring in Visakhapatnam. Never pay money for any interview or offer letter.
              </p>
            </div>
            <Link
              to="/contact"
              className="inline-flex whitespace-nowrap rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
            >
              Contact Support
            </Link>
          </div>
        </section>
      </main>

      <Footer />

      {/* Ask Question Modal */}
      <AskQuestionModal
        isOpen={isAskModalOpen}
        onClose={() => setIsAskModalOpen(false)}
        defaultCategory={activeCategory === 'all' ? 'general' : activeCategory}
        onSubmitted={loadQuestions}
      />
    </div>
  );
}
