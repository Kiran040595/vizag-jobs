import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import { useAdminAuth } from '../hooks/useAdminAuth';
import ExternalJobReviewPanel, { getExternalJobKey } from '../components/admin/ExternalJobReviewPanel';
import { createAdminJob, deserializeJobForForm, fetchAdminJobs } from '../services/adminJobs';
import { fetchExternalJobsBySource, seoOptimizeExternalJob } from '../services/externalJobFetch';
import { EXTERNAL_FETCH_SOURCES } from '../lib/externalFetchSources';
import { LINKEDIN_POST_PRESET_OPTIONS } from '../lib/linkedinPostPresets';
import { stashAdminJobPrefill } from '../lib/adminNewJobPrefill';
import {
  clearAdminFetchSnapshot,
  loadAdminFetchSnapshot,
  saveAdminFetchSnapshot,
} from '../lib/adminExternalFetchPersistence';

const BULK_IMPORT_CONCURRENCY = 3;
/** Debounce auto-save so rapid state changes (typing, bulk SEO) don't thrash localStorage. */
const PERSIST_DEBOUNCE_MS = 250;
/** Hide the "Restored from..." banner when the user just hit Fetch — only show on actual restores. */
const RESTORED_BANNER_GRACE_MS = 5_000;

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const diffSec = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
};

async function runWithConcurrency(items, limit, worker) {
  const results = [];
  let index = 0;

  async function runNext() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
  await Promise.all(runners);
  return results;
}

