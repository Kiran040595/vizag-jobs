import { createServiceClient } from './supabaseAuth.js';

const SITE_ORIGIN = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://jobsinvizag.in')
  .trim()
  .replace(/\/$/, '');

export const isDirectPublishedJob = (job) => {
  if (!job || job.status !== 'published') return false;
  const sourceName = String(job.source_name || '').trim();
  const sourceUrl = String(job.source_url || '').trim();
  return Boolean(job.created_by) || (!sourceName && !sourceUrl);
};

export const buildWebPushMessage = (job, origin = SITE_ORIGIN) => {
  const linkPath = job.slug ? `/job/${job.slug}` : '/jobs';
  const absolute = `${origin}${linkPath}`;
  return {
    title: `New job: ${String(job.title || 'Vizag opening').slice(0, 80)}`,
    body: [job.company, job.location || 'Visakhapatnam'].filter(Boolean).join(' · '),
    url: absolute,
    linkPath,
    tag: `job-alert-${job.id}`,
    icon: `${origin}/icon-192x192.png`,
    badge: `${origin}/icon-192x192.png`,
  };
};

async function loadVapid(admin) {
  const fromEnv = {
    publicKey: (process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '').trim(),
    privateKey: (process.env.VAPID_PRIVATE_KEY || '').trim(),
    subject: (process.env.VAPID_SUBJECT || 'mailto:kkumardadi@gmail.com').trim(),
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

export async function sendPublishedJobWebPush(jobId) {
  const admin = createServiceClient();
  if (!admin) {
    return { ok: false, status: 500, error: 'Supabase is not configured.' };
  }

  const { data: job, error: jobError } = await admin
    .from('jobs')
    .select('id, slug, title, company, location, status, created_by, source_name, source_url')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) {
    throw new Error(jobError.message);
  }
  if (!isDirectPublishedJob(job)) {
    return { ok: true, skipped: true, reason: 'not_direct_job', sent: 0 };
  }

  const { data: alert, error: alertError } = await admin
    .from('job_alerts')
    .select('id, created_at')
    .eq('job_id', job.id)
    .maybeSingle();
  if (alertError) {
    throw new Error(alertError.message);
  }
  if (!alert) {
    return { ok: true, skipped: true, reason: 'no_job_alert', sent: 0 };
  }

  const vapid = await loadVapid(admin);
  if (!vapid.publicKey || !vapid.privateKey) {
    return { ok: true, skipped: true, reason: 'vapid_not_configured', sent: 0 };
  }

  const { data: subscriptions, error: subError } = await admin
    .from('web_push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id');
  if (subError) {
    throw new Error(subError.message);
  }

  const rows = (subscriptions || []).filter((row) => row.user_id !== job.created_by);
  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const message = JSON.stringify(buildWebPushMessage(job));
  let sent = 0;
  const staleIds = [];

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        message,
        { TTL: 60 * 60 * 24, urgency: 'high' },
      );
      sent += 1;
    } catch (error) {
      const statusCode = error?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        if (row.id) staleIds.push(row.id);
      } else {
        console.warn('Web push send failed:', statusCode || error?.message);
      }
    }
  }

  if (staleIds.length > 0) {
    await admin.from('web_push_subscriptions').delete().in('id', staleIds);
  }

  return { ok: true, sent, stale: staleIds.length, total: rows.length };
}
