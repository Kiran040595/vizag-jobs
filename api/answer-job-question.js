import { readJsonBody, sendJson, setCors } from './_lib/http.js';
import { createServiceClient } from './_lib/supabaseAuth.js';

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

function getGeminiApiKeys() {
  const keys = [];
  const seen = new Set();
  const push = (val) => {
    const k = String(val || '').trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    keys.push(k);
  };

  push(process.env.GEMINI_API_KEY_CHAT);
  push(process.env.GEMINI_API_KEY);
  const extra = (process.env.GEMINI_API_KEYS || '').trim();
  if (extra) {
    for (const part of extra.split(/[\n,]+/)) {
      push(part);
    }
  }
  return keys;
}

function extractGeminiText(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const first = candidates[0];
  const parts = first?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

async function callGemini(prompt, systemPrompt = JOB_SYSTEM_PROMPT) {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }

  const preferred = (process.env.GEMINI_MODEL || '').trim() || DEFAULT_GEMINI_MODEL;
  const models = [preferred];
  for (const m of FALLBACK_MODELS) {
    if (!models.includes(m)) models.push(m);
  }

  let lastError = 'Gemini generation failed.';

  for (const apiKey of keys) {
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

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

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = payload?.error?.message || res.statusText || `HTTP ${res.status}`;
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
        lastError = err instanceof Error ? err.message : String(err);
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  throw new Error(lastError);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      service: 'answer-job-question',
      configured: getGeminiApiKeys().length > 0,
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const question = String(body?.question || '').trim();
    const jobId = body?.jobId ? String(body.jobId).trim() : null;
    const category = body?.category ? String(body.category).trim() : 'general';
    const askerName = body?.askerName ? String(body.askerName).trim() : null;
    const askerEmail = body?.askerEmail ? String(body.askerEmail).trim() : null;
    const askerUserId = body?.askerUserId ? String(body.askerUserId).trim() : null;
    let jobContext = body?.job && typeof body.job === 'object' ? body.job : null;

    if (!question || question.length < 3) {
      sendJson(res, 400, { ok: false, error: 'Please enter a question with at least 3 characters.' });
      return;
    }

    const admin = createServiceClient();

    // Fetch job details if not provided
    if ((!jobContext || !jobContext.description) && jobId && admin) {
      try {
        const { data: fetchedJob } = await admin
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

    // Build Gemini prompt
    let fullPrompt = '';
    let activeSystemPrompt = JOB_SYSTEM_PROMPT;

    if (jobContext || jobId) {
      activeSystemPrompt = JOB_SYSTEM_PROMPT;
      const promptLines = [
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
        'Please review the job details above and provide a clear, factual, and helpful answer for the candidate.',
      ];
      fullPrompt = promptLines.join('\n');
    } else {
      activeSystemPrompt = GENERAL_SYSTEM_PROMPT;
      fullPrompt = [
        'CANDIDATE QUESTION ABOUT VIZAG JOBS / CAREER:',
        `Category: ${category}`,
        `"${question}"`,
        '',
        'Please provide a clear, factual, and actionable answer for the candidate about Visakhapatnam job market and career guidance.',
      ].join('\n');
    }

    const { text: answerText, model } = await callGemini(fullPrompt, activeSystemPrompt);

    let savedQuestion = null;

    if (admin) {
      try {
        const { data: inserted, error: insertError } = await admin
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

          // 1. Notify the asking student in reply_notifications
          if (askerUserId) {
            try {
              await admin
                .from('reply_notifications')
                .upsert({
                  user_id: askerUserId,
                  kind: 'job_question',
                  ref_id: inserted.id,
                  title: `Gemini answered your question: ${jobTitle.slice(0, 60)}`,
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

          // 2. Notify students who applied to this specific job
          if (jobId) {
            try {
              const { data: applicants } = await admin
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
                  await admin
                    .from('reply_notifications')
                    .upsert(notifications, { onConflict: 'user_id,kind,ref_id' });
                }
              }
            } catch (appErr) {
              console.warn('Failed to notify job applicants:', appErr);
            }
          }

          // 3. Notify registered students in student_profiles
          try {
            const { data: profiles } = await admin
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
                await admin
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

    sendJson(res, 200, {
      ok: true,
      answer: answerText,
      question: savedQuestion,
      model,
      source: 'gemini-ai',
      isAiAnswer: true,
    });
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to review question with AI.',
    });
  }
}
