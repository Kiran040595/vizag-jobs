import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { buildJobQuestionReplyEmail } from '../_shared/reply-email.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

const JOB_SYSTEM_PROMPT = `You are the AI Assistant for JobsInVizag.in (VizagJobs), a dedicated Visakhapatnam job portal.
Your task is to review candidate questions about a specific job posting and provide an accurate, helpful, and concise answer (2 to 4 sentences) strictly grounded in the official job posting details provided.

Guidelines:
1. Strict Grounding: Base your answer on the job posting facts (title, company, location, salary, experience, education, skills, work mode, eligibility, description).
2. Freshers & Experience: If asked about fresher eligibility, check 'is_fresher', experience, and education details. State clearly whether freshers are eligible or if specific experience is required.
3. Missing Information: If the job posting does not mention the specific detail asked (such as exact interview date, recruiter direct phone number, or internal policies), state clearly and politely: "This specific detail is not specified in the job posting. We suggest applying directly via the application link or checking with HR during the screening round."
4. Zero Scam Tolerance: Genuine employers never charge money for application forms, interviews, or training. If a user asks about fees, explicitly remind them: "JobsInVizag maintains a zero-tolerance policy against paid recruitment. Genuine employers never charge candidates."
5. Tone & Format: Professional, warm, and concise. Do NOT use markdown headers (# or ##). Keep it clean and easy to read on mobile.`;

const GENERAL_SYSTEM_PROMPT = `You are the AI Career Assistant for JobsInVizag.in (VizagJobs), the premier job and recruitment portal in Visakhapatnam (Vizag), Andhra Pradesh.
Your task is to answer candidate and student doubts about job hunting, companies, IT parks (Rushikonda IT SEZ, Hill No. 2), walk-ins, fresher eligibility, industrial sectors (Gajuwaka, Autonagar), salaries, and application procedures in Vizag.

Guidelines:
1. Local Vizag Expertise: Provide practical, grounded guidance relevant to Visakhapatnam and Andhra Pradesh job seekers.
2. Freshers & Walk-ins: Give clear, encouraging advice on eligibility, resume tips, and company walk-in patterns (e.g. IT SEZ firms, BPOs, local software houses).
3. Zero Scam Tolerance: Genuine employers NEVER charge registration fees, training fees, or security deposits. Always remind students to stay safe.
4. Tone & Format: Helpful, professional, and concise (2 to 4 sentences). Do NOT use markdown headers (# or ##). Keep it readable on mobile.`;

function jsonResponse(body: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function getGeminiApiKeys(): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const push = (val: string | undefined | null) => {
    const k = String(val || '').trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    keys.push(k);
  };

  push(Deno.env.get('GEMINI_API_KEY_CHAT'));
  push(Deno.env.get('GEMINI_API_KEY'));
  const extra = Deno.env.get('GEMINI_API_KEYS')?.trim();
  if (extra) {
    for (const part of extra.split(/[\n,]+/)) {
      push(part);
    }
  }
  return keys;
}

