import { getExternalJobKey } from '../components/admin/ExternalJobReviewPanel';
import { createAdminJob } from '../services/adminJobs';
import {
  collectNaukriApifyFetch,
  fetchExternalJobsBySource,
  NAUKRI_ASYNC_COLLECT_WAIT_MS,
  seoOptimizeExternalJob,
  startNaukriApifyFetch,
} from '../services/externalJobFetch';
import { getAutomationChannelMeta } from './automationChannels';
import { geminiKeyFieldsFromSeoResponse } from './formatGeminiKeyUsage';
import {
  getJobPublishBlockReason,
  recoverPublishableFieldsFromOriginal,
} from './jobPublishQuality.js';
import { createEmptyAutomationReport } from './naukriAutomationReport';

/** Gap between Make SEO calls during automation. */
export const AUTOMATION_SEO_GAP_MS = 3 * 60 * 1000;
export const NAUKRI_AUTOMATION_SEO_GAP_MS = AUTOMATION_SEO_GAP_MS;

const FETCH_TIMEOUT_MS = 150_000;
const INVALID_APPLY_TOKENS = /^(null|undefined|none|n\/a|na)$/i;

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function resolveJobApplyLink(job) {
  let apply = String(job?.apply_link || '').trim();
  if (!apply || INVALID_APPLY_TOKENS.test(apply)) {
    apply = String(job?.source_url || '').trim();
  }
  return !apply || INVALID_APPLY_TOKENS.test(apply) ? '' : apply;
}

export function shouldSkipAutomationJob(job, existingSlugs, existingApplyLinks) {
  const apply = resolveJobApplyLink(job).toLowerCase();
  if (!apply) {
    return { skip: true, reason: 'missing apply link' };
  }

  const slug = String(job?.slug || '').toLowerCase();
  if (slug && existingSlugs.has(slug)) {
    return { skip: true, reason: 'slug already in database' };
  }

  if (existingApplyLinks.has(apply)) {
    return { skip: true, reason: 'apply link already in database' };
  }

  if (!String(job?.title || '').trim() || !String(job?.company || '').trim()) {
    return { skip: true, reason: 'missing title or company' };
  }

  const qualityReason = getJobPublishBlockReason(job);
  if (qualityReason) {
    return { skip: true, reason: qualityReason };
  }

  return { skip: false, reason: '' };
}

export const shouldSkipNaukriAutomationJob = shouldSkipAutomationJob;

function buildJobEntry(job, status, extra = {}) {
  return {
    key: getExternalJobKey(job),
    title: String(job?.title || '').trim(),
    company: String(job?.company || '').trim(),
    applyLink: resolveJobApplyLink(job),
    sourceUrl: String(job?.source_url || '').trim(),
    status,
    reason: extra.reason || '',
    publishedSlug: extra.publishedSlug || '',
    error: extra.error || '',
  };
}

function mergeSeoJob(job, data) {
  const optimized = data.job;
  if (!optimized) {
    throw new Error('SEO response did not include a job.');
  }

  return {
    ...optimized,
    seo_optimized: true,
    seo_show_preview: true,
    seo_custom_instructions: optimized.seo_custom_instructions ?? job.seo_custom_instructions ?? '',
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
  };
}

async function collectNaukriJobs(accessToken, { collectMaxAttempts, onProgress, signal, report }) {
  const started = await startNaukriApifyFetch(accessToken);
  if (signal?.aborted) {
    throw new DOMException('Automation cancelled.', 'AbortError');
  }

  const runId = started.apify_naukri_run_id;
  if (!runId) {
    throw new Error('Naukri Apify run id missing from start response.');
  }

  report.apifyRunId = runId;

  const waitMs = Number(started.collect_after_ms) || NAUKRI_ASYNC_COLLECT_WAIT_MS;
  onProgress?.({
    phase: 'waiting',
    message: `Apify scrape started. Waiting ${Math.round(waitMs / 1000)}s before collecting…`,
    waitSec: Math.ceil(waitMs / 1000),
    runId,
    report,
  });

  const waitEnd = Date.now() + waitMs;
  while (Date.now() < waitEnd) {
    if (signal?.aborted) {
      throw new DOMException('Automation cancelled.', 'AbortError');
    }
    const remainingSec = Math.max(0, Math.ceil((waitEnd - Date.now()) / 1000));
    onProgress?.({
      phase: 'waiting',
      message: 'Waiting for Apify results…',
      waitSec: remainingSec,
      runId,
      report,
    });
    await sleepMs(Math.min(1000, waitEnd - Date.now()));
  }

  for (let attempt = 1; attempt <= collectMaxAttempts; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException('Automation cancelled.', 'AbortError');
    }

    onProgress?.({
      phase: 'collecting',
      message: `Collecting Naukri jobs (attempt ${attempt}/${collectMaxAttempts})…`,
      runId,
      report,
    });

    const data = await collectNaukriApifyFetch(accessToken, runId);
    const pending = data.naukri_action === 'pending';
    const emptyWithRetry = Array.isArray(data.jobs) && data.jobs.length === 0 && data.retry_after_sec;

    if (pending || emptyWithRetry) {
      const retryMs = (Number(data.retry_after_sec) || 15) * 1000;
      onProgress?.({
        phase: 'collecting',
        message: `Apify still running. Retrying in ${Math.round(retryMs / 1000)}s…`,
        runId,
        report,
      });
      await sleepMs(retryMs);
      continue;
    }

    return {
      jobs: Array.isArray(data.jobs) ? data.jobs : [],
      payload: data,
    };
  }

  throw new Error('Naukri Apify run did not finish in time.');
}

