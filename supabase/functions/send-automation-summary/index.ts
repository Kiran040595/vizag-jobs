import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  buildAutomationSummaryEmail,
  type AutomationReport,
} from '../_shared/automation-email.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-fetch-jobs-cron-secret',
  'Access-Control-Max-Age': '86400',
};

type RequestBody = {
  report?: AutomationReport;
  to?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function assertAuthorized(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const cronSecret = Deno.env.get('FETCH_JOBS_CRON_SECRET');
  const altCron = req.headers.get('x-fetch-jobs-cron-secret');
  if (cronSecret && altCron === cronSecret) {
    return { ok: true };
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearer = match?.[1]?.trim() ?? '';

  if (!bearer) {
    return { ok: false, status: 401, message: 'Missing Authorization bearer token.' };
  }

  if (cronSecret && bearer === cronSecret) {
    return { ok: true };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(bearer);
  if (userError || !userData?.user?.id) {
    return { ok: false, status: 401, message: 'Invalid or expired session.' };
  }

  const { data: adminRow, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (adminError) {
    return { ok: false, status: 500, message: 'Could not verify admin access.' };
  }
  if (!adminRow?.user_id) {
    return { ok: false, status: 403, message: 'Admin access required.' };
  }

  return { ok: true };
}

async function sendViaResend({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  if (!apiKey) {
    return { ok: false as const, error: 'RESEND_API_KEY is not set in Edge Function secrets.' };
  }

  const from =
    Deno.env.get('RESEND_FROM_EMAIL')?.trim() || 'Vizag Jobs <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (payload as { message?: string })?.message ||
      (payload as { error?: string })?.error ||
      `Resend API failed (${res.status})`;
    return { ok: false as const, error: message };
  }

  return {
    ok: true as const,
    id: (payload as { id?: string })?.id || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ ok: false, error: 'Supabase server configuration missing.' }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auth = await assertAuthorized(req, supabaseAdmin);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.message }, auth.status);
  }

  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const report = body.report;
  if (!report || typeof report !== 'object') {
    return jsonResponse({ ok: false, error: 'Missing report payload.' }, 400);
  }

  const defaultTo =
    Deno.env.get('AUTOMATION_SUMMARY_EMAIL')?.trim() || 'kkumardadi@gmail.com';
  const to = (body.to || defaultTo).trim();
  if (!to || !to.includes('@')) {
    return jsonResponse({ ok: false, error: 'Invalid recipient email.' }, 400);
  }

  const siteUrl = (Deno.env.get('SITE_URL') || 'https://jobsinvizag.in').replace(/\/$/, '');
  const { subject, html, text } = buildAutomationSummaryEmail(report, {
    siteName: 'Vizag Jobs',
    adminUrl: `${siteUrl}/admin/fetch`,
  });

  const sent = await sendViaResend({ to, subject, html, text });
  if (!sent.ok) {
    return jsonResponse({ ok: false, error: sent.error }, 502);
  }

  return jsonResponse({
    ok: true,
    email_id: sent.id,
    to,
    subject,
  });
});
