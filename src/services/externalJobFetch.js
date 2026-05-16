/**
 * Calls the Supabase Edge Function `fetch-external-jobs` (Firecrawl/Scrapfly + optional Gemini).
 * Uses explicit fetch + JSON parsing so you see real HTTP errors (404 = not deployed, etc.).
 * `functions.invoke` often surfaces only: "Failed to send a request to the Edge Function".
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

/**
 * @param {string} accessToken - Supabase session access_token (admin user).
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchExternalJobs(accessToken) {
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
      body: JSON.stringify({}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isNetwork =
      e instanceof TypeError &&
      (msg === 'Failed to fetch' || msg.includes('fetch') || msg.includes('NetworkError'));

    const wrapped = new Error(
      isNetwork
        ? [
            'Could not reach the Edge Function (network/CORS/firewall/ad-blocker).',
            `Request URL: ${url}`,
            'Fix: deploy the function (supabase functions deploy fetch-external-jobs), match .env to your project, try another network or disable extensions.',
          ].join(' ')
        : `Request failed: ${msg}`,
      { cause: e instanceof Error ? e : undefined },
    );
    throw wrapped;
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
        'Edge Function returned 404 — nothing is deployed at this URL or the name is wrong. In Dashboard → Edge Functions you should see fetch-external-jobs. Deploy from your repo: supabase functions deploy fetch-external-jobs --no-verify-jwt',
      );
    }

    const bodyHint =
      (typeof data?.error === 'string' && data.error) ||
      (typeof data?.message === 'string' && data.message) ||
      (rawText && rawText.length > 0 ? rawText.slice(0, 400) : res.statusText);

    throw new Error(`Edge Function HTTP ${res.status}: ${bodyHint}`);
  }

  if (!data?.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Fetch failed (unexpected JSON).');
  }

  return data;
}
