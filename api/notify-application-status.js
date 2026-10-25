import { readJsonBody, sendJson, setCors } from './_lib/http.js';
import { createServiceClient, requireUser } from './_lib/supabaseAuth.js';
import { buildApplicationStatusPushPayload } from '../src/lib/applicationPushNotify.js';

const SITE_ORIGIN = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://jobsinvizag.in')
  .trim()
  .replace(/\/$/, '');

async function loadVapid(admin) {
  const fromEnv = {
    publicKey: (process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '').trim(),
    privateKey: (process.env.VAPID_PRIVATE_KEY || '').trim(),
    subject: (process.env.VAPID_SUBJECT || 'mailto:kiran@jobsinvizag.in').trim(),
  };
  if (fromEnv.publicKey && fromEnv.privateKey) {
    return fromEnv;
  }

  const { data, error } = await admin
    .from('web_push_config')
    .select('public_key, private_key, subject')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    publicKey: String(data?.public_key || '').trim(),
    privateKey: String(data?.private_key || '').trim(),
    subject: String(data?.subject || fromEnv.subject).trim(),
  };
}

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

    // Verify caller has permissions (is admin or active employer)
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
      sendJson(res, 403, { ok: false, error: 'Not allowed to send application status alerts.' });
      return;
    }

    const body = await readJsonBody(req);
    const applicationId = String(body.applicationId || '').trim();
    const jobId = String(body.jobId || '').trim();
    const studentUserId = String(body.studentUserId || '').trim();
    const newStatus = String(body.newStatus || '').trim().toLowerCase();
    const interviewScheduledAt = body.interviewScheduledAt || null;

    if (!applicationId || !studentUserId || !newStatus) {
      sendJson(res, 400, {
        ok: false,
        error: 'applicationId, studentUserId, and newStatus are required.',
      });
      return;
    }

    // Skip notifications for initial applied/submitted state
    if (newStatus === 'submitted' || newStatus === 'applied') {
      sendJson(res, 200, { ok: true, skipped: true, reason: 'initial_submission', sent: 0 });
      return;
    }

    // Fetch the candidate's active push subscriptions
    const { data: subscriptions, error: subError } = await admin
      .from('web_push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id')
      .eq('user_id', studentUserId);

    if (subError) {
      throw new Error(subError.message);
    }

    if (!subscriptions || subscriptions.length === 0) {
      sendJson(res, 200, { ok: true, skipped: true, reason: 'no_subscriptions', sent: 0 });
      return;
    }

    // Fetch job details
    let jobTitle = 'Job Position';
    let companyName = 'Company';
    if (jobId) {
      const { data: job } = await admin
        .from('jobs')
        .select('title, company')
        .eq('id', jobId)
        .maybeSingle();

      if (job) {
        jobTitle = job.title || jobTitle;
        companyName = job.company || companyName;
      }
    }

    const vapid = await loadVapid(admin);
    if (!vapid.publicKey || !vapid.privateKey) {
      sendJson(res, 200, { ok: true, skipped: true, reason: 'vapid_not_configured', sent: 0 });
      return;
    }

    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    const pushPayload = buildApplicationStatusPushPayload({
      applicationId,
      jobTitle,
      companyName,
      status: newStatus,
      interviewScheduledAt,
      origin: SITE_ORIGIN,
    });

    const messageString = JSON.stringify(pushPayload);
    let sent = 0;
    const staleIds = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          messageString,
          {
            TTL: 60 * 60 * 24 * 3, // 3 days
            urgency: newStatus === 'interview_scheduled' ? 'high' : 'normal',
          },
        );
        sent += 1;
      } catch (err) {
        const statusCode = Number(err?.statusCode || err?.status || 0);
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          console.warn(`Failed to send status push to ${sub.endpoint?.slice(0, 30)}...`, err?.message);
        }
      }
    }

    if (staleIds.length > 0) {
      await admin.from('web_push_subscriptions').delete().in('id', staleIds).catch(() => {});
    }

    sendJson(res, 200, {
      ok: true,
      sent,
      targetSubscribers: subscriptions.length,
      cleanedStale: staleIds.length,
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to send application status notification.',
    });
  }
}
