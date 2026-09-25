import { readJsonBody, sendJson, setCors } from './_lib/http.js';
import { sendPublishedJobWebPush } from './_lib/jobWebPush.js';
import { createServiceClient, requireUser } from './_lib/supabaseAuth.js';


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
    const auth = await requireUser(req);
    if (auth.error) {
      sendJson(res, auth.status, { ok: false, error: auth.error });
      return;
    }

    const admin = createServiceClient();
    if (!admin) {
      sendJson(res, 500, { ok: false, error: 'Database service client unavailable.' });
      return;
    }

    const [{ data: adminRow }, { data: employerRow }] = await Promise.all([
      admin.from('admin_users').select('user_id').eq('user_id', auth.user.id).maybeSingle(),
      admin
        .from('employer_profiles')
        .select('user_id')
        .eq('user_id', auth.user.id)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    const isAdmin = Boolean(adminRow?.user_id);
    const isEmployer = Boolean(employerRow?.user_id);

    if (!isAdmin && !isEmployer) {
      sendJson(res, 403, { ok: false, error: 'Not allowed to send job alerts.' });
      return;
    }

    const body = await readJsonBody(req);
    const jobId = String(body.jobId || body.job_id || '').trim();
    if (!jobId) {
      sendJson(res, 400, { ok: false, error: 'jobId is required.' });
      return;
    }

    const force = Boolean(body.force && isAdmin);
    const result = await sendPublishedJobWebPush(jobId, { force, sentBy: auth.user.id });
    sendJson(res, result.status || 200, result);
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to send job notifications.',
    });
  }
}