export default function AdminExternalFetchPage() {
  const navigate = useNavigate();
  const { session, isSupabaseConfigured } = useAdminAuth();

  // Hydrate from localStorage so a fetched batch survives tab switches,
  // refreshes, and accidental browser closes. Read once via useMemo so each
  // useState lazy initializer below sees the same snapshot without
  // re-parsing JSON multiple times.
  const initialSnapshot = useMemo(() => loadAdminFetchSnapshot(), []);

  const [existingJobs, setExistingJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [activeSource, setActiveSource] = useState(initialSnapshot?.activeSource ?? null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetchPayload, setFetchPayload] = useState(initialSnapshot?.fetchPayload ?? null);
  const [notice, setNotice] = useState('');
  const [reviewJobs, setReviewJobs] = useState(() => initialSnapshot?.reviewJobs ?? []);
  const [skippedKeys, setSkippedKeys] = useState(
    () => new Set(initialSnapshot?.skippedKeys ?? []),
  );
  const [busyImportKey, setBusyImportKey] = useState('');
  const [busySeoKey, setBusySeoKey] = useState('');
  const [importErrors, setImportErrors] = useState(initialSnapshot?.importErrors ?? {});
  const [seoErrors, setSeoErrors] = useState(initialSnapshot?.seoErrors ?? {});
  const [linkedInPostPreset, setLinkedInPostPreset] = useState(
    initialSnapshot?.linkedInPostPreset ?? 'general',
  );
  const [linkedInCustomSearchUrl, setLinkedInCustomSearchUrl] = useState(
    initialSnapshot?.linkedInCustomSearchUrl ?? '',
  );
  /** Timestamp of the active batch (when it was first fetched). null = no batch. */
  const [batchFetchedAt, setBatchFetchedAt] = useState(initialSnapshot?.fetchedAt ?? null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await fetchAdminJobs();
        if (!ignore) {
          setExistingJobs(data);
        }
      } catch {
        /* slug dedup still works with empty set */
      } finally {
        if (!ignore) {
          setJobsLoading(false);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // Persist the working batch on every relevant state change (debounced).
  // When the batch is empty AND there's no payload, drop the snapshot
  // entirely so we don't leave stale data behind.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const isEmpty = reviewJobs.length === 0 && !fetchPayload;
      if (isEmpty) {
        clearAdminFetchSnapshot();
        if (batchFetchedAt !== null) setBatchFetchedAt(null);
        return;
      }
      saveAdminFetchSnapshot({
        fetchedAt: batchFetchedAt ?? Date.now(),
        activeSource,
        fetchPayload,
        reviewJobs,
        skippedKeys: Array.from(skippedKeys),
        importErrors,
        seoErrors,
        linkedInPostPreset,
        linkedInCustomSearchUrl,
      });
    }, PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [
    activeSource,
    batchFetchedAt,
    fetchPayload,
    reviewJobs,
    skippedKeys,
    importErrors,
    seoErrors,
    linkedInPostPreset,
    linkedInCustomSearchUrl,
  ]);

  const existingSlugs = useMemo(
    () => new Set(existingJobs.map((job) => String(job.slug || '').toLowerCase()).filter(Boolean)),
    [existingJobs],
  );

  const existingApplyLinks = useMemo(
    () => new Set(existingJobs.map((job) => String(job.apply_link || '').toLowerCase()).filter(Boolean)),
    [existingJobs],
  );

  const visibleReviewJobs = useMemo(
    () => reviewJobs.filter((job) => !skippedKeys.has(getExternalJobKey(job))),
    [reviewJobs, skippedKeys],
  );

  const fetchJson = useMemo(() => {
    if (!fetchPayload) {
      return '';
    }
    try {
      return JSON.stringify(fetchPayload, null, 2);
    } catch {
      return '';
    }
  }, [fetchPayload]);

  const handleFetch = async (sourceId) => {
    if (sourceId === 'linkedin_posts' && linkedInPostPreset === 'custom' && !linkedInCustomSearchUrl.trim()) {
      setFetchError('Paste a LinkedIn content search URL (past 24h) or choose another preset.');
      return;
    }

    setFetchError('');
    setNotice('');
    setActiveSource(sourceId);
    setFetchLoading(true);
    try {
      const fetchOptions =
        sourceId === 'linkedin_posts'
          ? {
              preset: linkedInPostPreset,
              customSearchUrl: linkedInCustomSearchUrl,
            }
          : {};
      const data = await fetchExternalJobsBySource(session?.access_token, sourceId, fetchOptions);
      setFetchPayload(data);
      setReviewJobs(
        Array.isArray(data.jobs)
          ? data.jobs.map((job) => ({ ...job, seo_optimized: Boolean(job.seo_optimized) }))
          : [],
      );
      setSkippedKeys(new Set());
      setImportErrors({});
      setSeoErrors({});
      // Mark the batch with a fresh timestamp — overrides any restored value
      // so the "Restored from..." banner doesn't keep showing on a brand-new fetch.
      setBatchFetchedAt(Date.now());
    } catch (error) {
      setFetchPayload(null);
      setReviewJobs([]);
      setBatchFetchedAt(null);
      setFetchError(error instanceof Error ? error.message : 'Fetch failed.');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleClearBatch = () => {
    if (reviewJobs.length === 0 && !fetchPayload) return;
    const ok = window.confirm(
      'Discard the current fetched batch?\n\nAny un-published jobs in this list will be lost. ' +
        'Already-published jobs are NOT affected.',
    );
    if (!ok) return;
    setReviewJobs([]);
    setFetchPayload(null);
    setSkippedKeys(new Set());
    setImportErrors({});
    setSeoErrors({});
    setActiveSource(null);
    setBatchFetchedAt(null);
    setNotice('Cleared the working batch.');
    clearAdminFetchSnapshot();
  };

  const removeReviewJob = (job) => {
    const key = getExternalJobKey(job);
    const sourceUrl = String(job.source_url || '').toLowerCase();
    setReviewJobs((current) =>
      current.filter((item) => {
        if (sourceUrl && String(item.source_url || '').toLowerCase() === sourceUrl) {
          return false;
        }
        return getExternalJobKey(item) !== key;
      }),
    );
  };

  const handleSkip = (job) => {
    setSkippedKeys((current) => new Set(current).add(getExternalJobKey(job)));
    setNotice('Job skipped from this batch.');
  };

  const clearKeyedError = (errors, job) => {
    const key = getExternalJobKey(job);
    const sourceUrl = String(job.source_url || '').toLowerCase();
    const next = { ...errors };
    delete next[key];
    if (sourceUrl) {
      for (const k of Object.keys(next)) {
        if (k === sourceUrl || k.includes(sourceUrl) || sourceUrl.includes(k)) {
          delete next[k];
        }
      }
    }
    return next;
  };

  const handleSeoInstructionsChange = (job, text) => {
    const key = getExternalJobKey(job);
    const sourceUrl = String(job.source_url || '').toLowerCase();
    setReviewJobs((current) =>
      current.map((item) => {
        const match =
          getExternalJobKey(item) === key ||
          (sourceUrl && String(item.source_url || '').toLowerCase() === sourceUrl);
        return match ? { ...item, seo_custom_instructions: text } : item;
      }),
    );
  };

  const handleMakeSeo = async (job) => {
    const key = getExternalJobKey(job);
    const sourceUrl = String(job.source_url || '').toLowerCase();
    setBusySeoKey(key);
    setSeoErrors((current) => clearKeyedError(current, job));
    try {
      const data = await seoOptimizeExternalJob(session?.access_token, job);
      const optimized = data.job;
      if (!optimized) {
        throw new Error('SEO response did not include a job.');
      }
      const matchesJob = (item) =>
        getExternalJobKey(item) === key ||
        (sourceUrl && String(item.source_url || '').toLowerCase() === sourceUrl);
      setReviewJobs((current) =>
        current.map((item) =>
          matchesJob(item)
            ? {
                ...optimized,
                seo_optimized: true,
                seo_show_preview: true,
                seo_custom_instructions:
                  optimized.seo_custom_instructions ?? item.seo_custom_instructions ?? '',
                seo_meta:
                  optimized.seo_meta ??
                  (data.gemini_model || data.runtime_ms
                    ? {
                        gemini_model: data.gemini_model,
                        runtime_ms: data.runtime_ms,
                        seo_profile: data.seo_profile,
                        had_custom_instructions: Boolean(job.seo_custom_instructions?.trim()),
                      }
                    : item.seo_meta),
              }
            : item,
        ),
      );
      setNotice(
        `SEO ready: "${optimized.title}". Review the violet SEO output box below, then publish or add more instructions and Re-run SEO.`,
      );
    } catch (error) {
      setSeoErrors((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : 'SEO optimization failed.',
      }));
    } finally {
      setBusySeoKey('');
    }
  };

  const handleImport = async (job, status) => {
    const key = getExternalJobKey(job);
    setBusyImportKey(key);
    setImportErrors((current) => clearKeyedError(current, job));
    try {
      const saved = await createAdminJob(job, status);
      setExistingJobs((current) => [saved, ...current]);
      removeReviewJob(job);
      const slugNote = saved.slug && saved.slug !== job.slug ? ` (slug: ${saved.slug})` : '';
      setNotice(
        status === 'published'
          ? `"${saved.title}" published${slugNote}.${!job.seo_optimized ? ' Consider Make SEO next time.' : ''}`
          : `"${saved.title}" saved as draft${slugNote}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save.';
      setImportErrors((current) => ({
        ...current,
        [key]: message,
      }));
      setNotice('');
      console.error('Publish/import failed:', message, job);
    } finally {
      setBusyImportKey('');
    }
  };

  // Edit opens the create-job page in a NEW tab so the current fetched-jobs
  // list isn't unmounted (and lost) under the user. Prefill is too large for
  // a query-string, so we stash it in localStorage and pass just a key.
  const handleEditInNewTab = (job) => {
    const prefill = deserializeJobForForm(job);
    const id = stashAdminJobPrefill(prefill);
    const target = id
      ? `/admin/new?prefillKey=${encodeURIComponent(id)}`
      : '/admin/new';
    const url = `${window.location.origin}${target}`;
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      // Popup blocker — fall back to same-tab navigation with router state so
      // the edit at least still works (state is lost, but the user can press
      // Back to recover).
      navigate('/admin/new', { state: { prefill } });
    }
  };

  const handleBulkImport = async (selectedJobs, status) => {
    let ok = 0;
    let fail = 0;
    const imported = [];
    await runWithConcurrency(selectedJobs, BULK_IMPORT_CONCURRENCY, async (job) => {
      const key = getExternalJobKey(job);
      try {
        const saved = await createAdminJob(job, status);
        setExistingJobs((current) => [saved, ...current]);
        imported.push(key);
        ok += 1;
      } catch (error) {
        fail += 1;
        setImportErrors((current) => ({
          ...current,
          [key]: error instanceof Error ? error.message : 'Could not save.',
        }));
      }
    });
    if (imported.length > 0) {
      const keys = new Set(imported);
      setReviewJobs((current) => current.filter((item) => !keys.has(getExternalJobKey(item))));
    }
    if (ok > 0) {
      setNotice(`${status === 'published' ? 'Published' : 'Saved'} ${ok} job(s)${fail ? `; ${fail} failed.` : '.'}`);
    }
  };

  const activeMeta = EXTERNAL_FETCH_SOURCES.find((s) => s.id === activeSource);
  const hasBatch = reviewJobs.length > 0 || Boolean(fetchPayload);
  const showRestoredBanner =
    hasBatch &&
    batchFetchedAt !== null &&
    Date.now() - batchFetchedAt > RESTORED_BANNER_GRACE_MS;

  return (
    <AdminShell
      title="Fetch external jobs"
      description="Run one source at a time. Use separate API keys in Supabase secrets to spread load (see hints on each card)."
    >
      <SEO
        title="Fetch external jobs | Vizag Jobs Admin"
        description="Fetch jobs from LinkedIn, Naukri, Indeed, and more."
        canonical="/admin/fetch"
      />

      {!session?.access_token ? (
        <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Sign in as admin to fetch listings.
        </p>
      ) : null}

      {showRestoredBanner ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          <div>
            <p className="font-semibold">
              Restored fetched batch from {formatRelativeTime(batchFetchedAt)}
            </p>
            <p className="mt-0.5 text-xs text-violet-700">
              {reviewJobs.length} job{reviewJobs.length === 1 ? '' : 's'} pending review
              {activeMeta ? ` · Source: ${activeMeta.title}` : ''}. Snapshots are kept for up to 24
              hours so you can come back later.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearBatch}
            className="rounded-xl border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 transition hover:border-violet-400 hover:bg-violet-100"
          >
            Clear batch
          </button>
        </div>
      ) : hasBatch ? (
        // Fresh fetch — no "restored" preamble, but expose Clear so admins
        // can wipe the batch without publishing every row first.
        <div className="mb-6 flex flex-wrap items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={handleClearBatch}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            Clear batch
          </button>
        </div>
      ) : null}

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXTERNAL_FETCH_SOURCES.map((source) => {
          const isActive = activeSource === source.id && fetchLoading;
          const isLast = activeSource === source.id && fetchPayload && !fetchLoading;
          const isLinkedInPosts = source.id === 'linkedin_posts';
          const presetMeta = LINKEDIN_POST_PRESET_OPTIONS.find((p) => p.id === linkedInPostPreset);

          if (isLinkedInPosts) {
            return (
              <div
                key={source.id}
                className={`rounded-[1.5rem] border p-5 ${source.accent} ${
                  isLast ? 'ring-2 ring-cyan-500 ring-offset-2' : ''
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{source.providerHint}</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">{source.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{source.description}</p>
                <p className="mt-3 font-mono text-[10px] leading-relaxed text-slate-500">{source.secretHint}</p>
                <label className="mt-4 block text-xs font-semibold text-slate-700" htmlFor="linkedin-post-preset">
                  Search preset
                </label>
                <select
                  id="linkedin-post-preset"
                  value={linkedInPostPreset}
                  disabled={fetchLoading || !session?.access_token}
                  onChange={(e) => setLinkedInPostPreset(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {LINKEDIN_POST_PRESET_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {presetMeta?.description ? (
                  <p className="mt-2 text-xs text-slate-600">{presetMeta.description}</p>
                ) : null}
                {linkedInPostPreset === 'custom' ? (
                  <>
                    <label
                      className="mt-3 block text-xs font-semibold text-slate-700"
                      htmlFor="linkedin-custom-search-url"
                    >
                      LinkedIn content search URL
                    </label>
                    <input
                      id="linkedin-custom-search-url"
                      type="url"
                      value={linkedInCustomSearchUrl}
                      disabled={fetchLoading || !session?.access_token}
                      onChange={(e) => setLinkedInCustomSearchUrl(e.target.value)}
                      placeholder="https://www.linkedin.com/search/results/content/?keywords=..."
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900"
                    />
                  </>
                ) : null}
                <button
                  type="button"
                  disabled={!isSupabaseConfigured || fetchLoading || !session?.access_token}
                  onClick={() => handleFetch(source.id)}
                  className="mt-4 text-sm font-semibold text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isActive ? 'Fetching…' : 'Fetch LinkedIn posts →'}
                </button>
              </div>
            );
          }

          return (
            <button
              key={source.id}
              type="button"
              disabled={!isSupabaseConfigured || fetchLoading || !session?.access_token}
              onClick={() => handleFetch(source.id)}
              className={`rounded-[1.5rem] border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${source.accent} ${
                isLast ? 'ring-2 ring-cyan-500 ring-offset-2' : ''
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{source.providerHint}</p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">{source.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{source.description}</p>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-slate-500">{source.secretHint}</p>
              <p className="mt-4 text-sm font-semibold text-cyan-700">
                {isActive ? 'Fetching…' : 'Fetch this source only →'}
              </p>
            </button>
          );
        })}
      </section>

      {fetchError ? (
        <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {fetchError}
        </p>
      ) : null}

      {fetchPayload?.linkedin_fetch_warning ? (
        <p className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          {fetchPayload.linkedin_fetch_warning}
        </p>
      ) : null}

      {fetchPayload?.naukri_fetch_warning ? (
        <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {fetchPayload.naukri_fetch_warning}
        </p>
      ) : null}

      {notice ? (
        <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}

      {fetchPayload?.summary ? (
        <FetchSummaryBar payload={fetchPayload} activeMeta={activeMeta} />
      ) : null}

      {jobsLoading ? (
        <div className="my-6">
          <LoadingSpinner message="Loading existing jobs for duplicate check…" />
        </div>
      ) : null}

      <ExternalJobReviewPanel
        jobs={visibleReviewJobs}
        existingSlugs={existingSlugs}
        existingApplyLinks={existingApplyLinks}
        busyImportKey={busyImportKey}
        busySeoKey={busySeoKey}
        importErrors={importErrors}
        seoErrors={seoErrors}
        onMakeSeo={handleMakeSeo}
        onSeoInstructionsChange={handleSeoInstructionsChange}
        onPublish={(job) => handleImport(job, 'published')}
        onSaveDraft={(job) => handleImport(job, 'draft')}
        onSkip={handleSkip}
        onEdit={handleEditInNewTab}
        onBulkPublish={(selected) => handleBulkImport(selected, 'published')}
        onBulkSaveDraft={(selected) => handleBulkImport(selected, 'draft')}
      />

      {fetchJson ? (
        <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Raw JSON response</summary>
          <pre className="mt-3 max-h-[24rem] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-emerald-100">
            {fetchJson}
          </pre>
        </details>
      ) : null}
    </AdminShell>
  );
}

function FetchSummaryBar({ payload, activeMeta }) {
  return (
    <div className="mb-6 flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
      {activeMeta ? (
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-900">
          Source: {activeMeta.title}
        </span>
      ) : null}
      {payload.fetch_channel_label ? (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
          Channel: {payload.fetch_channel_label}
        </span>
      ) : null}
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
        Jobs: {Array.isArray(payload.jobs) ? payload.jobs.length : 0}
      </span>
      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
        Provider: {payload.provider_used}
      </span>
      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
        24h: {payload.summary?.with_posted_at_within_24h ?? 0}
      </span>
      {payload.parser_version ? (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
          Parser: {payload.parser_version}
        </span>
      ) : null}
      {payload.filters_applied?.linkedin_post_preset_label ? (
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-900">
          Preset: {payload.filters_applied.linkedin_post_preset_label}
        </span>
      ) : null}
    </div>
  );
}