async function fetchChannelJobs(accessToken, channel, fetchOptions, callbacks) {
  if (channel === 'naukri') {
    return collectNaukriJobs(accessToken, callbacks);
  }

  const meta = getAutomationChannelMeta(channel);
  callbacks.onProgress?.({
    phase: 'fetching',
    message: `Fetching ${meta.label}…`,
    report: callbacks.report,
  });

  const options = { timeoutMs: FETCH_TIMEOUT_MS };
  if (channel === 'linkedin_posts') {
    options.preset = fetchOptions?.preset || 'general';
    if (options.preset === 'custom') {
      options.customSearchUrl = fetchOptions?.customSearchUrl || '';
      if (!options.customSearchUrl.trim()) {
        throw new Error('Paste a LinkedIn content search URL or choose another preset.');
      }
    }
  }

  const data = await fetchExternalJobsBySource(accessToken, channel, options);
  return {
    jobs: Array.isArray(data.jobs) ? data.jobs : [],
    payload: data,
  };
}

/**
 * Fetch → Make SEO (gaps) → publish for naukri, linkedin_jobs, or linkedin_posts.
 */
export async function runExternalFetchAutomationPipeline({
  channel = 'naukri',
  fetchOptions = {},
  accessToken,
  existingSlugs,
  existingApplyLinks,
  onProgress,
  onFetchComplete,
  onJobUpdated,
  onJobPublished,
  onJobRemoved,
  onReportUpdate,
  signal,
  seoGapMs = AUTOMATION_SEO_GAP_MS,
  collectMaxAttempts = 24,
}) {
  const channelMeta = getAutomationChannelMeta(channel);
  const report = createEmptyAutomationReport(channel, channelMeta.label);
  const slugs = new Set(existingSlugs);
  const applyLinks = new Set(existingApplyLinks);

  const pushReport = () => {
    onReportUpdate?.(structuredClone(report));
  };

  const recordJob = (entry) => {
    const existingIndex = report.jobs.findIndex((item) => item.key === entry.key);
    if (existingIndex >= 0) {
      report.jobs[existingIndex] = entry;
    } else {
      report.jobs.push(entry);
    }
    pushReport();
  };

  onProgress?.({
    phase: 'fetching',
    message: `Starting ${channelMeta.label} automation…`,
    report,
    channel,
  });

  const { jobs: fetchedJobs, payload } = await fetchChannelJobs(accessToken, channel, fetchOptions, {
    collectMaxAttempts,
    onProgress,
    signal,
    report,
  });

  report.stats.fetched = fetchedJobs.length;
  if (fetchOptions?.preset) {
    report.linkedinPostPreset = fetchOptions.preset;
  }
  onFetchComplete?.(payload);
  pushReport();

  const queue = [];
  const seenKeys = new Set();

  for (const job of fetchedJobs) {
    const key = getExternalJobKey(job);
    if (key && seenKeys.has(key)) {
      report.stats.skippedBatchDuplicate += 1;
      recordJob(buildJobEntry(job, 'skipped_batch_duplicate', { reason: 'duplicate in same fetch batch' }));
      continue;
    }
    if (key) seenKeys.add(key);

    const preCheck = shouldSkipAutomationJob(job, slugs, applyLinks);
    if (preCheck.skip) {
      report.stats.skippedPreSeo += 1;
      recordJob(buildJobEntry(job, 'skipped_pre_seo', { reason: preCheck.reason }));
      continue;
    }

    queue.push(job);
  }

  report.stats.queued = queue.length;
  pushReport();

  onProgress?.({
    phase: 'processing',
    message: `${queue.length} job(s) queued for SEO and publish (${report.stats.skippedPreSeo + report.stats.skippedBatchDuplicate} skipped before queue).`,
    current: 0,
    total: queue.length,
    stats: report.stats,
    report,
    channel,
  });

  for (let index = 0; index < queue.length; index += 1) {
    if (signal?.aborted) {
      report.cancelled = true;
      report.finishedAt = new Date().toISOString();
      pushReport();
      throw new DOMException('Automation cancelled.', 'AbortError');
    }

    let job = queue[index];

    if (index > 0) {
      const gapEnd = Date.now() + seoGapMs;
      while (Date.now() < gapEnd) {
        if (signal?.aborted) {
          report.cancelled = true;
          report.finishedAt = new Date().toISOString();
          pushReport();
          throw new DOMException('Automation cancelled.', 'AbortError');
        }
        onProgress?.({
          phase: 'seo_gap',
          message: 'Waiting before next Make SEO…',
          current: index,
          total: queue.length,
          waitSec: Math.max(0, Math.ceil((gapEnd - Date.now()) / 1000)),
          jobTitle: job.title,
          stats: report.stats,
          report,
          channel,
        });
        await sleepMs(Math.min(1000, gapEnd - Date.now()));
      }
    }

    onProgress?.({
      phase: 'seo',
      message: `Make SEO: "${job.title}" at ${job.company}`,
      current: index + 1,
      total: queue.length,
      jobTitle: job.title,
      stats: report.stats,
      report,
      channel,
    });

    try {
      const data = await seoOptimizeExternalJob(accessToken, job, '', {
        onRetry: (info) => {
          onProgress?.({
            phase: 'seo_retry',
            message: `SEO retry in ${Math.round(info.waitMs / 1000)}s with Gemini key ${info.nextKeyIndex > 0 ? `#${info.nextKeyIndex}` : 'auto'} (attempt ${info.attempt}/${info.maxAttempts})…`,
            current: index + 1,
            total: queue.length,
            jobTitle: job.title,
            stats: report.stats,
            report,
            channel,
          });
        },
      });
      const original = job;
      job = recoverPublishableFieldsFromOriginal(original, mergeSeoJob(job, data));
      report.stats.seoOk += 1;
      onJobUpdated?.(job);
    } catch (error) {
      report.stats.seoFailed += 1;
      const message = error instanceof Error ? error.message : String(error);
      recordJob(buildJobEntry(job, 'seo_failed', { error: message, reason: 'Make SEO failed' }));
      onProgress?.({
        phase: 'seo',
        message: `SEO failed for "${job.title}": ${message}`,
        current: index + 1,
        total: queue.length,
        stats: report.stats,
        report,
        channel,
      });
      continue;
    }

    const postCheck = shouldSkipAutomationJob(job, slugs, applyLinks);
    if (postCheck.skip) {
      report.stats.skippedPostSeo += 1;
      recordJob(buildJobEntry(job, 'skipped_post_seo', { reason: postCheck.reason }));
      onProgress?.({
        phase: 'seo',
        message: `Skipped after SEO: "${job.title}" — ${postCheck.reason}`,
        current: index + 1,
        total: queue.length,
        stats: report.stats,
        report,
        channel,
      });
      continue;
    }

    onProgress?.({
      phase: 'publishing',
      message: `Publishing "${job.title}"…`,
      current: index + 1,
      total: queue.length,
      jobTitle: job.title,
      stats: report.stats,
      report,
      channel,
    });

    try {
      const saved = await createAdminJob(job, 'published');
      report.stats.published += 1;
      if (saved?.slug) slugs.add(String(saved.slug).toLowerCase());
      if (saved?.apply_link) applyLinks.add(String(saved.apply_link).toLowerCase());
      recordJob(
        buildJobEntry(job, 'published', {
          reason: 'Published to database',
          publishedSlug: saved?.slug || job.slug,
        }),
      );
      onJobPublished?.(saved);
      onJobRemoved?.(job);
    } catch (error) {
      report.stats.publishFailed += 1;
      const message = error instanceof Error ? error.message : String(error);
      recordJob(buildJobEntry(job, 'publish_failed', { error: message, reason: 'Database insert failed' }));
      onProgress?.({
        phase: 'publishing',
        message: `Publish failed for "${job.title}": ${message}`,
        current: index + 1,
        total: queue.length,
        stats: report.stats,
        report,
        channel,
      });
    }
  }

  report.finishedAt = new Date().toISOString();
  pushReport();

  onProgress?.({
    phase: 'done',
    message: `${channelMeta.label} automation finished. Published ${report.stats.published} of ${report.stats.fetched} fetched (${report.stats.queued} were queued).`,
    stats: report.stats,
    report,
    channel,
  });

  return { stats: report.stats, report };
}

/** @deprecated Use runExternalFetchAutomationPipeline({ channel: 'naukri' }) */
export async function runNaukriAutomationPipeline(options) {
  return runExternalFetchAutomationPipeline({ ...options, channel: 'naukri' });
}
