import { shouldNotifyJobPublish } from './jobPublishNotify';
import { supabase } from './supabaseClient';

export function getNotifyNewJobUrl() {
  return '/api/notify-new-job';
}

function getEdgeNotifyNewJobUrl() {
  const fnBase = String(import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || '').trim().replace(/\/+$/, '');
  if (fnBase) {
    return fnBase.endsWith('/notify-new-job') ? fnBase : `${fnBase}/notify-new-job`;
  }
  const supaUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  return supaUrl ? `${supaUrl}/functions/v1/notify-new-job` : '';
}

async function postNotifyEndpoint(payload, accessToken) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  try {
    const res = await fetch(getNotifyNewJobUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok !== false) {
        return { ok: true, data };
      }
      if (res.status !== 404 && res.status !== 502 && res.status !== 503) {
        return { ok: false, status: res.status, error: data?.error || `HTTP ${res.status}` };
      }
    }
  } catch {
    // Fall through to Supabase Edge Function fallback
  }

  const edgeUrl = getEdgeNotifyNewJobUrl();
  if (!edgeUrl) {
    return { ok: false, status: 500, error: 'Notification endpoint is not reachable.' };
  }

  const edgeHeaders = {
    ...headers,
    ...(anonKey ? { apikey: anonKey } : {}),
  };
  const edgeRes = await fetch(edgeUrl, {
    method: 'POST',
    headers: edgeHeaders,
    body: JSON.stringify(payload),
  });
  const edgeData = await edgeRes.json().catch(() => ({}));
  if (!edgeRes.ok || edgeData?.ok === false) {
    return {
      ok: false,
      status: edgeRes.status,
      error: edgeData?.error || `HTTP ${edgeRes.status}`,
    };
  }
  return { ok: true, data: edgeData };
}

export async function notifyNewJobPublished(job) {
  if (!shouldNotifyJobPublish(job)) {
    return { ok: false, skipped: true, reason: 'not_direct_publish' };
  }

  let accessToken = '';
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    accessToken = data?.session?.access_token || '';
  }
  if (!accessToken) {
    return { ok: false, skipped: true, reason: 'auth' };
  }

  const isEmployerJob = Boolean(job?.created_by || job?.createdBy || job?.reviewed_by);
  const triggerType = isEmployerJob ? 'auto_employer' : 'auto_admin';

  const result = await postNotifyEndpoint(
    {
      jobId: job.id,
      triggerType,
    },
    accessToken,
  );

  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return result.data;
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

  let accessToken = '';
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    accessToken = data?.session?.access_token || '';
  }
  if (!accessToken) {
    throw new Error('You must be signed in as an administrator to send notifications.');
  }

  const result = await postNotifyEndpoint(
    {
      jobId: cleanId,
      force: true,
      triggerType: 'manual_admin',
    },
    accessToken,
  );

  if (!result.ok) {
    throw new Error(result.error || 'Failed to broadcast push notification.');
  }
  return result.data;
}
