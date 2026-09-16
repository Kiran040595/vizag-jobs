import { isAuthorizedCronRequest } from '../_lib/cronAuth.js';
import { sendJson } from '../_lib/http.js';
import { getSupabaseEnv } from '../_lib/supabaseAuth.js';
import {
  githubNaukriDispatchConfig,
  triggerNaukriWorkflowIfIdle,
} from '../../scripts/lib/github-naukri-dispatch.mjs';

const dispatchViaEdgeFunction = async () => {
  const { url, anonKey, serviceRole } = getSupabaseEnv();
  const cronSecret = String(process.env.FETCH_JOBS_CRON_SECRET || '').trim();
  const bearer = cronSecret || serviceRole;
  if (!url || !bearer) {
    throw new Error(
      'Missing Vercel server env: need SUPABASE_URL / VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (already used by resume APIs), or GITHUB_DISPATCH_TOKEN.',
    );
  }

  const endpoint = `${url}/functions/v1/dispatch-naukri-workflow`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      ...(cronSecret ? { 'x-fetch-jobs-cron-secret': cronSecret } : {}),
      apikey: anonKey || bearer,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source: 'vercel-cron' }),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text.slice(0, 280) };
  }
  if (!res.ok) {
    throw new Error(data.error || `dispatch-naukri-workflow failed (${res.status})`);
  }
  return data;
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  if (!isAuthorizedCronRequest(req)) {
    sendJson(res, 401, { error: 'Unauthorized cron request.' });
    return;
  }

  try {
    const config = githubNaukriDispatchConfig();
    const result = config.token
      ? await triggerNaukriWorkflowIfIdle(config)
      : await dispatchViaEdgeFunction();
    sendJson(res, 200, {
      ...result,
      source: 'vercel-cron',
    });
  } catch (error) {
    sendJson(res, 502, {
      error: error?.message || 'Could not dispatch Naukri workflow.',
    });
  }
}
