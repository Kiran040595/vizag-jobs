import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { sendWebPush } from '../_shared/webPushSend.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function siteOrigin() {
  return (Deno.env.get('SITE_URL') || 'https://jobsinvizag.in').replace(/\/$/, '');
}

async function getAuthedUser(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearer = match?.[1]?.trim() ?? '';
  if (!bearer) {
    return { ok: false as const, status: 401, message: 'Missing Authorization bearer token.' };
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || '';
  if (serviceKey && bearer === serviceKey) {
    return { ok: true as const, userId: null, serviceRole: true as const };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(bearer);
  if (userError || !userData?.user?.id) {
    return { ok: false as const, status: 401, message: 'Invalid or expired session.' };
  }

  return { ok: true as const, userId: userData.user.id, serviceRole: false as const };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ ok: false, error: 'Supabase is not configured.' }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const auth = await getAuthedUser(req, supabaseAdmin);
    if (!auth.ok) {
      return jsonResponse({ ok: false, error: auth.message }, auth.status);
    }

    if (!auth.serviceRole && auth.userId) {
      const [{ data: adminRow }, { data: employerRow }] = await Promise.all([
        supabaseAdmin.from('admin_users').select('user_id').eq('user_id', auth.userId).maybeSingle(),
        supabaseAdmin
          .from('employer_profiles')
          .select('user_id')
          .eq('user_id', auth.userId)
          .eq('is_active', true)
          .maybeSingle(),
      ]);
      if (!adminRow?.user_id && !employerRow?.user_id) {
        return jsonResponse({ ok: false, error: 'Not allowed to send job alerts.' }, 403);
      }
    }

    let vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')?.trim() || '';
    let vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')?.trim() || '';
    let vapidSubject = Deno.env.get('VAPID_SUBJECT')?.trim() || 'mailto:kkumardadi@gmail.com';
    if (!vapidPublicKey || !vapidPrivateKey) {
      const { data: vapidRow, error: vapidError } = await supabaseAdmin
        .from('web_push_config')
        .select('public_key, private_key, subject')
        .eq('id', 1)
        .maybeSingle();
      if (vapidError) {
        throw new Error(vapidError.message);
      }
      vapidPublicKey = String(vapidRow?.public_key || '').trim();
      vapidPrivateKey = String(vapidRow?.private_key || '').trim();
      vapidSubject = String(vapidRow?.subject || vapidSubject).trim();
    }
    if (!vapidPublicKey || !vapidPrivateKey) {
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: 'vapid_not_configured',
        sent: 0,
      });
    }

    const body = (await req.json().catch(() => ({}))) as { jobId?: string; job_id?: string };
    const jobId = String(body.jobId || body.job_id || '').trim();
    if (!jobId) {
      return jsonResponse({ ok: false, error: 'jobId is required.' }, 400);
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, slug, title, company, location, status, created_by, source_name, source_url')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError) {
      throw new Error(jobError.message);
    }
    if (!job || job.status !== 'published') {
      return jsonResponse({ ok: false, error: 'Published job not found.' }, 404);
    }

    const sourceName = String(job.source_name || '').trim();
    const sourceUrl = String(job.source_url || '').trim();
    const isDirect = Boolean(job.created_by) || (!sourceName && !sourceUrl);
    if (!isDirect) {
      return jsonResponse({ ok: true, skipped: true, reason: 'not_direct_job', sent: 0 });
    }

    const { data: alert, error: alertError } = await supabaseAdmin
      .from('job_alerts')
      .select('id, created_at')
      .eq('job_id', job.id)
      .maybeSingle();
    if (alertError) {
      throw new Error(alertError.message);
    }
    if (!alert) {
      return jsonResponse({ ok: true, skipped: true, reason: 'no_job_alert', sent: 0 });
    }
    const ageMs = Date.now() - new Date(alert.created_at).getTime();
    if (Number.isFinite(ageMs) && ageMs > 5 * 60 * 1000) {
      return jsonResponse({ ok: true, skipped: true, reason: 'already_notified', sent: 0 });
    }

    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('web_push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id');

    if (subError) {
      throw new Error(subError.message);
    }

    const rows = (subscriptions || []).filter((row) => row.user_id !== job.created_by);
    const origin = siteOrigin();
    const linkPath = job.slug ? `/job/${job.slug}` : '/jobs';
    const payload = {
      title: `New job: ${String(job.title || 'Vizag opening').slice(0, 80)}`,
      body: [job.company, job.location || 'Visakhapatnam'].filter(Boolean).join(' · '),
      url: `${origin}${linkPath}`,
      linkPath,
      tag: `job-alert-${job.id}`,
      icon: `${origin}/icon-192x192.png`,
    };

    let sent = 0;
    const staleIds: string[] = [];

    for (const row of rows) {
      try {
        const result = await sendWebPush(
          { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
          payload,
          { vapidPublicKey, vapidPrivateKey, subject: vapidSubject },
        );
        if (result.gone && row.id) {
          staleIds.push(row.id);
        } else if (result.ok) {
          sent += 1;
        }
      } catch (error) {
        console.warn('Web push send failed:', error);
      }
    }

    if (staleIds.length > 0) {
      await supabaseAdmin.from('web_push_subscriptions').delete().in('id', staleIds);
    }

    return jsonResponse({ ok: true, sent, stale: staleIds.length, total: rows.length });
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to send job notifications.' },
      500,
    );
  }
});
