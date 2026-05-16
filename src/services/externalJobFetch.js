/**
 * Calls the Supabase Edge Function `fetch-external-jobs` (Firecrawl/Scrapfly + optional Gemini).
 * Requires an admin session access_token (or server-side cron secret — see docs).
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

/**
 * @param {string} accessToken - Supabase session access_token (admin user).
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchExternalJobs(accessToken) {
  const url = getFetchExternalJobsUrl();
  if (!url) {
    throw new Error('Supabase URL is not configured.');
  }
  if (!accessToken) {
    throw new Error('You must be signed in to fetch external listings.');
  }

  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  /** @type {Record<string, string>} */
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  if (anon) {
    headers.apikey = anon;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : `Request failed (${res.status}).`);
  }
  if (!data?.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Fetch failed.');
  }
  return data;
}
