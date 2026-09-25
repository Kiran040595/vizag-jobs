import { useCallback, useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import SiteFeedbackForm from '../components/SiteFeedbackForm';
import {
  FEEDBACK_TYPE_LABELS,
  fetchPublishedSiteFeedback,
  formatFeedbackAuthor,
  formatFeedbackTime,
} from '../services/siteFeedback';

function PublishedFeedbackCard({ feedback }) {
  const typeLabel = FEEDBACK_TYPE_LABELS[feedback.feedbackType] || 'Feedback';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
          {typeLabel}
        </span>
        <p className="text-xs text-slate-500">
          {formatFeedbackTime(feedback.publishedAt || feedback.createdAt)}
        </p>
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-900">{formatFeedbackAuthor(feedback)}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700 whitespace-pre-wrap">{feedback.body}</p>

      {feedback.adminReply ? (
        <div className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Team reply</p>
          <p className="mt-1 text-sm leading-6 text-slate-700 whitespace-pre-wrap">{feedback.adminReply}</p>
        </div>
      ) : null}
    </article>
  );
}

export default function FeedbackPage() {
  const [publishedFeedback, setPublishedFeedback] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadPublished = useCallback(async () => {
    setLoadError('');
    try {
      const items = await fetchPublishedSiteFeedback();
      setPublishedFeedback(items);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load community feedback.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPublished();
  }, [loadPublished]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-cyan-50/20 to-white">
      <SEO
        title="Feedback & Feature Requests | Jobs in Vizag"
        description="Share feedback, report problems, or request features for Jobs in Vizag. See approved community suggestions on our public board."
        canonical="/feedback"
      />
      <Navbar />

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Feedback &amp; feature requests</h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Help us improve Jobs in Vizag. Your submission stays private until we review and approve it for the public board.
          </p>
        </div>

        <SiteFeedbackForm onSubmitted={loadPublished} />

        <section className="mt-10">
          <h2 className="text-lg font-bold text-slate-900">Community board</h2>
          <p className="mt-1 text-sm text-slate-600">
            Approved feedback chosen by our team for the public board.
          </p>

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading community feedback…</p>
          ) : null}

          {!isLoading && loadError ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
          ) : null}

          {!isLoading && !loadError && publishedFeedback.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No published feedback yet. Be the first to share an idea.
            </p>
          ) : null}

          {!isLoading && publishedFeedback.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {publishedFeedback.map((feedback) => (
                <li key={feedback.id}>
                  <PublishedFeedbackCard feedback={feedback} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>

      <Footer />
    </div>
  );
}
