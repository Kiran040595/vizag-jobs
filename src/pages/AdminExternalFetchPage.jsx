import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import { useAdminAuth } from '../hooks/useAdminAuth';
import ExternalSourceAutomationActions from '../components/admin/ExternalSourceAutomationActions';
import NaukriAutomationReportPanel from '../components/admin/NaukriAutomationReportPanel';
import ExternalJobReviewPanel, { getExternalJobKey } from '../components/admin/ExternalJobReviewPanel';
import { createAdminJob, deserializeJobForForm, fetchAdminJobs } from '../services/adminJobs';
import {
  collectNaukriApifyFetch,
  fetchExternalJobsBySource,
  fetchSeoGeminiKeys,
  NAUKRI_ASYNC_COLLECT_WAIT_MS,
  seoOptimizeExternalJob,
  startNaukriApifyFetch,
} from '../services/externalJobFetch';
import { formatGeminiKeyUsage, geminiKeyFieldsFromSeoResponse } from '../lib/formatGeminiKeyUsage';
import { buildAutomationConfirmMessage } from '../lib/automationChannels';
import {
  AUTOMATION_SEO_GAP_MS,
  runExternalFetchAutomationPipeline,
} from '../lib/externalFetchAutomation';
import {
  clearAutomationReport,
  loadAutomationReport,
  saveAutomationReport,
} from '../lib/naukriAutomationReport';
import { sendAutomationSummaryEmail } from '../lib/automationEmail';
import { parseGeminiSeoKeySelectValue } from '../lib/geminiSeoKeyOptions';
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
const NAUKRI_COLLECT_MAX_ATTEMPTS = 24;

