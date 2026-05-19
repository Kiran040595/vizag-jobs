/**
 * Supabase Edge Function `fetch-external-jobs`:
 * - mode `fetch`: scrape LinkedIn/Naukri listings (no Gemini)
 * - mode `seo`: Gemini SEO rewrite for a single job (admin "Make SEO" button)
 */

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

async function callFetchExternalJobsEdge(accessToken, body) {
  const url = getFetchExternalJobsUrl();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

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
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
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
      throw new Error(
        isSeo
          ? 'Edge Function HTTP 546 during SEO: request took too long. Retry Make SEO for this job, or shorten the scraped description before optimizing.'
          : 'Edge Function HTTP 546: fetch ran out of compute time. Lower FETCH_JOB_DETAIL_SCRAPE_LIMIT (e.g. 8) in Edge secrets, or upgrade your Supabase plan.',
      );
    }

    if (res.status === 504 && body?.mode === 'seo') {
      throw new Error(
        'Make SEO timed out (150s gateway limit). Retry once; if it keeps failing, shorten the job text or check Edge Function logs.',
      );
    }

    const serverError =
      (typeof data?.error === 'string' && data.error) ||
      (typeof data?.message === 'string' && data.message) ||
      '';

    if (body?.mode === 'seo' && serverError) {
      const isQuota =
        res.status === 502 &&
        (serverError.includes('quota') ||
          serverError.includes('429') ||
          serverError.includes('rate limit'));
      if (isQuota) {
        throw new Error(serverError);
      }
    }

    const bodyHint =
      serverError || (rawText && rawText.length > 0 ? rawText.slice(0, 400) : res.statusText);

    throw new Error(`Edge Function HTTP ${res.status}: ${bodyHint}`);
  }

  if (!data?.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Request failed (unexpected JSON).');
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
 * Fetch from a single source channel (admin fetch page buttons).
 * @param {string} accessToken
 * @param {ExternalFetchChannel} fetchChannel
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchExternalJobsBySource(accessToken, fetchChannel) {
  return callFetchExternalJobsEdge(accessToken, {
    mode: 'fetch',
    fetch_channel: fetchChannel,
  });
}

/**
 * Run Gemini Vizag SEO for one review job.
 * @param {string} accessToken
 * @param {Record<string, unknown>} job
 * @param {string} [seoSourceContext]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function seoOptimizeExternalJob(accessToken, job, seoSourceContext = '') {
  const context =
    seoSourceContext ||
    (typeof job.seo_source_context === 'string' ? job.seo_source_context : '');

  return callFetchExternalJobsEdge(accessToken, {
    mode: 'seo',
    job,
    seo_source_context: context,
  });
}
