/**
 * Admin client for the generate-daily-blog Edge Function.
 */

function looksLikeJwt(token) {
  return typeof token === 'string' && token.split('.').length >= 3;
}

export function getGenerateDailyBlogUrl() {
  const functionsOverride = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.trim();
  if (functionsOverride) {
    const base = functionsOverride.replace(/\/$/, '');
    if (base.endsWith('/generate-daily-blog')) {
      return base;
    }
    if (base.endsWith('/fetch-external-jobs')) {
      return base.replace('/fetch-external-jobs', '/generate-daily-blog');
    }
    if (base.includes('/functions/v1')) {
      return `${base}/generate-daily-blog`;
    }
  }

  const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim()?.replace(/\/$/, '');
  if (!projectUrl) {
    return '';
  }
  return `${projectUrl}/functions/v1/generate-daily-blog`;
}

/**
 * @param {string} accessToken Admin session JWT
 * @param {{
 *   publish?: boolean;
 *   skipIfExists?: boolean;
 *   minJobs?: number;
 *   date?: string;
 *   loadJobsFromDb?: boolean;
 *   customInstructions?: string;
 *   sourceContent?: string;
 * }} [options]
 */
export async function generateDailyBlogArticle(accessToken, options = {}) {
  const url = getGenerateDailyBlogUrl();
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
    load_jobs_from_db: options.loadJobsFromDb !== false,
    publish: options.publish !== false,
    skip_if_exists: options.skipIfExists !== false,
    min_jobs: typeof options.minJobs === 'number' ? options.minJobs : 1,
  };

  if (options.date) {
    body.date = options.date;
  }

  const customInstructions = String(options.customInstructions || '').trim();
  const sourceContent = String(options.sourceContent || '').trim();
  if (customInstructions) {
    body.custom_instructions = customInstructions;
  }
  if (sourceContent) {
    body.source_content = sourceContent;
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
      signal: AbortSignal.timeout(180_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isAbort =
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError' || message.includes('aborted'));
    throw new Error(
      isAbort
        ? 'Daily blog generation timed out after 3 minutes. Check Edge Function logs and Gemini quota, then retry.'
        : `Could not reach generate-daily-blog: ${message}`,
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
        'Edge Function returned 404. Deploy: supabase functions deploy generate-daily-blog --no-verify-jwt',
      );
    }
    throw new Error(data?.error || `generate-daily-blog failed (${res.status})`);
  }

  return data;
}
