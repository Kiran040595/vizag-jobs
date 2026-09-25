import { shouldNotifyJobPublish } from './jobPublishNotify';
import { supabase } from './supabaseClient';

export function getNotifyNewJobUrl() {
  const base = import.meta.env.VITE_SUPABASE_URL?.trim()?.replace(/\/$/, '');
  if (!base) return '';
  return `${base}/functions/v1/notify-new-job`;
}

export async function notifyNewJobPublished(job) {
  if (!shouldNotifyJobPublish(job)) {
    return { ok: false, skipped: true, reason: 'not_direct_publish' };
  }

  const url = getNotifyNewJobUrl();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    return { ok: false, skipped: true, reason: 'config' };
  }

  let accessToken = '';
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    accessToken = data?.session?.access_token || '';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${accessToken || anon}`,
    },
    body: JSON.stringify({
      jobId: job.id,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    return { ok: false, error: data?.error || `HTTP ${res.status}` };
  }
  return data;
}

export async function notifyNewJobPublishedSafe(job) {
  try {
    return await notifyNewJobPublished(job);
  } catch (error) {
    console.warn('Job web-push notify failed:', error);
    return { ok: false, error: 'unexpected' };
  }
}
