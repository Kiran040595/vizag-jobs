import { readJsonBody, sendJson, setCors } from './_lib/http.js';
import { createServiceClient } from './_lib/supabaseAuth.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const dispatchId = String(body.dispatchId || body.dispatch_id || '').trim();
    const jobId = String(body.jobId || body.job_id || '').trim();
    const visitorKey = String(body.visitorKey || body.visitor_key || '').trim();
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 240);

    if (!dispatchId && !jobId) {
      sendJson(res, 400, { ok: false, error: 'dispatchId or jobId is required.' });
      return;
    }

    const admin = createServiceClient();
    if (!admin) {
      sendJson(res, 200, { ok: true, skipped: true, reason: 'no_service_client' });
      return;
    }

    // Try calling RPC record_push_notification_open
    const { data: rpcData, error: rpcError } = await admin.rpc('record_push_notification_open', {
      p_dispatch_id: dispatchId || null,
      p_job_id: jobId || null,
      p_visitor_key: visitorKey || null,
      p_user_agent: userAgent,
    });

    if (!rpcError && rpcData?.ok) {
      sendJson(res, 200, rpcData);
      return;
    }

    // Fallback if migration RPC is not yet loaded: update directly
    if (dispatchId) {
      // Fetch current open count
      const { data: current } = await admin
        .from('push_notification_dispatches')
        .select('open_count')
        .eq('id', dispatchId)
        .maybeSingle();

      if (current) {
        await admin
          .from('push_notification_dispatches')
          .update({
            open_count: (current.open_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', dispatchId);
      }
    }

    sendJson(res, 200, { ok: true, recorded: true });
  } catch (error) {
    console.warn('Track notification click error:', error);
    sendJson(res, 200, { ok: false, error: error.message });
  }
}
