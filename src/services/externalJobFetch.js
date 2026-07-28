/**
 * Supabase Edge Function `fetch-external-jobs`:
 * - mode `fetch`: scrape LinkedIn/Naukri listings (no Gemini)
 * - mode `seo`: Gemini SEO rewrite for a single job (admin "Make SEO" button)
 */

import { appendGeminiKeyToSeoErrorMessage } from '../lib/formatGeminiKeyUsage';
import {
  isSeoRetryableError,
  maxSeoAttemptsForKeyPool,
  nextGeminiKeyIndex,
  parseGeminiKeyIndexFromError,
  parseSeoRetryWaitMs,
} from '../lib/seoRetry';
import { SEO_PUBLISH_SAFE_INSTRUCTIONS } from '../lib/seoPublishSafeInstructions';

export function getFetchExternalJobsUrl() {
  const override = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.trim();
  if (override) {
    return override.replace(/\/$/, '');
  }
  const base = import.meta.env.VITE_SUPABASE_URL?.trim()?.replace(/\/$/, '');
  if (!base) {
    return '';
  }
  return `${base}/functions/v1/fetch-external-jobs`;
}

function looksLikeJwt(token) {
  return typeof token === 'string' && token.split('.').length >= 3;
}

/**
 * Trim payload for Make SEO — LinkedIn posts often carry 8k+ chars of scrape context.
 * @param {Record<string, unknown>} job
 */
function buildSeoJobPayload(job) {
  const isLinkedInPost = job.source_kind === 'linkedin_post';
  const postRaw =
    (typeof job.linkedin_post_text === 'string' && job.linkedin_post_text.trim()) ||
    (typeof job.description === 'string' && job.description.trim()) ||
    (typeof job.short_description === 'string' && job.short_description.trim()) ||
    '';
  const postText = postRaw ? postRaw.slice(0, isLinkedInPost ? 2_400 : 3_500) : null;

  return {
    slug: job.slug,
    title: job.title,
    company: job.company,
    location: job.location,
    category: job.category,
    job_type: job.job_type,
    work_mode: job.work_mode,
    experience: job.experience,
    is_fresher: job.is_fresher,
    salary: job.salary,
    apply_link: job.apply_link,
    source_url: job.source_url,
    source_name: job.source_name,
    source_kind: job.source_kind,
    posted_at: job.posted_at,
    short_description: isLinkedInPost
      ? typeof job.short_description === 'string'
        ? job.short_description.slice(0, 400)
        : job.short_description
      : typeof job.short_description === 'string'
        ? job.short_description.slice(0, 600)
        : job.short_description,
    description: isLinkedInPost
      ? undefined
      : typeof job.description === 'string'
        ? job.description.slice(0, 2_500)
        : job.description,
    responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities.slice(0, 12) : [],
    eligibility: Array.isArray(job.eligibility) ? job.eligibility.slice(0, 10) : [],
    skills: Array.isArray(job.skills) ? job.skills.slice(0, 16) : [],
    linkedin_post_text: postText,
    needs_review: job.needs_review,
    is_likely_hiring_post: job.is_likely_hiring_post,
  };
}

