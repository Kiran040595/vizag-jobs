import { shouldNotifyJobPublish } from './jobPublishNotify';
import { supabase } from './supabaseClient';

export function getNotifyNewJobUrl() {
  return '/api/notify-new-job';
}

export async function notifyNewJobPublished(job) {
  if (!shouldNotifyJobPublish(job)) {
    return { ok: false, skipped: true, reason: 'not_direct_publish' };
  }

  const url = getNotifyNewJobUrl();
  let accessToken = '';
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    accessToken = data?.session?.access_token || '';
  }
  if (!accessToken) {
    return { ok: false, skipped: true, reason: 'auth' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
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

export async function sendJobPushBroadcast(jobId) {
  const cleanId = String(jobId || '').trim();
  if (!cleanId) {
    throw new Error('Job ID is required.');
  }

  const url = getNotifyNewJobUrl();
  let accessToken = '';
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    accessToken = data?.session?.access_token || '';
  }
  if (!accessToken) {
    throw new Error('You must be signed in as an administrator to send notifications.');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      jobId: cleanId,
      force: true,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${res.status}: Failed to broadcast push notification.`);
  }
  return data;
}
