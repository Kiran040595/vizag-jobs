import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  buildDailyBlogGeminiPrompt,
  buildDailyBlogSlug,
  DAILY_BLOG_RESPONSE_SCHEMA,
  parseDailyBlogGeminiJson,
  pickDailyBlogAngle,
  type DailyBlogJobInput,
} from './gemini-daily-blog-prompt.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-fetch-jobs-cron-secret',
  'Access-Control-Max-Age': '86400',
};

const FIRECRAWL_SEARCH_URL = 'https://api.firecrawl.dev/v1/search';
const DEFAULT_SITE_URL = 'https://jobsinvizag.in';
const DEFAULT_SITE_NAME = 'JobsInVizag.in';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

type RequestBody = {
  jobs?: DailyBlogJobInput[];
  date?: string;
  publish?: boolean;
  skip_if_exists?: boolean;
  min_jobs?: number;
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

function getGeminiApiKeys(): string[] {
  const keys: string[] = [];
  const blogKey = Deno.env.get('GEMINI_API_KEY_BLOG')?.trim();
  if (blogKey) keys.push(blogKey);
  const seoKey = Deno.env.get('GEMINI_API_KEY_SEO')?.trim();
  if (seoKey) keys.push(seoKey);
  const primary = Deno.env.get('GEMINI_API_KEY')?.trim();
  if (primary) keys.push(primary);
  const extra = Deno.env.get('GEMINI_API_KEYS')?.trim();
  if (extra) {
    for (const part of extra.split(/[,\n]+/)) {
      const key = part.trim();
      if (key) keys.push(key);
    }
  }
  return [...new Set(keys)];
}

function getFirecrawlApiKeys(): string[] {
  const keys: string[] = [];
  const blogKey = Deno.env.get('FIRECRAWL_API_KEY_BLOG')?.trim();
  if (blogKey) keys.push(blogKey);
  const primary = Deno.env.get('FIRECRAWL_API_KEY')?.trim();
  if (primary) keys.push(primary);
  const extra = Deno.env.get('FIRECRAWL_API_KEYS')?.trim();
  if (extra) {
    for (const part of extra.split(/[,\n]+/)) {
      const key = part.trim();
      if (key) keys.push(key);
    }
  }
  return [...new Set(keys)];
}

function extractGeminiText(payload: Record<string, unknown>): string {
  const candidates = payload.candidates as Array<Record<string, unknown>> | undefined;
  const parts = candidates?.[0]?.content as { parts?: Array<{ text?: string }> } | undefined;
  const text = parts?.parts?.map((part) => part.text || '').join('') || '';
  if (!text.trim()) {
    throw new Error('Gemini returned an empty blog response.');
  }
  return text;
}

async function geminiGenerateBlog(prompt: string): Promise<ReturnType<typeof parseDailyBlogGeminiJson>> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY (or GEMINI_API_KEY_BLOG) is required for daily blog generation.');
  }

  const model = Deno.env.get('GEMINI_BLOG_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;
  let lastError = 'Gemini blog request failed.';

  for (const apiKey of keys) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: DAILY_BLOG_RESPONSE_SCHEMA,
          },
        }),
        signal: controller.signal,
      });

      const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const message = (payload.error as { message?: string } | undefined)?.message || res.statusText;
        lastError = `Gemini failed (${res.status}): ${message}`;
        continue;
      }

      const text = extractGeminiText(payload);
      return parseDailyBlogGeminiJson(text);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(lastError);
}

type SearchHit = { title?: string; url?: string; description?: string; markdown?: string };