async function callFetchExternalJobsEdge(accessToken, body, options = {}) {
  const url = getFetchExternalJobsUrl();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  const timeoutMs =
    typeof options.timeoutMs === 'number' && options.timeoutMs > 0 ? options.timeoutMs : null;

  if (!url) {
    throw new Error('Missing VITE_SUPABASE_URL (set it to Project URL from Supabase → Settings → API).');
  }
  if (!anon) {
    throw new Error('Missing VITE_SUPABASE_ANON_KEY.');
  }
  if (!accessToken || !looksLikeJwt(accessToken)) {
    throw new Error('Your session looks invalid. Sign out of admin, sign in again, then retry.');
  }

  let res;
  try {
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    };
    if (timeoutMs && typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
      fetchOptions.signal = AbortSignal.timeout(timeoutMs);
    }
    res = await fetch(url, fetchOptions);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isAbort =
      e instanceof Error &&
      (e.name === 'AbortError' || e.name === 'TimeoutError' || msg.includes('aborted'));
    if (isAbort && body?.mode === 'seo') {
      throw new Error(
        'Make SEO timed out in the browser. LinkedIn posts use a shorter prompt now — try again once. If it repeats, check Edge Function logs and GEMINI_API_KEY.',
      );
    }
    const isNetwork =
      e instanceof TypeError &&
      (msg === 'Failed to fetch' || msg.includes('fetch') || msg.includes('NetworkError'));

    throw new Error(
      isNetwork
        ? [
            'Could not reach the Edge Function (network/CORS/firewall/ad-blocker).',
            `Request URL: ${url}`,
            'Fix: deploy fetch-external-jobs, match .env to your project, or disable ad-blockers.',
          ].join(' ')
        : `Request failed: ${msg}`,
      { cause: e instanceof Error ? e : undefined },
    );
  }

  const rawText = await res.text();
  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      /* non-JSON body */
    }
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'Edge Function returned 404. Deploy: supabase functions deploy fetch-external-jobs --no-verify-jwt',
      );
    }

    if (res.status === 546) {
      const isSeo = body?.mode === 'seo';
      const msg = isSeo
        ? 'Edge Function HTTP 546 during SEO: request took too long. Retry Make SEO for this job, or shorten the scraped description before optimizing.'
        : 'Edge Function HTTP 546: fetch ran out of compute time. Lower FETCH_JOB_DETAIL_SCRAPE_LIMIT (e.g. 8) in Edge secrets, or upgrade your Supabase plan.';
      throw new Error(isSeo ? appendGeminiKeyToSeoErrorMessage(msg, data) : msg);
    }

    if (res.status === 504 && body?.mode === 'seo') {
      throw new Error(
        appendGeminiKeyToSeoErrorMessage(
          'Make SEO timed out (150s gateway limit). Retry once; if it keeps failing, shorten the job text or check Edge Function logs.',
          data,
        ),
      );
    }

    const serverError =
      (typeof data?.error === 'string' && data.error) ||
      (typeof data?.message === 'string' && data.message) ||
      '';

    if (body?.mode === 'seo' && serverError) {
      const withKey = appendGeminiKeyToSeoErrorMessage(serverError, data);
      const isQuota =
        res.status === 502 &&
        (serverError.includes('quota') ||
          serverError.includes('429') ||
          serverError.includes('rate limit'));
      if (isQuota) {
        throw new Error(withKey);
      }
      if (res.status === 502 || res.status === 504) {
        throw new Error(`Edge Function HTTP ${res.status}: ${withKey}`);
      }
    }

    const bodyHint =
      serverError || (rawText && rawText.length > 0 ? rawText.slice(0, 400) : res.statusText);

    if (body?.mode === 'seo' && data && typeof data === 'object') {
      throw new Error(
        `Edge Function HTTP ${res.status}: ${appendGeminiKeyToSeoErrorMessage(bodyHint, data)}`,
      );
    }

    throw new Error(`Edge Function HTTP ${res.status}: ${bodyHint}`);
  }

  if (!data?.ok) {
    const err =
      typeof data?.error === 'string' ? data.error : 'Request failed (unexpected JSON).';
    if (body?.mode === 'seo') {
      throw new Error(appendGeminiKeyToSeoErrorMessage(err, data));
    }
    throw new Error(err);
  }

  return data;
}

/** @typedef {'naukri' | 'linkedin_jobs' | 'linkedin_posts' | 'vizag_it' | 'indeed'} ExternalFetchChannel */

/**
 * Scrape external listings only (no Gemini) — all sources (legacy).
 * @param {string} accessToken
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchExternalJobs(accessToken) {
  return callFetchExternalJobsEdge(accessToken, { mode: 'fetch' });
}

/**
 * @typedef {object} LinkedInPostsFetchOptions
 * @property {'general' | 'it' | 'bank' | 'custom'} [preset]
 * @property {string} [customSearchUrl] Required when preset is custom
 */

/**
 * Fetch from a single source channel (admin fetch page buttons).
 * @param {string} accessToken
 * @param {ExternalFetchChannel} fetchChannel
 * @param {LinkedInPostsFetchOptions} [options] LinkedIn Posts preset (linkedin_posts only)
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchExternalJobsBySource(accessToken, fetchChannel, options = {}) {
  const body = {
    mode: 'fetch',
    fetch_channel: fetchChannel,
  };
  if (fetchChannel === 'linkedin_posts') {
    const preset = options.preset || 'general';
    body.linkedin_post_preset = preset;
    if (preset === 'custom' && options.customSearchUrl?.trim()) {
      body.linkedin_custom_search_url = options.customSearchUrl.trim();
    }
  }
  return callFetchExternalJobsEdge(accessToken, body, { timeoutMs: options.timeoutMs });
}

/** Default wait before collecting Naukri Apify results (3 minutes). */
export const NAUKRI_ASYNC_COLLECT_WAIT_MS = 3 * 60 * 1000;

/**
 * Start Naukri Apify scrape without waiting for completion.
 * @param {string} accessToken
 * @returns {Promise<Record<string, unknown>>}
 */
export async function startNaukriApifyFetch(accessToken) {
  return callFetchExternalJobsEdge(accessToken, {
    mode: 'fetch',
    fetch_channel: 'naukri',
    naukri_action: 'start',
  });
}

/**
 * Collect jobs from a started Naukri Apify run.
 * @param {string} accessToken
 * @param {string} apifyRunId
 * @returns {Promise<Record<string, unknown>>}
 */
