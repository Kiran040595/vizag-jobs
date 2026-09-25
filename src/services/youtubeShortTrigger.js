/**
 * Admin client for the trigger-youtube-short Edge Function.
 */

function looksLikeJwt(token) {
  return typeof token === 'string' && token.split('.').length >= 3;
}

export function getTriggerYouTubeShortUrl() {
  const functionsOverride = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.trim();
  if (functionsOverride) {
    const base = functionsOverride.replace(/\/$/, '');
    if (base.endsWith('/trigger-youtube-short')) {
      return base;
    }
    if (base.endsWith('/generate-daily-blog')) {
      return base.replace('/generate-daily-blog', '/trigger-youtube-short');
    }
    if (base.endsWith('/fetch-external-jobs')) {
      return base.replace('/fetch-external-jobs', '/trigger-youtube-short');
    }
    if (base.includes('/functions/v1')) {
      return `${base}/trigger-youtube-short`;
    }
  }

  const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim()?.replace(/\/$/, '');
  if (!projectUrl) {
    return '';
  }
  return `${projectUrl}/functions/v1/trigger-youtube-short`;
}

/**
 * @param {string} accessToken Admin session JWT
 * @param {{
 *   privacy?: 'public' | 'unlisted' | 'private';
 *   skipIfExists?: boolean;
 *   publish?: boolean;
 * }} [options]
 */
export async function triggerYouTubeShortUpload(accessToken, options = {}) {
  const url = getTriggerYouTubeShortUrl();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url) {
    throw new Error('Missing VITE_SUPABASE_URL.');
  }
  if (!anon) {
    throw new Error('Missing VITE_SUPABASE_ANON_KEY.');
  }
  if (!accessToken || !looksLikeJwt(accessToken)) {
    throw new Error('Your admin session looks invalid. Sign out and sign in again.');
  }

  const body = {
    privacy: options.privacy || 'unlisted',
    skip_if_exists: options.skipIfExists === true,
    publish: options.publish !== false,
  };

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
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isAbort =
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError' || message.includes('aborted'));
    throw new Error(
      isAbort
        ? 'YouTube Short trigger timed out. Check Supabase Edge Function logs and retry.'
        : `Could not reach trigger-youtube-short: ${message}`,
    );
  }

  const rawText = await res.text();
  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      /* non-JSON */
    }
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'Edge Function returned 404. Deploy: supabase functions deploy trigger-youtube-short --no-verify-jwt',
      );
    }
    throw new Error(data?.error || `trigger-youtube-short failed (${res.status})`);
  }

  return data;
}