const formatCountdown = (totalSec) => {
  const sec = Math.max(0, totalSec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const [seoGeminiKeysStandard, setSeoGeminiKeysStandard] = useState([]);
  const [seoGeminiKeysLinkedIn, setSeoGeminiKeysLinkedIn] = useState([]);
  const [seoKeyIndexByJob, setSeoKeyIndexByJob] = useState(
    () => initialSnapshot?.seoKeyIndexByJob ?? {},
  );
  const [linkedInPostPreset, setLinkedInPostPreset] = useState(
    initialSnapshot?.linkedInPostPreset ?? 'general',
  );
  const [linkedInCustomSearchUrl, setLinkedInCustomSearchUrl] = useState(
    initialSnapshot?.linkedInCustomSearchUrl ?? '',
  );
  /** Timestamp of the active batch (when it was first fetched). null = no batch. */
  const [batchFetchedAt, setBatchFetchedAt] = useState(initialSnapshot?.fetchedAt ?? null);
  const [naukriPending, setNaukriPending] = useState(() => {
    const pending = initialSnapshot?.naukriPending;
    if (!pending?.runId || !pending?.readyAt) return null;
    if (Date.now() > pending.readyAt + 30 * 60_000) return null;
    return pending;
  });
  const [naukriCountdownSec, setNaukriCountdownSec] = useState(() => {
    const readyAt = initialSnapshot?.naukriPending?.readyAt;
    if (!readyAt) return 0;
    return Math.max(0, Math.ceil((readyAt - Date.now()) / 1000));
  });
  const [naukriCollecting, setNaukriCollecting] = useState(false);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationChannel, setAutomationChannel] = useState(null);
  const [automationProgress, setAutomationProgress] = useState(null);
  const [automationReport, setAutomationReport] = useState(() => loadAutomationReport());
  const naukriAutoCollectStarted = useRef(false);
  const automationAbortRef = useRef(null);

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

  useEffect(() => {
    let ignore = false;
    if (!session?.access_token) {
      return undefined;
    }
    (async () => {
      try {
        const [standard, linkedIn] = await Promise.all([
          fetchSeoGeminiKeys(session.access_token, { linkedInPost: false }),
          fetchSeoGeminiKeys(session.access_token, { linkedInPost: true }),
        ]);
        if (ignore) return;
        setSeoGeminiKeysStandard(standard.keys);
        setSeoGeminiKeysLinkedIn(linkedIn.keys);
      } catch {
        if (!ignore) {
          setSeoGeminiKeysStandard([]);
          setSeoGeminiKeysLinkedIn([]);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [session?.access_token]);

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
        seoKeyIndexByJob,
        linkedInPostPreset,
        linkedInCustomSearchUrl,
        naukriPending,
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
    seoKeyIndexByJob,
    linkedInPostPreset,
    linkedInCustomSearchUrl,
    naukriPending,
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

  const applyFetchPayload = (data) => {
    setFetchPayload(data);
    setReviewJobs(
      Array.isArray(data.jobs)
        ? data.jobs.map((job) => ({ ...job, seo_optimized: Boolean(job.seo_optimized) }))
        : [],
    );
    setSkippedKeys(new Set());
    setImportErrors({});
    setSeoErrors({});
    setBatchFetchedAt(Date.now());
  };

  const collectNaukriResults = async (runId) => {
    if (!runId || !session?.access_token) return;
    setNaukriCollecting(true);
    setFetchError('');
    try {
      for (let attempt = 0; attempt < NAUKRI_COLLECT_MAX_ATTEMPTS; attempt += 1) {
        const data = await collectNaukriApifyFetch(session.access_token, runId);
        if (data.naukri_action === 'pending' || (Array.isArray(data.jobs) && data.jobs.length === 0 && data.retry_after_sec)) {
          const waitMs = (data.retry_after_sec ?? 15) * 1000;
          setNotice(`Apify still running… retrying in ${Math.round(waitMs / 1000)}s`);
          await sleepMs(waitMs);
          continue;
        }
        applyFetchPayload(data);
        setNaukriPending(null);
        setNaukriCountdownSec(0);
        setActiveSource('naukri');
        setNotice(
          typeof data.message === 'string'
            ? data.message
            : `Loaded ${data.jobs?.length ?? 0} Naukri job(s).`,
        );
        return;
      }
      setFetchError('Apify run did not finish in time. Check the Apify console and try Load results again.');
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Failed to collect Naukri results.');
    } finally {
      setNaukriCollecting(false);
      naukriAutoCollectStarted.current = false;
    }
  };

  useEffect(() => {
    if (!naukriPending?.readyAt) return undefined;
    const tick = () => {
      setNaukriCountdownSec(Math.max(0, Math.ceil((naukriPending.readyAt - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [naukriPending]);

  useEffect(() => {
    if (!naukriPending?.runId) return;
    if (naukriCountdownSec > 0) return;
    if (naukriCollecting || naukriAutoCollectStarted.current) return;
    naukriAutoCollectStarted.current = true;
    collectNaukriResults(naukriPending.runId);
  }, [naukriPending, naukriCountdownSec, naukriCollecting]);

  const handleCancelAutomation = () => {
    automationAbortRef.current?.abort();
    setNotice('Stopping automation…');
  };

  const handleStartChannelAutomation = async (channel, fetchOptions = {}) => {
    if (!session?.access_token || automationRunning) {
      return;
    }

    if (channel === 'linkedin_posts' && fetchOptions.preset === 'custom' && !fetchOptions.customSearchUrl?.trim()) {
      setFetchError('Paste a LinkedIn content search URL (past 24h) or choose another preset.');
      return;
    }

    const confirmed = window.confirm(buildAutomationConfirmMessage(channel, AUTOMATION_SEO_GAP_MS));
    if (!confirmed) {
      return;
    }

    const controller = new AbortController();
    automationAbortRef.current = controller;
    setAutomationRunning(true);
    setAutomationChannel(channel);
    setAutomationProgress({ phase: 'fetching', message: `Starting ${channel} automation…`, channel });
    setFetchError('');
    setNotice('');
    setActiveSource(channel);
    if (channel === 'naukri') {
      naukriAutoCollectStarted.current = false;
      setNaukriPending(null);
      setNaukriCountdownSec(0);
    }

    const updateSeoJobInReview = (job) => {
      const key = getExternalJobKey(job);
      const sourceUrl = String(job.source_url || '').toLowerCase();
      setReviewJobs((current) => {
        const exists = current.some(
          (item) =>
            getExternalJobKey(item) === key ||
            (sourceUrl && String(item.source_url || '').toLowerCase() === sourceUrl),
        );
        if (exists) {
          return current.map((item) =>
            getExternalJobKey(item) === key ||
            (sourceUrl && String(item.source_url || '').toLowerCase() === sourceUrl)
              ? job
              : item,
          );
        }
        return [job, ...current];
      });
    };

    try {
      const { stats, report } = await runExternalFetchAutomationPipeline({
        channel,
        fetchOptions,
        accessToken: session.access_token,
        existingSlugs,
        existingApplyLinks,
        signal: controller.signal,
        onProgress: setAutomationProgress,
        onReportUpdate: (nextReport) => {
          setAutomationReport(nextReport);
          saveAutomationReport(nextReport);
        },
        onFetchComplete: applyFetchPayload,
        onJobUpdated: updateSeoJobInReview,
        onJobPublished: (saved) => {
          setExistingJobs((current) => [saved, ...current]);
        },
        onJobRemoved: removeReviewJob,
      });

      setAutomationReport(report);
      saveAutomationReport(report);

      const emailNote = await emailReportAfterRun(report);

      setNotice(
        `${report.channelLabel || channel} automation complete: fetched ${stats.fetched}, queued ${stats.queued}, published ${stats.published}, skipped ${stats.skippedPreSeo + stats.skippedPostSeo + stats.skippedBatchDuplicate}, failed ${stats.seoFailed + stats.publishFailed}. See report below.${emailNote}`,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        const partialReport = loadAutomationReport();
        const emailNote = partialReport ? await emailReportAfterRun(partialReport) : '';
        setNotice(`Automation cancelled. See report below for jobs processed so far.${emailNote}`);
      } else {
        setFetchError(error instanceof Error ? error.message : 'Automation failed.');
      }
    } finally {
      setAutomationRunning(false);
      setAutomationChannel(null);
      setAutomationProgress(null);
      automationAbortRef.current = null;
    }
  };


  const handleClearAutomationReport = () => {
    clearAutomationReport();
    setAutomationReport(null);
    setNotice('Automation report cleared.');
  };

  const persistReportWithEmail = (report, emailSummary) => {
    const next = { ...report, emailSummary };
    setAutomationReport(next);
    saveAutomationReport(next);
    return next;
  };

  const handleSendReportEmail = async (report) => {
    if (!session?.access_token) {
      throw new Error('Sign in as admin to send email.');
    }
    try {
      const emailResult = await sendAutomationSummaryEmail(session.access_token, report);
      persistReportWithEmail(report, {
        to: emailResult.to,
        sentAt: new Date().toISOString(),
        subject: emailResult.subject,
        error: null,
      });
      setNotice(`Report emailed to ${emailResult.to}. You can also download JSON or CSV below.`);
      return emailResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email failed.';
      persistReportWithEmail(report, {
        to: null,
        sentAt: null,
        error: message,
      });
      throw error;
    }
  };

  const emailReportAfterRun = async (report) => {
    try {
      const emailResult = await handleSendReportEmail(report);
      return ` Summary emailed to ${emailResult.to}.`;
    } catch (emailError) {
      return ` Email not sent: ${emailError instanceof Error ? emailError.message : 'unknown error'}. Download the report below.`;
    }
  };

  const handleNaukriStart = async () => {
    setFetchError('');
    setNotice('');
    setActiveSource('naukri');
    naukriAutoCollectStarted.current = false;
    setFetchLoading(true);
    try {
      const data = await startNaukriApifyFetch(session?.access_token);
      const waitMs = Number(data.collect_after_ms) || NAUKRI_ASYNC_COLLECT_WAIT_MS;
      const readyAt = Date.now() + waitMs;
      setNaukriPending({
        runId: data.apify_naukri_run_id,
        readyAt,
        startedAt: Date.now(),
      });
      setNaukriCountdownSec(Math.ceil(waitMs / 1000));
      setFetchPayload(null);
      setReviewJobs([]);
      setNotice(
        data.message ||
          `Apify scrape started. Results in about ${Math.round(waitMs / 60_000)} minutes.`,
      );
    } catch (error) {
      setNaukriPending(null);
      setNaukriCountdownSec(0);
      setFetchError(error instanceof Error ? error.message : 'Failed to start Naukri scrape.');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleFetch = async (sourceId) => {
    if (sourceId === 'naukri') {
      await handleNaukriStart();
      return;
    }

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
      applyFetchPayload(data);
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
    setNaukriPending(null);
    setNaukriCountdownSec(0);
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

  const handleSeoKeyIndexChange = (job, value) => {
    const key = getExternalJobKey(job);
    const index = parseGeminiSeoKeySelectValue(value);
    setSeoKeyIndexByJob((current) => ({
      ...current,
      [key]: index,
    }));
  };

  const handleMakeSeo = async (job) => {
    const key = getExternalJobKey(job);
    const sourceUrl = String(job.source_url || '').toLowerCase();
    const selectedKeyIndex = seoKeyIndexByJob[key] ?? 0;
    setBusySeoKey(key);
    setSeoErrors((current) => clearKeyedError(current, job));
    try {
      const data = await seoOptimizeExternalJob(session?.access_token, job, '', {
        geminiKeyIndex: selectedKeyIndex > 0 ? selectedKeyIndex : undefined,
      });
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
                seo_meta: {
                  ...(optimized.seo_meta && typeof optimized.seo_meta === 'object' ? optimized.seo_meta : {}),
                  ...(geminiKeyFieldsFromSeoResponse(data) ?? {}),
                  ...(data.gemini_model || data.runtime_ms
                    ? {
                        gemini_model: data.gemini_model ?? optimized.seo_meta?.gemini_model,
                        runtime_ms: data.runtime_ms ?? optimized.seo_meta?.runtime_ms,
                        seo_profile: data.seo_profile ?? optimized.seo_meta?.seo_profile,
                        had_custom_instructions: Boolean(job.seo_custom_instructions?.trim()),
                      }
                    : {}),
                },
              }
            : item,
        ),
      );
      setNotice(
        `SEO ready: "${optimized.title}". ${formatGeminiKeyUsage(optimized.seo_meta) ? `Used ${formatGeminiKeyUsage(optimized.seo_meta)}. ` : ''}Review the violet SEO output box below, then publish or add more instructions and Re-run SEO.`,
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

      {automationRunning && automationProgress ? (
        <div className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">
                {automationProgress?.channel === 'linkedin_jobs'
                  ? 'LinkedIn Jobs automation running'
                  : automationProgress?.channel === 'linkedin_posts'
                    ? 'LinkedIn Posts automation running'
                    : 'Naukri automation running'}
              </p>
              <p className="mt-2 text-emerald-900">{automationProgress.message}</p>
              {automationProgress.phase === 'waiting' || automationProgress.phase === 'seo_gap' ? (
                <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-emerald-800">
                  {formatCountdown(automationProgress.waitSec ?? 0)}
                </p>
              ) : null}
              {automationProgress.total ? (
                <p className="mt-2 text-xs text-emerald-800">
                  Progress: {automationProgress.current ?? 0} / {automationProgress.total}
                  {automationProgress.stats
                    ? ` · Published ${automationProgress.stats.published ?? 0}`
                    : ''}
                </p>
              ) : null}
              {automationProgress.runId ? (
                <p className="mt-2 text-xs text-emerald-700">
                  Apify run: <span className="font-mono">{automationProgress.runId}</span>
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleCancelAutomation}
              className="rounded-xl border border-emerald-400 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
            >
              Stop automation
            </button>
          </div>
        </div>
      ) : null}

      {naukriPending ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
          <p className="font-semibold">Naukri scrape running on Apify</p>
          {naukriCountdownSec > 0 ? (
            <p className="mt-2 text-amber-900">
              Check back in{' '}
              <span className="font-mono text-2xl font-bold tabular-nums">
                {formatCountdown(naukriCountdownSec)}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-amber-900">
              {naukriCollecting ? 'Loading results from Apify…' : 'Timer finished — collecting jobs…'}
            </p>
          )}
          <p className="mt-2 text-xs text-amber-800">
            Run ID: <span className="font-mono">{naukriPending.runId}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={naukriCollecting || !session?.access_token}
              onClick={() => collectNaukriResults(naukriPending.runId)}
              className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
            >
              {naukriCollecting ? 'Loading…' : 'Load results now'}
            </button>
            <button
              type="button"
              disabled={naukriCollecting}
              onClick={() => {
                setNaukriPending(null);
                setNaukriCountdownSec(0);
                naukriAutoCollectStarted.current = false;
                setNotice('Cancelled Naukri wait timer.');
              }}
              className="rounded-xl border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100/80"
            >
              Cancel wait
            </button>
          </div>
        </div>
      ) : null}

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXTERNAL_FETCH_SOURCES.map((source) => {
          const isActive = activeSource === source.id && (fetchLoading || (source.id === 'naukri' && naukriCollecting));
          const isNaukriWaiting = source.id === 'naukri' && Boolean(naukriPending);
          const isLast = activeSource === source.id && fetchPayload && !fetchLoading && !naukriCollecting;
          const isLinkedInPosts = source.id === 'linkedin_posts';
          const isNaukri = source.id === 'naukri';
          const isLinkedInJobs = source.id === 'linkedin_jobs';
          const supportsAutomation = isNaukri || isLinkedInJobs || isLinkedInPosts;
          const presetMeta = LINKEDIN_POST_PRESET_OPTIONS.find((p) => p.id === linkedInPostPreset);
          const fetchDisabled =
            !isSupabaseConfigured ||
            fetchLoading ||
            naukriCollecting ||
            isNaukriWaiting ||
            automationRunning ||
            !session?.access_token;

          if (supportsAutomation) {
            const fetchOnlyBusy =
              fetchLoading && activeSource === source.id && !(isNaukri && naukriPending);
            const fetchOnlyLabel = isNaukri
              ? fetchLoading && activeSource === 'naukri'
                ? 'Starting Apify…'
                : isNaukriWaiting
                  ? `Waiting ${formatCountdown(naukriCountdownSec)}…`
                  : 'Fetch only (manual review) →'
              : fetchOnlyBusy
                ? 'Fetching…'
                : 'Fetch only (manual review) →';

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

                {isLinkedInPosts ? (
                  <>
                    <label className="mt-4 block text-xs font-semibold text-slate-700" htmlFor="linkedin-post-preset">
                      Search preset
                    </label>
                    <select
                      id="linkedin-post-preset"
                      value={linkedInPostPreset}
                      disabled={fetchDisabled}
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
                          disabled={fetchDisabled}
                          onChange={(e) => setLinkedInCustomSearchUrl(e.target.value)}
                          placeholder="https://www.linkedin.com/search/results/content/?keywords=..."
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900"
                        />
                      </>
                    ) : null}
                  </>
                ) : null}

                <ExternalSourceAutomationActions
                  fetchDisabled={fetchDisabled}
                  fetchOnlyBusy={fetchOnlyBusy}
                  fetchOnlyLabel={fetchOnlyLabel}
                  onFetchOnly={() => handleFetch(source.id)}
                  onStartAutomation={() =>
                    handleStartChannelAutomation(
                      source.id,
                      isLinkedInPosts
                        ? {
                            preset: linkedInPostPreset,
                            customSearchUrl: linkedInCustomSearchUrl,
                          }
                        : {},
                    )
                  }
                  automationRunning={automationRunning}
                  activeAutomationChannel={automationChannel}
                  channelId={source.id}
                />
              </div>
            );
          }

          return (
            <button
              key={source.id}
              type="button"
              disabled={fetchDisabled}
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
                {isActive
                  ? source.id === 'naukri'
                    ? 'Starting Apify…'
                    : 'Fetching…'
                  : isNaukriWaiting
                    ? `Waiting ${formatCountdown(naukriCountdownSec)}…`
                    : 'Fetch this source only →'}
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

      <NaukriAutomationReportPanel
        report={automationReport}
        onClear={handleClearAutomationReport}
        onSendEmail={session?.access_token ? handleSendReportEmail : null}
        emailSummary={automationReport?.emailSummary}
      />

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
        seoGeminiKeysStandard={seoGeminiKeysStandard}
        seoGeminiKeysLinkedIn={seoGeminiKeysLinkedIn}
        seoKeyIndexByJob={seoKeyIndexByJob}
        onMakeSeo={handleMakeSeo}
        onSeoInstructionsChange={handleSeoInstructionsChange}
        onSeoKeyIndexChange={handleSeoKeyIndexChange}
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
