const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY = 10;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 30;

const CHAT_SYSTEM_PROMPT = `You are the helpful assistant for JobsInVizag.in (also called VizagJobs / Jobs in Vizag), a Visakhapatnam (Vizag) job portal operated by Kiran Kumar.

Your job is to answer common questions about using the website. Be concise (2–5 short sentences or a short bullet list). Use plain language. Prefer linking users to the right page paths on this site.

## Site facts
- Website: https://jobsinvizag.in
- Focus: jobs in Visakhapatnam / Vizag, Andhra Pradesh, India
- Contact email: kkumardadi@gmail.com (replies usually within 2–3 business days)
- Contact page: /contact
- About: /about
- Feedback: /feedback
- Privacy: /privacy-policy | Terms: /terms | Disclaimer: /disclaimer
- JobsInVizag.in is an independent portal. We are NOT the hiring employer for listings. Candidates apply to employers through the site; employers review applications.

## Job seekers / students
- Browse jobs on /jobs (also category pages like /jobs/it, /jobs/fresher, /jobs/part-time, /jobs/civil, /jobs/mechanical, /jobs/electrical, /jobs/ece, /jobs/engineering).
- Register: /student/register — Login: /student/login (Google OAuth or email/password may be available).
- Complete your profile (resume, skills, phone, education) at /student/profile before applying.
- Apply on the job details page after logging in. Track applications at /student/applied-jobs.
- Saved jobs: /saved-jobs
- Forgot password: /student/forgot-password
- For external/source listings, the site may open an external apply flow; follow on-screen instructions.

## Employers
- Register: /employer/register — Login: /employer/login
- Post a job: /employer/jobs/new (listings may need admin approval before going live)
- Manage jobs: /employer/jobs — Edit: /employer/jobs/:id/edit — Applications: /employer/jobs/:id/applications
- Company profile: /employer/profile
- Forgot password: /employer/forgot-password

## Blog & guides
- Blog list: /blog — category guides and local Vizag job market articles are published for job seekers.

## Rules
- Only answer questions about this website, applying/posting jobs here, account help, or general Vizag job-seeking tips related to using the portal.
- Do NOT invent specific open job titles, salaries, companies, or application statuses. If asked for live openings, tell them to browse /jobs or the relevant category page, or use the site search.
- Do NOT claim to change accounts, delete data, approve jobs, or process payments. Direct privacy/account requests to kkumardadi@gmail.com or /contact.
- Do NOT provide medical, legal, or immigration advice.
- If you are unsure, say so and suggest /contact or emailing kkumardadi@gmail.com.
- Keep answers helpful and friendly; no emojis unless the user uses them first.`;

const CHAT_SUGGESTIONS = [
  'How do I apply for a job?',
  'How do employers post a job?',
  'Where can I find fresher jobs in Vizag?',
  'How do I contact support?',
];

/** @type {Map<string, number[]>} */
const rateHits = new Map();

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

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const previous = (rateHits.get(key) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (previous.length >= RATE_MAX_REQUESTS) {
    const oldest = previous[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000));
    rateHits.set(key, previous);
    return { ok: false, retryAfterSec };
  }
  previous.push(now);
  rateHits.set(key, previous);
  if (rateHits.size > 5000) {
    const firstKey = rateHits.keys().next().value;
    if (firstKey) rateHits.delete(firstKey);
  }
  return { ok: true };
}

