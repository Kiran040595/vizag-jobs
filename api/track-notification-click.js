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
    let jobId = String(body.jobId || body.job_id || '').trim();
    const jobSlug = String(body.jobSlug || body.job_slug || '').trim();
    const visitorKey = String(body.visitorKey || body.visitor_key || '').trim();
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 240);

    if (!dispatchId && !jobId && !jobSlug) {
      sendJson(res, 400, { ok: false, error: 'dispatchId, jobId, or jobSlug is required.' });
      return;
    }

    const admin = createServiceClient();
    if (!admin) {
      sendJson(res, 200, { ok: true, skipped: true, reason: 'no_service_client' });
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validDispatchUuid = uuidRegex.test(dispatchId) ? dispatchId : null;
    if (!uuidRegex.test(jobId) && dispatchId) {
      const prefixMatch = dispatchId.match(/^(?:alert|job)-([0-9a-f-]{36})$/i);
      if (prefixMatch && uuidRegex.test(prefixMatch[1])) {
        jobId = prefixMatch[1];
      }
    }

    if (!uuidRegex.test(jobId) && jobSlug) {
      const { data: slugJob } = await admin
        .from('jobs')
        .select('id')
        .eq('slug', jobSlug)
        .maybeSingle();
      if (slugJob?.id) {
        jobId = slugJob.id;
      }
    }

    const validJobUuid = uuidRegex.test(jobId) ? jobId : null;

    // Try calling RPC record_push_notification_open
    if (validDispatchUuid || validJobUuid) {
      const { data: rpcData, error: rpcError } = await admin.rpc('record_push_notification_open', {
        p_dispatch_id: validDispatchUuid,
        p_job_id: validJobUuid,
        p_visitor_key: visitorKey || null,
        p_user_agent: userAgent,
      });

      if (!rpcError && rpcData?.ok) {
        sendJson(res, 200, rpcData);
        return;
      }
    }

    // Fallback if migration RPC is not yet loaded: update directly
    let recordedInTable = false;
    let targetDispatch = null;

    if (validDispatchUuid) {
      const { data: current, error: currentErr } = await admin
        .from('push_notification_dispatches')
        .select('id, job_id, open_count')
        .eq('id', validDispatchUuid)
        .maybeSingle();
      if (!currentErr && current) {
        targetDispatch = current;
      }
    }

    if (!targetDispatch && validJobUuid) {
      const { data: latestDispatch, error: latestErr } = await admin
        .from('push_notification_dispatches')
        .select('id, job_id, open_count')
        .eq('job_id', validJobUuid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latestErr && latestDispatch) {
        targetDispatch = latestDispatch;
      }
    }

    if (targetDispatch) {
      const nowIso = new Date().toISOString();
      await admin
        .from('push_notification_dispatches')
        .update({
          open_count: (targetDispatch.open_count || 0) + 1,
          last_opened_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', targetDispatch.id);

      await admin
        .from('push_notification_opens')
        .insert({
          dispatch_id: targetDispatch.id,
          job_id: targetDispatch.job_id || validJobUuid,
          visitor_key: visitorKey || null,
          user_agent: userAgent || null,
          opened_at: nowIso,
        });

      recordedInTable = true;
    }

    if (!recordedInTable && validJobUuid) {
      const { data: jobRow } = await admin
        .from('jobs')
        .select('id, seo_meta')
        .eq('id', validJobUuid)
        .maybeSingle();

      if (jobRow) {
        const nowIso = new Date().toISOString();
        const existingMeta = jobRow.seo_meta && typeof jobRow.seo_meta === 'object' ? jobRow.seo_meta : {};
        const prevOpens = Array.isArray(existingMeta._push_opens) ? existingMeta._push_opens : [];
        const prevDispatches = Array.isArray(existingMeta._push_dispatches) ? existingMeta._push_dispatches : [];

        const updatedDispatches = prevDispatches.map((d, idx) => {
          if (idx === 0 || (dispatchId && d?.id === dispatchId)) {
            return {
              ...d,
              open_count: (Number(d?.open_count) || 0) + 1,
              last_opened_at: nowIso,
              updated_at: nowIso,
            };
          }
          return d;
        });

        const openEntry = {
          id: `seo-open-${validJobUuid}-${Date.now()}`,
          dispatch_id: dispatchId || updatedDispatches[0]?.id || `alert-${validJobUuid}`,
          job_id: validJobUuid,
          visitor_key: visitorKey || null,
          user_agent: userAgent || null,
          opened_at: nowIso,
        };

        await admin
          .from('jobs')
          .update({
            seo_meta: {
              ...existingMeta,
              ...(updatedDispatches.length > 0 ? { _push_dispatches: updatedDispatches } : {}),
              _push_opens: [openEntry, ...prevOpens].slice(0, 100),
            },
          })
          .eq('id', validJobUuid);
      }
    }

    sendJson(res, 200, { ok: true, recorded: true });
  } catch (error) {
    console.warn('Track notification click error:', error);
    sendJson(res, 200, { ok: false, error: error.message });
  }
}

