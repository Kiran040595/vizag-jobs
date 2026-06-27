import { getExternalJobKey } from '../components/admin/ExternalJobReviewPanel';
import { createAdminJob } from '../services/adminJobs';
import {
  collectNaukriApifyFetch,
  NAUKRI_ASYNC_COLLECT_WAIT_MS,
  seoOptimizeExternalJob,
  startNaukriApifyFetch,
} from '../services/externalJobFetch';
import { geminiKeyFieldsFromSeoResponse } from './formatGeminiKeyUsage';

/** Gap between Make SEO calls during automation (matches daily pipeline). */
export const NAUKRI_AUTOMATION_SEO_GAP_MS = 3 * 60 * 1000;

const INVALID_APPLY_TOKENS = /^(null|undefined|none|n\/a|na)$/i;

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function resolveJobApplyLink(job) {
  let apply = String(job?.apply_link || '').trim();
  if (!apply || INVALID_APPLY_TOKENS.test(apply)) {
    apply = String(job?.source_url || '').trim();
  }
  return !apply || INVALID_APPLY_TOKENS.test(apply) ? '' : apply;
}

export function shouldSkipNaukriAutomationJob(job, existingSlugs, existingApplyLinks) {
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

  return { skip: false, reason: '' };
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

async function collectNaukriJobs(accessToken, { collectMaxAttempts, onProgress, signal }) {
  const started = await startNaukriApifyFetch(accessToken);
  if (signal?.aborted) {
    throw new DOMException('Automation cancelled.', 'AbortError');
  }

  const runId = started.apify_naukri_run_id;
  if (!runId) {
    throw new Error('Naukri Apify run id missing from start response.');
  }

  const waitMs = Number(started.collect_after_ms) || NAUKRI_ASYNC_COLLECT_WAIT_MS;
  onProgress?.({
    phase: 'waiting',
    message: `Apify scrape started. Waiting ${Math.round(waitMs / 1000)}s before collecting…`,
    waitSec: Math.ceil(waitMs / 1000),
    runId,
  });

  const waitEnd = Date.now() + waitMs;
  while (Date.now() < waitEnd) {
    if (signal?.aborted) {
      throw new DOMException('Automation cancelled.', 'AbortError');
    }
    const remainingSec = Math.max(0, Math.ceil((waitEnd - Date.now()) / 1000));
    onProgress?.({
      phase: 'waiting',
      message: `Waiting for Apify results…`,
      waitSec: remainingSec,
      runId,
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

/**
 * Fetch Naukri jobs, run Make SEO with gaps, and publish new jobs with valid apply links.
 */
export async function runNaukriAutomationPipeline({
  accessToken,
  existingSlugs,
  existingApplyLinks,
  onProgress,
  onFetchComplete,
  onJobUpdated,
  onJobPublished,
  onJobRemoved,
  signal,
  seoGapMs = NAUKRI_AUTOMATION_SEO_GAP_MS,
  collectMaxAttempts = 24,
}) {
  const slugs = new Set(existingSlugs);
  const applyLinks = new Set(existingApplyLinks);
  const stats = {
    fetched: 0,
    skippedPreSeo: 0,
    seoOk: 0,
    seoFailed: 0,
    published: 0,
    skippedPostSeo: 0,
    publishFailed: 0,
  };

  onProgress?.({ phase: 'fetching', message: 'Starting Naukri Apify scrape…' });

  const { jobs: fetchedJobs, payload } = await collectNaukriJobs(accessToken, {
    collectMaxAttempts,
    onProgress,
    signal,
  });

  stats.fetched = fetchedJobs.length;
  onFetchComplete?.(payload);

  const queue = [];
  const seenKeys = new Set();

  for (const job of fetchedJobs) {
    const key = getExternalJobKey(job);
    if (key && seenKeys.has(key)) {
      stats.skippedPreSeo += 1;
      continue;
    }
    if (key) seenKeys.add(key);

    const preCheck = shouldSkipNaukriAutomationJob(job, slugs, applyLinks);
    if (preCheck.skip) {
      stats.skippedPreSeo += 1;
      continue;
    }

    queue.push(job);
  }

  onProgress?.({
    phase: 'processing',
    message: `${queue.length} job(s) queued for SEO and publish.`,
    current: 0,
    total: queue.length,
    stats,
  });

  for (let index = 0; index < queue.length; index += 1) {
    if (signal?.aborted) {
      throw new DOMException('Automation cancelled.', 'AbortError');
    }

    let job = queue[index];

    if (index > 0) {
      const gapEnd = Date.now() + seoGapMs;
      while (Date.now() < gapEnd) {
        if (signal?.aborted) {
          throw new DOMException('Automation cancelled.', 'AbortError');
        }
        onProgress?.({
          phase: 'seo_gap',
          message: `Waiting before next Make SEO…`,
          current: index,
          total: queue.length,
          waitSec: Math.max(0, Math.ceil((gapEnd - Date.now()) / 1000)),
          jobTitle: job.title,
          stats,
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
      stats,
    });

    try {
      const data = await seoOptimizeExternalJob(accessToken, job, '', {});
      job = mergeSeoJob(job, data);
      stats.seoOk += 1;
      onJobUpdated?.(job);
    } catch (error) {
      stats.seoFailed += 1;
      onProgress?.({
        phase: 'seo',
        message: `SEO failed for "${job.title}": ${error instanceof Error ? error.message : String(error)}`,
        current: index + 1,
        total: queue.length,
        stats,
      });
      continue;
    }

    const postCheck = shouldSkipNaukriAutomationJob(job, slugs, applyLinks);
    if (postCheck.skip) {
      stats.skippedPostSeo += 1;
      continue;
    }

    onProgress?.({
      phase: 'publishing',
      message: `Publishing "${job.title}"…`,
      current: index + 1,
      total: queue.length,
      jobTitle: job.title,
      stats,
    });

    try {
      const saved = await createAdminJob(job, 'published');
      stats.published += 1;
      if (saved?.slug) slugs.add(String(saved.slug).toLowerCase());
      if (saved?.apply_link) applyLinks.add(String(saved.apply_link).toLowerCase());
      onJobPublished?.(saved);
      onJobRemoved?.(job);
    } catch (error) {
      stats.publishFailed += 1;
      onProgress?.({
        phase: 'publishing',
        message: `Publish failed for "${job.title}": ${error instanceof Error ? error.message : String(error)}`,
        current: index + 1,
        total: queue.length,
        stats,
      });
    }
  }

  onProgress?.({
    phase: 'done',
    message: `Automation finished. Published ${stats.published} of ${queue.length} queued job(s).`,
    stats,
  });

  return stats;
}
