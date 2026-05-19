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

const BULK_IMPORT_CONCURRENCY = 3;

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
  const [existingJobs, setExistingJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [activeSource, setActiveSource] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetchPayload, setFetchPayload] = useState(null);
  const [notice, setNotice] = useState('');
  const [reviewJobs, setReviewJobs] = useState([]);
  const [skippedKeys, setSkippedKeys] = useState(() => new Set());
  const [busyImportKey, setBusyImportKey] = useState('');
  const [busySeoKey, setBusySeoKey] = useState('');
  const [importErrors, setImportErrors] = useState({});
  const [seoErrors, setSeoErrors] = useState({});

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
    setFetchError('');
    setNotice('');
    setActiveSource(sourceId);
    setFetchLoading(true);
    try {
      const data = await fetchExternalJobsBySource(session?.access_token, sourceId);
      setFetchPayload(data);
      setReviewJobs(
        Array.isArray(data.jobs)
          ? data.jobs.map((job) => ({ ...job, seo_optimized: Boolean(job.seo_optimized) }))
          : [],
      );
      setSkippedKeys(new Set());
      setImportErrors({});
      setSeoErrors({});
    } catch (error) {
      setFetchPayload(null);
      setReviewJobs([]);
      setFetchError(error instanceof Error ? error.message : 'Fetch failed.');
    } finally {
      setFetchLoading(false);
    }
  };

  const removeReviewJob = (job) => {
    const key = getExternalJobKey(job);
    setReviewJobs((current) => current.filter((item) => getExternalJobKey(item) !== key));
  };

  const handleSkip = (job) => {
    setSkippedKeys((current) => new Set(current).add(getExternalJobKey(job)));
    setNotice('Job skipped from this batch.');
  };

  const handleMakeSeo = async (job) => {
    const key = getExternalJobKey(job);
    setBusySeoKey(key);
    setSeoErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    try {
      const data = await seoOptimizeExternalJob(session?.access_token, job, job.seo_source_context);
      const optimized = data.job;
      if (!optimized) {
        throw new Error('SEO response did not include a job.');
      }
      setReviewJobs((current) =>
        current.map((item) =>
          getExternalJobKey(item) === key ? { ...optimized, seo_optimized: true } : item,
        ),
      );
      setNotice(`SEO optimized: "${optimized.title}".`);
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
    setImportErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    try {
      const saved = await createAdminJob(job, status);
      setExistingJobs((current) => [saved, ...current]);
      removeReviewJob(job);
      setNotice(
        status === 'published'
          ? `"${saved.title}" published.${!job.seo_optimized ? ' Consider Make SEO next time.' : ''}`
          : `"${saved.title}" saved as draft.`,
      );
    } catch (error) {
      setImportErrors((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : 'Could not save.',
      }));
    } finally {
      setBusyImportKey('');
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

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXTERNAL_FETCH_SOURCES.map((source) => {
          const isActive = activeSource === source.id && fetchLoading;
          const isLast = activeSource === source.id && fetchPayload && !fetchLoading;
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
        onPublish={(job) => handleImport(job, 'published')}
        onSaveDraft={(job) => handleImport(job, 'draft')}
        onSkip={handleSkip}
        onEdit={(job) => navigate('/admin/new', { state: { prefill: deserializeJobForForm(job) } })}
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
    </div>
  );
}
