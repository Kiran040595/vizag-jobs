import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  buildFeedbackReplyEmail,
  buildJobQuestionReplyEmail,
} from '../_shared/reply-email.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

type RequestBody = {
  kind?: 'feedback' | 'job_question';
  id?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(bearer);
  if (userError || !userData?.user?.id) {
    return { ok: false as const, status: 401, message: 'Invalid or expired session.' };
  }

  return { ok: true as const, userId: userData.user.id };
}

async function isAdminUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('Could not verify admin access.');
  return Boolean(data?.user_id);
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

function getJobCategorySegment(job: {
  title?: string | null;
  category?: string | null;
  job_type?: string | null;
  is_fresher?: boolean | null;
  slug?: string | null;
}) {
  const blob = [job.title, job.category, job.job_type]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (job.is_fresher || /\bfresher\b/.test(blob)) return 'fresher';
  if (/\b(bank|finance|account)\b/.test(blob)) return 'bank';
  if (/\b(it|software|developer|engineer)\b/.test(blob) && !/\bcivil|mechanical|electrical\b/.test(blob)) {
    return 'it';
  }
  if (/\bcivil\b/.test(blob)) return 'civil';
  if (/\bmechanical\b/.test(blob)) return 'mechanical';
  if (/\belectrical|eee\b/.test(blob)) return 'electrical';
  if (/\bece|electronics\b/.test(blob)) return 'ece';
  if (/\bbpo|customer support|call center\b/.test(blob)) return 'bpo';
  if (/\bsales|marketing\b/.test(blob)) return 'sales';
  if (/\bhr|human resource|admin\b/.test(blob)) return 'hr';
  if (/\bhealth|nurse|hospital|pharma\b/.test(blob)) return 'healthcare';
  if (/\bteacher|education|tutor\b/.test(blob)) return 'education';
  if (/\bhotel|hospitality|retail\b/.test(blob)) return 'hospitality';
  if (/\blogistics|warehouse|delivery\b/.test(blob)) return 'logistics';
  return 'general';
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

  const auth = await getAuthedUser(req, supabaseAdmin);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.message }, auth.status);
  }

  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const kind = body.kind;
  const id = String(body.id || '').trim();
  if ((kind !== 'feedback' && kind !== 'job_question') || !id) {
    return jsonResponse({ ok: false, error: 'Expected kind and id.' }, 400);
  }

  const siteUrl = (Deno.env.get('SITE_URL') || 'https://jobsinvizag.in').replace(/\/+$/, '');
  const siteName = 'Vizag Jobs';

  try {
    if (kind === 'feedback') {
      const admin = await isAdminUser(supabaseAdmin, auth.userId);
      if (!admin) {
        return jsonResponse({ ok: false, error: 'Admin access required.' }, 403);
      }

      const { data: feedback, error } = await supabaseAdmin
        .from('site_feedback')
        .select('id, author_name, author_email, body, admin_reply, status')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return jsonResponse({ ok: false, error: error.message }, 500);
      }
      if (!feedback) {
        return jsonResponse({ ok: false, error: 'Feedback not found.' }, 404);
      }

      const to = String(feedback.author_email || '').trim();
      const reply = String(feedback.admin_reply || '').trim();
      if (!to || !EMAIL_RE.test(to)) {
        return jsonResponse({ ok: true, skipped: true, reason: 'no_email' });
      }
      if (!reply) {
        return jsonResponse({ ok: true, skipped: true, reason: 'no_reply' });
      }

      const email = buildFeedbackReplyEmail({
        siteName,
        siteUrl,
        authorName: feedback.author_name,
        originalBody: feedback.body || '',
        adminReply: reply,
      });

      const sent = await sendViaResend({ to, ...email });
      if (!sent.ok) {
        return jsonResponse({ ok: false, error: sent.error }, 502);
      }

      return jsonResponse({
        ok: true,
        email_id: sent.id,
        to,
        kind,
        id,
      });
    }

    // job_question
    const { data: question, error: questionError } = await supabaseAdmin
      .from('job_questions')
      .select(`
        id,
        asker_name,
        asker_email,
        body,
        answer_body,
        status,
        job_id,
        job:jobs (
          id,
          slug,
          title,
          company,
          category,
          job_type,
          is_fresher,
          created_by
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (questionError) {
      return jsonResponse({ ok: false, error: questionError.message }, 500);
    }
    if (!question) {
      return jsonResponse({ ok: false, error: 'Question not found.' }, 404);
    }

    const job = Array.isArray(question.job) ? question.job[0] : question.job;
    const admin = await isAdminUser(supabaseAdmin, auth.userId);
    const ownsJob = Boolean(job?.created_by && job.created_by === auth.userId);
    if (!admin && !ownsJob) {
      return jsonResponse({ ok: false, error: 'Not allowed to notify for this question.' }, 403);
    }

    const to = String(question.asker_email || '').trim();
    const answer = String(question.answer_body || '').trim();
    if (!to || !EMAIL_RE.test(to)) {
      return jsonResponse({ ok: true, skipped: true, reason: 'no_email' });
    }
    if (!answer) {
      return jsonResponse({ ok: true, skipped: true, reason: 'no_reply' });
    }
    if (!job?.slug || !job?.title) {
      return jsonResponse({ ok: false, error: 'Job details missing for this question.' }, 500);
    }

    const jobPath = `/jobs/${getJobCategorySegment(job)}/${job.slug}`;
    const email = buildJobQuestionReplyEmail({
      siteName,
      siteUrl,
      askerName: question.asker_name,
      jobTitle: job.title,
      company: job.company,
      jobPath,
      originalBody: question.body || '',
      answerBody: answer,
    });

    const sent = await sendViaResend({ to, ...email });
    if (!sent.ok) {
      return jsonResponse({ ok: false, error: sent.error }, 502);
    }

    return jsonResponse({
      ok: true,
      email_id: sent.id,
      to,
      kind,
      id,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to send reply notification.',
      },
      500,
    );
  }
});
