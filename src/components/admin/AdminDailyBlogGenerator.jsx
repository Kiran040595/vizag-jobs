import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { generateDailyBlogArticle } from '../../services/dailyBlogGenerate';
import { pickDailyBlogAngle } from '../../lib/dailyBlogPrompt';

const DRAFT_STORAGE_KEY = 'vizagjobs:admin-daily-blog-generator';

function getIstDateInputValue(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const loadDraft = () => {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveDraft = (values) => {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(values));
  } catch {
    // ignore
  }
};

const TEXTAREA_CLASS =
  'mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100';

export default function AdminDailyBlogGenerator({ onGenerated }) {
  const navigate = useNavigate();
  const { session } = useAdminAuth();
  const initialDraft = loadDraft();

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [publishImmediately, setPublishImmediately] = useState(initialDraft.publishImmediately ?? true);
  const [skipIfExists, setSkipIfExists] = useState(initialDraft.skipIfExists ?? true);
  const [minJobs, setMinJobs] = useState(initialDraft.minJobs ?? 1);
  const [articleDate, setArticleDate] = useState(initialDraft.articleDate || getIstDateInputValue());
  const [customInstructions, setCustomInstructions] = useState(initialDraft.customInstructions || '');
  const [sourceContent, setSourceContent] = useState(initialDraft.sourceContent || '');

  const todaysAngle = useMemo(() => pickDailyBlogAngle(`${articleDate}T12:00:00+05:30`), [articleDate]);
  const hasCustomBrief = Boolean(customInstructions.trim() || sourceContent.trim());

  useEffect(() => {
    saveDraft({
      publishImmediately,
      skipIfExists,
      minJobs,
      articleDate,
      customInstructions,
      sourceContent,
    });
  }, [publishImmediately, skipIfExists, minJobs, articleDate, customInstructions, sourceContent]);

  const handleGenerate = async () => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setError('Admin session missing. Sign in again and retry.');
      return;
    }

    setIsGenerating(true);
    setError('');
    setResult(null);

    try {
      const response = await generateDailyBlogArticle(accessToken, {
        publish: publishImmediately,
        skipIfExists: hasCustomBrief ? false : skipIfExists,
        minJobs: hasCustomBrief ? 0 : minJobs,
        date: articleDate,
        loadJobsFromDb: true,
        customInstructions: customInstructions.trim(),
        sourceContent: sourceContent.trim(),
      });

      setResult(response);
      if (response?.post?.id && onGenerated) {
        onGenerated(response.post);
      }
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Could not generate blog post.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-6 shadow-xl shadow-cyan-100/50">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700">AI daily article</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Generate market blog</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Creates an AdSense-quality Vizag job market article from today&apos;s published listings, optional live web
            context, and a rotating editorial angle. Today&apos;s angle:{' '}
            <span className="font-semibold text-slate-800">{todaysAngle.label}</span>.
          </p>
        </div>
        <button
          type="button"
          disabled={isGenerating}
          onClick={handleGenerate}
          className="h-11 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? 'Generating…' : 'Generate article'}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-semibold text-slate-900">Article date (IST)</span>
          <input
            type="date"
            value={articleDate}
            onChange={(event) => setArticleDate(event.target.value)}
            disabled={isGenerating}
            className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          />
        </label>

        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-semibold text-slate-900">Minimum jobs required</span>
          <input
            type="number"
            min="0"
            max="50"
            value={minJobs}
            onChange={(event) => setMinJobs(Number(event.target.value) || 0)}
            disabled={isGenerating || hasCustomBrief}
            className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 disabled:bg-slate-100"
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={publishImmediately}
            onChange={(event) => setPublishImmediately(event.target.checked)}
            disabled={isGenerating}
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          Publish immediately
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={skipIfExists}
            onChange={(event) => setSkipIfExists(event.target.checked)}
            disabled={isGenerating || hasCustomBrief}
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:opacity-60"
          />
          Skip if today&apos;s article exists
        </label>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="block text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Custom instructions (optional)</span>
          <span className="mt-1 block text-xs text-slate-500">
            Topics, tone, or angles — e.g. &quot;Write about IT park hiring trends&quot; or &quot;Focus on fresher
            opportunities in pharma&quot;.
          </span>
          <textarea
            value={customInstructions}
            onChange={(event) => setCustomInstructions(event.target.value)}
            disabled={isGenerating}
            rows={5}
            maxLength={4000}
            placeholder="Add editorial notes or topics you want covered in this article…"
            className={`${TEXTAREA_CLASS} min-h-[140px] resize-y`}
          />
        </label>

        <label className="block text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Source content to rewrite (optional)</span>
          <span className="mt-1 block text-xs text-slate-500">
            Paste text from another site, PDF notes, or a draft. Gemini will rewrite it in original words for JobsInVizag
            with internal links to your job pages.
          </span>
          <textarea
            value={sourceContent}
            onChange={(event) => setSourceContent(event.target.value)}
            disabled={isGenerating}
            rows={5}
            maxLength={12000}
            placeholder="Paste reference material here to rewrite for our website…"
            className={`${TEXTAREA_CLASS} min-h-[140px] resize-y`}
          />
        </label>
      </div>

      {hasCustomBrief ? (
        <p className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          Custom brief active: job minimum is ignored (0) and duplicate-day skip is turned off so you can generate a
          topic-specific article even when today&apos;s default post already exists.
        </p>
      ) : null}

      {isGenerating ? (
        <p className="mt-5 rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm text-cyan-800">
          Gemini is writing the article and may fetch live market context. This usually takes 30–90 seconds.
        </p>
      ) : null}

      {error ? (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {result?.skipped ? (
        <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Skipped: {result.reason}
        </p>
      ) : null}

      {result?.post ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          <p className="font-semibold">Article created: {result.post.title}</p>
          <p className="mt-1">Slug: {result.post.slug} · Status: {result.post.status}</p>
          {result.jobs_count != null ? <p className="mt-1">Jobs used: {result.jobs_count}</p> : null}
          {result.editorial_notes ? <p className="mt-2 text-emerald-800">{result.editorial_notes}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(`/admin/blog/${result.post.id}/edit`)}
              className="rounded-2xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
            >
              Edit post
            </button>
            {result.post.status === 'published' ? (
              <button
                type="button"
                onClick={() => navigate(`/blog/${result.post.slug}`)}
                className="rounded-2xl border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                View on site
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