function extractGeminiText(payload: Record<string, unknown>): string {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const first = candidates[0] as { content?: { parts?: Array<{ text?: string }> } } | undefined;
  const parts = first?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

async function callGemini(prompt: string, systemPrompt = JOB_SYSTEM_PROMPT): Promise<{ text: string; model: string }> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY is not configured in Supabase secrets.');
  }

  const preferred = Deno.env.get('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;
  const models = [preferred];
  for (const m of FALLBACK_MODELS) {
    if (!models.includes(m)) models.push(m);
  }

  let lastError = 'Gemini generation failed.';

  for (const apiKey of keys) {
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 600,
            },
          }),
          signal: controller.signal,
        });

        const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          const msg =
            (payload.error as { message?: string } | undefined)?.message ||
            res.statusText ||
            `HTTP ${res.status}`;
          lastError = `Gemini API error (${res.status}): ${msg}`;
          if (res.status === 429 || res.status === 503 || res.status === 500) {
            continue;
          }
          throw new Error(lastError);
        }

        const text = extractGeminiText(payload);
        if (!text) {
          lastError = 'Gemini returned an empty reply.';
          continue;
        }

        return { text, model };
      } catch (err) {
        lastError = (err as Error)?.message || String(err);
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  throw new Error(lastError);
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
    return { ok: false as const, error: 'RESEND_API_KEY is not set.' };
  }

  const from =
    Deno.env.get('RESEND_FROM_EMAIL')?.trim() || 'Vizag Jobs <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (payload as { message?: string })?.message ||
        (payload as { error?: string })?.error ||
        `Resend API failed (${res.status})`;
      return { ok: false as const, error: msg };
    }
    return { ok: true as const, id: (payload as { id?: string })?.id || null };
  } catch (err) {
    return { ok: false as const, error: (err as Error)?.message || String(err) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return jsonResponse({
      ok: true,
      service: 'answer-job-question',
      configured: getGeminiApiKeys().length > 0,
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  const supabaseAdmin =
    supabaseUrl && serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey)
      : null;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const question = String(body?.question || '').trim();
  const jobId = body?.jobId ? String(body.jobId).trim() : null;
  const category = body?.category ? String(body.category).trim() : 'general';
  const askerName = body?.askerName ? String(body.askerName).trim() : null;
  const askerEmail = body?.askerEmail ? String(body.askerEmail).trim() : null;
  const askerUserId = body?.askerUserId ? String(body.askerUserId).trim() : null;
  let jobContext = (body?.job as Record<string, unknown>) || null;

  if (!question || question.length < 3) {
    return jsonResponse({ error: 'Please provide a question with at least 3 characters.' }, 400);
  }

  // If job context is not provided or incomplete, fetch job from Supabase
  if ((!jobContext || !jobContext.description) && jobId && supabaseAdmin) {
    try {
      const { data: fetchedJob } = await supabaseAdmin
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();

      if (fetchedJob) {
        jobContext = fetchedJob;
      }
    } catch {
      // Continue with whatever context is available
    }
  }

  // Build the prompt for Gemini
  let fullPrompt = '';
  let activeSystemPrompt = JOB_SYSTEM_PROMPT;

  if (jobContext || jobId) {
    activeSystemPrompt = JOB_SYSTEM_PROMPT;
    const promptLines: string[] = [
      'JOB POSTING DETAILS:',
      `Title: ${jobContext?.title || 'Not specified'}`,
      `Company: ${jobContext?.company || 'Not specified'}`,
      `Location: ${jobContext?.location || 'Visakhapatnam, Andhra Pradesh'}`,
      `Work Mode: ${jobContext?.work_mode || jobContext?.workMode || 'Not specified'}`,
      `Job Type: ${jobContext?.job_type || jobContext?.jobType || 'Not specified'}`,
      `Fresher Eligible: ${jobContext?.is_fresher ? 'Yes (Freshers welcome)' : 'See requirements'}`,
      `Salary / Compensation: ${jobContext?.salary || 'As per industry standards'}`,
      `Experience Required: ${jobContext?.experience || jobContext?.experience_level || 'Not specified'}`,
      `Education / Qualifications: ${jobContext?.education || 'Not specified'}`,
      `Skills: ${Array.isArray(jobContext?.skills) ? jobContext?.skills.join(', ') : jobContext?.skills || 'Not specified'}`,
      `Description / Key Responsibilities: ${String(jobContext?.description || 'Not provided').slice(0, 3000)}`,
      '',
      'CANDIDATE QUESTION:',
      `"${question}"`,
      '',
      'Please review the job details above and provide a clear, factual, and helpful answer for the candidate.'
    ];
    fullPrompt = promptLines.join('\n');
  } else {
    activeSystemPrompt = GENERAL_SYSTEM_PROMPT;
    fullPrompt = [
      `CANDIDATE QUESTION ABOUT VIZAG JOBS / CAREER:`,
      `Category: ${category}`,
      `"${question}"`,
      '',
      'Please provide a clear, factual, and actionable answer for the candidate about Visakhapatnam job market and career guidance.',
    ].join('\n');
  }

  try {
    const { text: answerText, model } = await callGemini(fullPrompt, activeSystemPrompt);

    let savedQuestion: Record<string, unknown> | null = null;

    // Persist to job_questions table using service role client so it publishes immediately
    if (supabaseAdmin) {
      try {
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('job_questions')
          .insert({
            job_id: jobId || null,
            asker_name: askerName || null,
            asker_email: askerEmail || null,
            asker_user_id: askerUserId || null,
            body: question,
            answer_body: answerText,
            status: 'published',
            category: category || 'general',
            answered_at: new Date().toISOString(),
            published_at: new Date().toISOString(),
            answered_by: null,
          })
          .select('id, job_id, asker_name, asker_email, asker_user_id, body, status, category, answer_body, answered_by, answered_at, published_at, published_by, created_at')
          .single();

        if (!insertError && inserted) {
          savedQuestion = inserted;

          const jobTitle = jobContext?.title ? String(jobContext.title) : 'Vizag Job';
          const jobSlug = jobContext?.slug || (jobId ? String(jobId) : null);
          const link = jobSlug ? `/job/${jobSlug}?question=${inserted.id}` : `/community-qa?question=${inserted.id}`;
          const siteUrl = (Deno.env.get('SITE_URL') || 'https://jobsinvizag.in').replace(/\/+$/, '');

          // 1. Notify the asking student in reply_notifications
          if (askerUserId) {
            try {
              await supabaseAdmin
                .from('reply_notifications')
                .upsert({
                  user_id: askerUserId,
                  kind: 'job_question',
                  ref_id: inserted.id,
                  title: `New response for your question: ${jobTitle.slice(0, 60)}`,
                  preview: answerText.slice(0, 180),
                  link_path: link,
                  is_read: false,
                  is_dismissed: false,
                  created_at: new Date().toISOString(),
                }, { onConflict: 'user_id,kind,ref_id' });
            } catch (notifErr) {
              console.warn('Failed to insert asker reply notification:', notifErr);
            }
          }

          // 2. Notify asker via email if email is provided
          if (askerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(askerEmail)) {
            try {
              const emailPayload = buildJobQuestionReplyEmail({
                siteName: 'Vizag Jobs',
                siteUrl,
                askerName: askerName || 'Candidate',
                jobTitle: jobContext?.title ? String(jobContext.title) : 'Vizag Career Guidance',
                jobPath: link,
                company: (jobContext?.company as string) || null,
                originalBody: question,
                answerBody: answerText,
              });
              await sendViaResend({ to: askerEmail, ...emailPayload });
            } catch (emailErr) {
              console.warn('Failed to send question answer email:', emailErr);
            }
          }

          // 3. Notify students who applied to this specific job
          if (jobId) {
            try {
              const { data: applicants } = await supabaseAdmin
                .from('job_applications')
                .select('student_user_id')
                .eq('job_id', jobId);

              if (Array.isArray(applicants) && applicants.length > 0) {
                const notifications = applicants
                  .filter((app) => app?.student_user_id && app.student_user_id !== askerUserId)
                  .map((app) => ({
                    user_id: app.student_user_id,
                    kind: 'job_question',
                    ref_id: inserted.id,
                    title: `New Q&A answered for ${jobTitle.slice(0, 60)}`,
                    preview: `Q: ${question.slice(0, 80)} · A: ${answerText.slice(0, 95)}`,
                    link_path: link,
                    is_read: false,
                    is_dismissed: false,
                  }));

                if (notifications.length > 0) {
                  await supabaseAdmin
                    .from('reply_notifications')
                    .upsert(notifications, { onConflict: 'user_id,kind,ref_id' });
                }
              }
            } catch (appErr) {
              console.warn('Failed to notify job applicants:', appErr);
            }
          }

          // 4. Notify registered students in student_profiles
          try {
            const { data: profiles } = await supabaseAdmin
              .from('student_profiles')
              .select('user_id')
              .not('user_id', 'is', null)
              .limit(100);

            if (Array.isArray(profiles) && profiles.length > 0) {
              const studentNotifs = profiles
                .filter((sp) => sp?.user_id && sp.user_id !== askerUserId)
                .map((sp) => ({
                  user_id: sp.user_id,
                  kind: 'job_question',
                  ref_id: inserted.id,
                  title: `New Q&A: ${jobTitle.slice(0, 60)}`,
                  preview: `Q: ${question.slice(0, 80)} · A: ${answerText.slice(0, 95)}`,
                  link_path: link,
                  is_read: false,
                  is_dismissed: false,
                }));

              if (studentNotifs.length > 0) {
                await supabaseAdmin
                  .from('reply_notifications')
                  .upsert(studentNotifs, { onConflict: 'user_id,kind,ref_id' });
              }
            }
          } catch (profileErr) {
            console.warn('Failed to notify student profiles:', profileErr);
          }
        }
      } catch (saveError) {
        console.error('Failed to persist question to job_questions:', saveError);
      }
    }

    return jsonResponse({
      ok: true,
      answer: answerText,
      question: savedQuestion,
      model,
      source: 'gemini-ai',
      isAiAnswer: true,
    });
  } catch (error) {
    console.error('Failed to answer job question:', error);
    return jsonResponse(
      { error: (error as Error)?.message || 'Failed to review question with AI.' },
      500,
    );
  }
});
