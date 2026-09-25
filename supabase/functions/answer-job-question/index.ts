import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

const SYSTEM_PROMPT = `You are the AI Assistant for JobsInVizag.in (VizagJobs), a dedicated Visakhapatnam job portal.
Your task is to review candidate questions about a specific job posting and provide an accurate, helpful, and concise answer (2 to 4 sentences) strictly grounded in the official job posting details provided.

Guidelines:
1. Strict Grounding: Base your answer on the job posting facts (title, company, location, salary, experience, education, skills, work mode, eligibility, description).
2. Freshers & Experience: If asked about fresher eligibility, check 'is_fresher', experience, and education details. State clearly whether freshers are eligible or if specific experience is required.
3. Missing Information: If the job posting does not mention the specific detail asked (such as exact interview date, recruiter direct phone number, or internal policies), state clearly and politely: "This specific detail is not specified in the job posting. We suggest applying directly via the application link or checking with HR during the screening round."
4. Zero Scam Tolerance: Genuine employers never charge money for application forms, interviews, or training. If a user asks about fees, explicitly remind them: "JobsInVizag maintains a zero-tolerance policy against paid recruitment. Genuine employers never charge candidates."
5. Tone & Format: Professional, warm, and concise. Do NOT use markdown headers (# or ##). Keep it clean and easy to read on mobile.`;

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

async function callGemini(prompt: string): Promise<{ text: string; model: string }> {
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
              parts: [{ text: SYSTEM_PROMPT }],
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

  const fullPrompt = promptLines.join('\n');

  try {
    const { text: answerText, model } = await callGemini(fullPrompt);

    let savedQuestion: Record<string, unknown> | null = null;

    // Persist to job_questions table using service role client so it publishes immediately
    if (jobId && supabaseAdmin) {
      try {
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('job_questions')
          .insert({
            job_id: jobId,
            asker_name: askerName || null,
            asker_email: askerEmail || null,
            asker_user_id: askerUserId || null,
            body: question,
            answer_body: answerText,
            status: 'published',
            answered_at: new Date().toISOString(),
            published_at: new Date().toISOString(),
            answered_by: null,
          })
          .select('id, job_id, asker_name, asker_email, asker_user_id, body, status, answer_body, answered_by, answered_at, published_at, published_by, created_at')
          .single();

        if (!insertError && inserted) {
          savedQuestion = inserted;

          if (askerUserId) {
            try {
              const jobSlug = jobContext?.slug || jobId;
              const link = `/jobs/${jobSlug}?question=${inserted.id}`;
              await supabaseAdmin
                .from('reply_notifications')
                .insert({
                  user_id: askerUserId,
                  kind: 'job_question',
                  ref_id: inserted.id,
                  title: 'Reply to your job question',
                  preview: answerText.slice(0, 180),
                  link_path: link,
                  is_read: false,
                  is_dismissed: false,
                });
            } catch (notifErr) {
              console.warn('Failed to insert reply notification:', notifErr);
            }
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
    });
  } catch (error) {
    console.error('Failed to answer job question:', error);
    return jsonResponse(
      { error: (error as Error)?.message || 'Failed to review question with AI.' },
      500,
    );
  }
});