export async function collectNaukriApifyFetch(accessToken, apifyRunId) {
  return callFetchExternalJobsEdge(accessToken, {
    mode: 'fetch',
    fetch_channel: 'naukri',
    naukri_action: 'collect',
    apify_naukri_run_id: apifyRunId,
  });
}

/**
 * Prefer the post body for LinkedIn SEO — stale seo_source_context from fetch dedupe bugs confuses Gemini.
 * @param {Record<string, unknown>} job
 */
function resolveSeoSourceContext(job) {
  const isLinkedInPost = job.source_kind === 'linkedin_post';
  const postText =
    typeof job.linkedin_post_text === 'string' ? job.linkedin_post_text.trim() : '';
  const ctxRaw =
    typeof job.seo_source_context === 'string' ? job.seo_source_context.trim() : '';
  const cap = isLinkedInPost ? 900 : 1_800;

  if (!isLinkedInPost) {
    return (ctxRaw || postText).slice(0, cap);
  }
  if (!postText) {
    return ctxRaw.slice(0, cap);
  }
  if (!ctxRaw) {
    return postText.slice(0, cap);
  }
  const probe = postText.slice(0, Math.min(60, postText.length)).toLowerCase();
  if (probe.length > 20 && !ctxRaw.toLowerCase().includes(probe.slice(0, 40))) {
    return postText.slice(0, cap);
  }
  return ctxRaw.slice(0, cap);
}

/**
 * Run Gemini Vizag SEO for one review job.
 * @param {string} accessToken
 * @param {Record<string, unknown>} job
 * @param {string} [seoSourceContext]
 * @returns {Promise<Record<string, unknown>>}
 */
function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function seoOptimizeExternalJob(accessToken, job, seoSourceContext = '', options = {}) {
  const isLinkedInPost = job.source_kind === 'linkedin_post';
  const context =
    seoSourceContext?.trim()
      ? resolveSeoSourceContext({ ...job, seo_source_context: seoSourceContext })
      : resolveSeoSourceContext(job);
  const customInstructions =
    (typeof job.seo_custom_instructions === 'string' && job.seo_custom_instructions.trim()) ||
    SEO_PUBLISH_SAFE_INSTRUCTIONS;
  const timeoutMs = isLinkedInPost ? 120_000 : 130_000;

  let keyPool = options.geminiKeyPool;
  if (!keyPool && options.fetchKeys !== false) {
    try {
      const { keys } = await fetchSeoGeminiKeys(accessToken, { linkedInPost: isLinkedInPost });
      keyPool = keys;
    } catch {
      keyPool = [];
    }
  }

  const maxAttempts = Math.max(
    maxSeoAttemptsForKeyPool(keyPool),
    typeof options.geminiKeyIndex === 'number' && options.geminiKeyIndex > 0 ? 2 : 1,
  );
  let usedKeyIndex =
    typeof options.geminiKeyIndex === 'number' && options.geminiKeyIndex > 0
      ? Math.floor(options.geminiKeyIndex)
      : 0;

  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const geminiKeyIndex = usedKeyIndex > 0 ? usedKeyIndex : undefined;
    const body = {
      mode: 'seo',
      job: buildSeoJobPayload(job),
      seo_source_context: context,
      seo_custom_instructions: customInstructions.slice(0, 1200) || undefined,
      ...(geminiKeyIndex ? { gemini_key_index: geminiKeyIndex } : {}),
    };

    try {
      return await callFetchExternalJobsEdge(accessToken, body, { timeoutMs });
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const canRetry = isSeoRetryableError(msg) && attempt < maxAttempts - 1;
      if (!canRetry) {
        throw error;
      }

      const failedKey =
        parseGeminiKeyIndexFromError(msg) ?? (usedKeyIndex > 0 ? usedKeyIndex : null);
      usedKeyIndex = nextGeminiKeyIndex(keyPool, failedKey);
      const waitMs = parseSeoRetryWaitMs(msg);
      if (typeof options.onRetry === 'function') {
        options.onRetry({
          attempt: attempt + 2,
          maxAttempts,
          waitMs,
          failedKeyIndex: failedKey,
          nextKeyIndex: usedKeyIndex,
          message: msg,
        });
      }
      await sleepMs(waitMs);
    }
  }

  throw lastError ?? new Error('SEO optimization failed after retries.');
}

/**
 * List configured Make SEO Gemini keys (labels + index only — never full keys).
 * @param {string} accessToken
 * @param {{ linkedInPost?: boolean }} [options]
 * @returns {Promise<{ keys: Array<{ index: number, label: string, source?: string, hint?: string }>, total: number }>}
 */
export async function fetchSeoGeminiKeys(accessToken, options = {}) {
  const data = await callFetchExternalJobsEdge(accessToken, {
    mode: 'seo_keys',
    linkedin_post: options.linkedInPost === true,
  });
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  return {
    keys,
    total: Number(data?.gemini_keys_total) || keys.length,
  };
}
