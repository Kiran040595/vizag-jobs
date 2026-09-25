/**
 * Notify the asker/author by email when feedback or a job question is answered.
 */

export function getNotifyReplyUrl() {
  const base = import.meta.env.VITE_SUPABASE_URL?.trim()?.replace(/\/$/, '');
  if (!base) return '';
  return `${base}/functions/v1/notify-reply`;
}

/**
 * @param {string} accessToken
 * @param {{ kind: 'feedback' | 'job_question', id: string }} payload
 */
export async function notifyReplyByEmail(accessToken, payload) {
  const url = getNotifyReplyUrl();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anon) {
    console.warn('Reply notification skipped: missing Supabase URL or anon key.');
    return { ok: false, skipped: true, reason: 'config' };
  }
  if (!accessToken) {
    console.warn('Reply notification skipped: missing access token.');
    return { ok: false, skipped: true, reason: 'auth' };
  }
  if (!payload?.kind || !payload?.id) {
    return { ok: false, skipped: true, reason: 'payload' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        kind: payload.kind,
        id: payload.id,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      console.warn('Reply notification failed:', data?.error || res.status);
      return { ok: false, error: data?.error || `HTTP ${res.status}` };
    }

    return data;
  } catch (error) {
    console.warn('Reply notification request failed:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'network_error',
    };
  }
}

/** Best-effort notify; never throws into the moderation UI. */
export async function notifyReplyByEmailSafe(accessToken, payload) {
  try {
    return await notifyReplyByEmail(accessToken, payload);
  } catch (error) {
    console.warn('Reply notification threw:', error);
    return { ok: false, error: 'unexpected' };
  }
}
