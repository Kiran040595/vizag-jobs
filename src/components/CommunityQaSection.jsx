import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchRecentCommunityQuestions,
  hasUserVotedHelpful,
  voteQuestionHelpful,
  formatQuestionTime,
} from '../services/jobQuestions';
import { getJobDetailPath } from '../lib/jobRoutes';

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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
        hasVoted
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
          : 'bg-slate-100 text-slate-600 hover:bg-cyan-50 hover:text-cyan-700'
      }`}
      title={hasVoted ? 'You marked this as helpful' : 'Mark this answer as helpful'}
    >
      <svg
        className={`h-3 w-3 ${hasVoted ? 'fill-emerald-600' : 'fill-none stroke-current'}`}
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

export default function CommunityQaSection() {
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    fetchRecentCommunityQuestions({ limit: 6 })
      .then((items) => {
        if (isMounted) {
          setQuestions(items);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateScrollButtons = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 15);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 15);

    const cardWidth = scrollRef.current.firstElementChild?.offsetWidth || 280;
    const idx = Math.round(scrollLeft / cardWidth);
    setActiveIndex(Math.max(0, Math.min(idx, questions.length - 1)));
  };

  const handleScroll = (direction) => {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.firstElementChild?.offsetWidth || 280;
    const shift = direction === 'left' ? -cardWidth - 12 : cardWidth + 12;
    scrollRef.current.scrollBy({ left: shift, behavior: 'smooth' });
  };

  const scrollToIndex = (index) => {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.firstElementChild?.offsetWidth || 280;
    scrollRef.current.scrollTo({ left: index * (cardWidth + 12), behavior: 'smooth' });
  };

  if (!isLoading && questions.length === 0) {
    return null;
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white via-slate-50/50 to-cyan-50/20 p-4 shadow-sm sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/80 bg-cyan-50/90 px-2 py-0.5 text-[11px] font-bold text-cyan-800">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
            </span>
            Community Q&amp;A
          </div>
          <h2 className="mt-1 text-base font-black tracking-tight text-slate-950 sm:text-xl">
            Candidate Doubts Answered
          </h2>
          <p className="text-xs text-slate-500 line-clamp-1 sm:line-clamp-none">
            Real questions answered by our team to protect you from fake hiring.
          </p>
        </div>

        {/* Action / Arrow controls */}
        <div className="flex items-center gap-1.5">
          <Link
            to="/qa"
            className="hidden sm:inline-flex rounded-lg px-2.5 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-50 hover:text-cyan-800"
          >
            View all ({questions.length}) →
          </Link>

          {/* Prev / Next buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              disabled={!canScrollLeft}
              aria-label="Previous query"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              disabled={!canScrollRight}
              aria-label="Next query"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Scrolling Query Cards (Mobile optimized, snap-x) */}
      <div
        ref={scrollRef}
        onScroll={updateScrollButtons}
        className="-mx-4 mt-3 flex gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 pt-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
      >
        {questions.map((item) => (
          <article
            key={item.id}
            className="flex w-[82vw] max-w-[320px] shrink-0 snap-start flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition hover:border-cyan-300 sm:w-[310px]"
          >
            <div>
              {/* Question Asker & Timestamp */}
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="font-semibold text-slate-600 truncate max-w-[170px]">
                  👤 {item.askerName || 'Candidate in Vizag'}
                </span>
                <span className="text-slate-400 shrink-0">
                  {formatQuestionTime(item.publishedAt || item.createdAt)}
                </span>
              </div>

              {/* Linked Job Pill if applicable */}
              {item.job ? (
                <div className="mt-1.5">
                  <Link
                    to={getJobDetailPath(item.job)}
                    className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-cyan-50 hover:text-cyan-800 truncate max-w-full"
                  >
                    <span>📌</span>
                    <span className="truncate">{item.job.title}</span>
                  </Link>
                </div>
              ) : null}

              {/* Question Text */}
              <h3 className="mt-2 text-xs font-bold text-slate-950 leading-snug line-clamp-2">
                &ldquo;{item.body}&rdquo;
              </h3>

              {/* Answer Box */}
              <div className="mt-2 rounded-lg border border-cyan-100/80 bg-gradient-to-br from-cyan-50/60 to-white p-2.5">
                <div className="flex items-center gap-1">
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-black text-white">
                    ✓
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-950">
                    {item.answeredByRole || 'Verified Team'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-700 line-clamp-3">
                  {item.answerBody}
                </p>
              </div>
            </div>

            {/* Card Bottom: Helpful vote & Ask link */}
            <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
              <HelpfulButton questionId={item.id} initialCount={item.helpfulCount || 0} />
              <Link
                to="/qa"
                className="font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
              >
                Ask doubt →
              </Link>
            </div>
          </article>
        ))}
      </div>

      {/* Footer Navigation Bar: Dot Indicators & Mobile Link */}
      <div className="mt-2 flex items-center justify-between pt-1">
        {/* Dot indicators */}
        <div className="flex items-center gap-1">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              type="button"
              onClick={() => scrollToIndex(idx)}
              className={`h-1.5 rounded-full transition-all ${
                activeIndex === idx ? 'w-4 bg-cyan-600' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
              }`}
              aria-label={`Go to question ${idx + 1}`}
            />
          ))}
          <span className="ml-1 text-[10px] font-medium text-slate-400 sm:hidden">
            Swipe for more
          </span>
        </div>

        {/* Mobile View All */}
        <Link
          to="/qa"
          className="text-[11px] font-bold text-cyan-700 hover:underline sm:hidden"
        >
          View all doubts →
        </Link>
      </div>
    </section>
  );
}