async function firecrawlSearchOnce(query: string, limit: number, apiKey: string): Promise<SearchHit[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(FIRECRAWL_SEARCH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit,
        scrapeOptions: { formats: ['markdown'] },
      }),
      signal: controller.signal,
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Firecrawl search failed (${res.status})`);
    }

    const data = (payload as { data?: SearchHit[] }).data;
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWebMarketContext(displayDate: string): Promise<string> {
  const keys = getFirecrawlApiKeys();
  if (keys.length === 0) {
    return '';
  }

  const queries = [
    `Visakhapatnam Vizag jobs hiring ${displayDate}`,
    `Andhra Pradesh employment news Visakhapatnam`,
    `Vizag IT pharma manufacturing hiring trends`,
  ];

  const snippets: string[] = [];
  const apiKey = keys[0];

  for (const query of queries) {
    try {
      const hits = await firecrawlSearchOnce(query, 3, apiKey);
      for (const hit of hits) {
        const chunk = [
          hit.title ? `Title: ${hit.title}` : '',
          hit.url ? `URL: ${hit.url}` : '',
          hit.description ? `Snippet: ${hit.description}` : '',
          hit.markdown ? `Content: ${String(hit.markdown).slice(0, 900)}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        if (chunk) snippets.push(chunk);
      }
    } catch {
      // Optional enrichment — continue without blocking blog generation.
    }
  }

  return snippets.join('\n\n---\n\n').slice(0, 6000);
}

function resolveIstDateInput(raw?: string) {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T12:00:00+05:30`);
  }
  return new Date();
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
    body = {};
  }

  const jobs = Array.isArray(body.jobs) ? body.jobs : [];
  const dateInput = resolveIstDateInput(body.date);
  const minJobs = Math.max(0, Number(body.min_jobs ?? Deno.env.get('AUTO_DAILY_BLOG_MIN_JOBS') ?? 1));
  const publish =
    body.publish ??
    !['0', 'false', 'no'].includes(String(Deno.env.get('AUTO_DAILY_BLOG_PUBLISH') ?? 'true').toLowerCase());
  const skipIfExists =
    body.skip_if_exists ??
    !['0', 'false', 'no'].includes(String(Deno.env.get('AUTO_DAILY_BLOG_SKIP_IF_EXISTS') ?? 'true').toLowerCase());

  if (jobs.length < minJobs) {
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: `Only ${jobs.length} job(s) today; minimum is ${minJobs}.`,
      jobs_count: jobs.length,
    });
  }

  const angle = pickDailyBlogAngle(dateInput);
  const expectedSlug = buildDailyBlogSlug(dateInput, angle.id);
  const blogTable = Deno.env.get('SUPABASE_BLOG_TABLE')?.trim() || 'blog_posts';

  if (skipIfExists) {
    const { data: existing } = await supabaseAdmin
      .from(blogTable)
      .select('id, slug, status')
      .eq('slug', expectedSlug)
      .maybeSingle();

    if (existing?.id) {
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: 'Blog post for this date/angle already exists.',
        slug: existing.slug,
        post_id: existing.id,
        status: existing.status,
      });
    }
  }

  const siteUrl = (Deno.env.get('SITE_URL') || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const siteName = Deno.env.get('SITE_LEGAL_NAME')?.trim() || DEFAULT_SITE_NAME;
  const displayDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateInput);

  const webContext = await fetchWebMarketContext(displayDate);
  const prompt = buildDailyBlogGeminiPrompt({
    jobs,
    webContext,
    siteName,
    siteUrl,
    dateInput,
    angle,
  });

  const article = await geminiGenerateBlog(prompt);
  const slug = article.slug || expectedSlug;
  const nowIso = new Date().toISOString();
  const status = publish ? 'published' : 'draft';

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from(blogTable)
    .insert({
      slug,
      title: article.title,
      excerpt: article.excerpt || article.title,
      body: article.body,
      status,
      published_at: publish ? nowIso : null,
    })
    .select('id, slug, title, status, published_at')
    .single();

  if (insertError) {
    return jsonResponse({ ok: false, error: insertError.message }, 500);
  }

  return jsonResponse({
    ok: true,
    skipped: false,
    post: inserted,
    angle_id: article.angleId || angle.id,
    editorial_notes: article.editorialNotes,
    jobs_count: jobs.length,
    web_context_chars: webContext.length,
    publish,
  });
});
