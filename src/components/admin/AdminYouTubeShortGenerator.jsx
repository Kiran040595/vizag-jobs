import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { triggerYouTubeShortUpload } from '../../services/youtubeShortTrigger';

const DRAFT_STORAGE_KEY = 'vizagjobs:admin-youtube-short-generator';

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

export default function AdminYouTubeShortGenerator() {
  const { session } = useAdminAuth();
  const initialDraft = loadDraft();

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [privacy, setPrivacy] = useState(initialDraft.privacy || 'unlisted');
  const [skipIfExists, setSkipIfExists] = useState(initialDraft.skipIfExists ?? false);
  const [publish, setPublish] = useState(initialDraft.publish ?? true);

  useEffect(() => {
    saveDraft({ privacy, skipIfExists, publish });
  }, [privacy, skipIfExists, publish]);

  const handlePost = async () => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setError('Admin session missing. Sign in again and retry.');
      return;
    }

    setIsRunning(true);
    setError('');
    setResult(null);

    try {
      const response = await triggerYouTubeShortUpload(accessToken, {
        privacy,
        skipIfExists,
        publish,
      });
      setResult(response);
    } catch (triggerError) {
      setError(triggerError instanceof Error ? triggerError.message : 'Could not start YouTube Short upload.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-slate-50 p-6 shadow-xl shadow-rose-100/50">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-700">YouTube Shorts</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Post daily job Short</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            One-click test: builds today&apos;s Vizag job slides, renders the Short video, and uploads to your
            YouTube channel via GitHub Actions (FFmpeg + Pollinations).
          </p>
        </div>
        <button
          type="button"
          disabled={isRunning}
          onClick={handlePost}
          className="h-11 rounded-2xl bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRunning ? 'Starting…' : 'Post YouTube Short now'}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-semibold text-slate-900">YouTube visibility</span>
          <select
            value={privacy}
            onChange={(event) => setPrivacy(event.target.value)}
            disabled={isRunning || !publish}
            className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100 disabled:bg-slate-100"
          >
            <option value="unlisted">Unlisted (recommended for tests)</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={skipIfExists}
            onChange={(event) => setSkipIfExists(event.target.checked)}
            disabled={isRunning}
            className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
          />
          Skip if today&apos;s Short exists
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={publish}
            onChange={(event) => setPublish(event.target.checked)}
            disabled={isRunning}
            className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
          />
          Upload to YouTube (off = dry run)
        </label>
      </div>

      {isRunning ? (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-800">
          Queuing GitHub Actions workflow… Video generation usually takes 2–5 minutes after that.
        </p>
      ) : null}

      {error ? (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {result?.queued ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          <p className="font-semibold">{result.message}</p>
          <p className="mt-1">
            Visibility: {result.privacy} · Skip duplicate: {result.skip_if_exists ? 'yes' : 'no'} · Upload:{' '}
            {result.publish ? 'yes' : 'dry run'}
          </p>
          {result.actions_url ? (
            <a
              href={result.actions_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex rounded-2xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
            >
              Open GitHub Actions run
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