function getGeminiApiKeys() {
  const keys: string[] = [];
  const seen = new Set<string>();
  const push = (value: string | undefined | null, _label?: string) => {
    const key = String(value || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };

  push(Deno.env.get('GEMINI_API_KEY_CHAT'), 'GEMINI_API_KEY_CHAT');
  push(Deno.env.get('GEMINI_API_KEY'), 'GEMINI_API_KEY');
  const extra = Deno.env.get('GEMINI_API_KEYS')?.trim();
  if (extra) {
    for (const part of extra.split(/[\n,]+/)) {
      push(part);
    }
  }
  return keys;
}

function getModels() {
  const preferred = Deno.env.get('GEMINI_CHAT_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;
  const models = [preferred];
  for (const model of FALLBACK_MODELS) {
    if (!models.includes(model)) models.push(model);
  }
  return models;
}

function extractGeminiText(payload: Record<string, unknown>) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const first = candidates[0] as { content?: { parts?: Array<{ text?: string }> } } | undefined;
  const parts = first?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function normalizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: ChatMessage[] = [];
  for (const item of raw) {
    const role =
      (item as { role?: string })?.role === 'assistant'
        ? 'assistant'
        : (item as { role?: string })?.role === 'user'
          ? 'user'
          : null;
    const content = String((item as { content?: string })?.content || '').trim();
    if (!role || !content) continue;
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw Object.assign(new Error(`Each message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`), {
        statusCode: 400,
      });
    }
    cleaned.push({ role, content });
  }
  return cleaned.slice(-MAX_HISTORY);
}

async function generateChatReply(messages: ChatMessage[]) {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw Object.assign(
      new Error('Chat is not configured. Set GEMINI_API_KEY in Supabase Edge Function secrets.'),
      { statusCode: 503 },
    );
  }

  const models = getModels();
  const contents = messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));

  let lastError = 'Gemini chat request failed.';

  for (const apiKey of keys) {
    for (const model of models) {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: CHAT_SYSTEM_PROMPT }],
            },
            contents,
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 700,
            },
          }),
          signal: controller.signal,
        });

        const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          const message =
            (payload.error as { message?: string } | undefined)?.message ||
            res.statusText ||
            `HTTP ${res.status}`;
          lastError = `Gemini failed (${res.status}): ${message}`;
          if (res.status === 429 || res.status === 503 || res.status === 500) {
            continue;
          }
          throw Object.assign(new Error(lastError), { statusCode: 502 });
        }

        const text = extractGeminiText(payload);
        if (!text) {
          lastError = 'Gemini returned an empty reply.';
          continue;
        }

        return { text, model };
      } catch (error) {
        if ((error as { statusCode?: number })?.statusCode) throw error;
        lastError =
          (error as { name?: string })?.name === 'AbortError'
            ? 'Gemini chat timed out. Please try again.'
            : (error as Error)?.message || String(error);
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  throw Object.assign(new Error(lastError), { statusCode: 502 });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return jsonResponse({
      ok: true,
      configured: getGeminiApiKeys().length > 0,
      suggestions: CHAT_SUGGESTIONS,
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  if (getGeminiApiKeys().length === 0) {
    return jsonResponse(
      {
        error:
          'Chat is temporarily unavailable. Please email kkumardadi@gmail.com or use the Contact page.',
      },
      503,
    );
  }

  const limit = checkRateLimit(`chat:${getClientIp(req)}`);
  if (!limit.ok) {
    return jsonResponse(
      {
        error: 'Too many chat messages. Please wait a few minutes and try again.',
        retryAfterSec: limit.retryAfterSec,
      },
      429,
      { 'Retry-After': String(limit.retryAfterSec) },
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  let messages: ChatMessage[];
  try {
    messages = normalizeMessages(body?.messages);
  } catch (error) {
    return jsonResponse(
      { error: (error as Error)?.message || 'Invalid messages.' },
      (error as { statusCode?: number })?.statusCode || 400,
    );
  }

  if (messages.length === 0) {
    return jsonResponse({ error: 'Send at least one message.' }, 400);
  }
  if (messages[messages.length - 1]?.role !== 'user') {
    return jsonResponse({ error: 'The last message must be from the user.' }, 400);
  }
  while (messages.length > 0 && messages[0].role !== 'user') {
    messages.shift();
  }
  if (messages.length === 0) {
    return jsonResponse({ error: 'Send at least one user message.' }, 400);
  }

  try {
    const { text, model } = await generateChatReply(messages);
    return jsonResponse({
      reply: text,
      model,
      suggestions: CHAT_SUGGESTIONS,
    });
  } catch (error) {
    return jsonResponse(
      { error: (error as Error)?.message || 'Could not generate a reply. Please try again.' },
      (error as { statusCode?: number })?.statusCode || 500,
    );
  }
});
