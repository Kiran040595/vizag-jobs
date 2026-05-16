import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

type RawHit = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
  content?: string;
};

type ExtractedJob = {
  title: string;
  company: string;
  location?: string | null;
  apply_url?: string | null;
  posted_at?: string | null;
  summary?: string | null;
  source_url: string;
  source_name?: string | null;
};

type FetchSummary = {
  total: number;
  with_posted_at_within_24h: number;
  without_usable_date: number;
  filtered_out_older_than_24h: number;
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-fetch-jobs-cron-secret',
  'Access-Control-Max-Age': '86400',
};

const FIRECRAWL_SEARCH_URL = 'https://api.firecrawl.dev/v1/search';
const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v1/scrape';
const SCRAPFLY_SCRAPE_URL = 'https://api.scrapfly.io/scrape';
const DEFAULT_SEARCH_QUERIES = [
  'jobs Visakhapatnam hiring',
  'Visakhapatnam Vizag jobs openings',
  'IT jobs Visakhapatnam',
];

const MAX_GEMINI_INPUT_CHARS = 96_000;
const MAX_SEARCH_HITS_FOR_SCRAPE = 4;
const MS_24H = 24 * 60 * 60 * 1000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePostedAt(value?: string | null): number | null {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function summarizeJobs(jobs: ExtractedJob[], cutoff: number): FetchSummary {
  let within = 0;
  let undated = 0;
  let older = 0;

  for (const job of jobs) {
    const ts = parsePostedAt(job.posted_at ?? null);
    if (ts === null) {
      undated += 1;
    } else if (ts >= cutoff) {
      within += 1;
    } else {
      older += 1;
    }
  }

  return {
    total: jobs.length,
    with_posted_at_within_24h: within,
    without_usable_date: undated,
    filtered_out_older_than_24h: older,
  };
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

async function firecrawlSearch(query: string, limit: number, apiKey: string): Promise<RawHit[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(FIRECRAWL_SEARCH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, limit }),
      signal: controller.signal,
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: string }).error)
          : res.statusText;
      throw new Error(`Firecrawl search failed (${res.status}): ${msg}`);
    }

    const data = payload?.data ?? payload?.results ?? payload?.web ?? [];
    const list = Array.isArray(data) ? data : [];
    return list.map((item: Record<string, unknown>) => ({
      url: String(item.url ?? item.link ?? ''),
      title: item.title ? String(item.title) : undefined,
      description: item.description ? String(item.description) : undefined,
      markdown: item.markdown ? String(item.markdown) : undefined,
      content: item.content ? String(item.content) : undefined,
    })).filter((h: RawHit) => Boolean(h.url));
  } finally {
    clearTimeout(timeout);
  }
}

async function firecrawlScrapeUrl(url: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(FIRECRAWL_SCRAPE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      return '';
    }
    const data = payload?.data ?? payload;
    const md = data?.markdown ?? data?.content ?? '';
    return typeof md === 'string' ? md : '';
  } finally {
    clearTimeout(timeout);
  }
}

async function scrapflyScrapeUrl(url: string, apiKey: string): Promise<string> {
  const endpoint = new URL(SCRAPFLY_SCRAPE_URL);
  endpoint.searchParams.set('key', apiKey);
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('render_js', 'true');
  endpoint.searchParams.set('asp', 'true');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(endpoint.toString(), { signal: controller.signal });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      return '';
    }
    const html = payload?.result?.content ?? '';
    return typeof html === 'string' ? stripHtml(html) : '';
  } finally {
    clearTimeout(timeout);
  }
}

function parseQueriesEnv(): string[] {
  const raw = Deno.env.get('FETCH_JOB_SEARCH_QUERIES');
  if (!raw?.trim()) {
    return DEFAULT_SEARCH_QUERIES;
  }
  return raw
    .split(',')
    .map((q) => q.trim())
    .filter(Boolean);
}

function parseScrapflyUrlsEnv(): string[] {
  const raw = Deno.env.get('SCRAPFLY_SCRAPE_URLS');
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
}

async function collectViaFirecrawl(apiKey: string): Promise<{ hits: RawHit[]; provider: 'firecrawl' }> {
  const queries = parseQueriesEnv();
  const limitPerQuery = Number(Deno.env.get('FETCH_JOB_SEARCH_LIMIT') ?? '6') || 6;

  const merged = new Map<string, RawHit>();
  for (const query of queries) {
    const rows = await firecrawlSearch(query, limitPerQuery, apiKey);
    for (const row of rows) {
      if (!merged.has(row.url)) {
        merged.set(row.url, row);
      }
    }
  }

  const hits = [...merged.values()];

  const enrichCount = Math.min(MAX_SEARCH_HITS_FOR_SCRAPE, hits.length);
  for (let i = 0; i < enrichCount; i += 1) {
    const hit = hits[i];
    if (hit.markdown || hit.content) {
      continue;
    }
    const md = await firecrawlScrapeUrl(hit.url, apiKey);
    if (md) {
      hits[i] = { ...hit, markdown: md };
    }
  }

  return { hits, provider: 'firecrawl' };
}

async function collectViaScrapfly(apiKey: string): Promise<{ hits: RawHit[]; provider: 'scrapfly' }> {
  const urls = parseScrapflyUrlsEnv();
  if (urls.length === 0) {
    throw new Error(
      'SCRAPFLY_API_KEY is set but SCRAPFLY_SCRAPE_URLS is empty. Add comma-separated job-board URLs.',
    );
  }

  const hits: RawHit[] = [];
  for (const url of urls.slice(0, 12)) {
    const text = await scrapflyScrapeUrl(url, apiKey);
    hits.push({
      url,
      title: url,
      markdown: text ? `# Source\n${url}\n\n${text}` : '',
    });
  }

  return { hits, provider: 'scrapfly' };
}

function hitsToContextBlob(hits: RawHit[]): string {
  const chunks = hits.map((hit, index) => {
    const head = [hit.title, hit.description].filter(Boolean).join('\n');
    const body = hit.markdown ?? hit.content ?? '';
    return `--- SOURCE ${index + 1} ---\nURL: ${hit.url}\n${head}\n\n${body}`;
  });
  const blob = chunks.join('\n\n');
  if (blob.length <= MAX_GEMINI_INPUT_CHARS) {
    return blob;
  }
  return blob.slice(0, MAX_GEMINI_INPUT_CHARS) + '\n\n[TRUNCATED]';
}

function fallbackJobsFromHits(hits: RawHit[]): ExtractedJob[] {
  return hits.map((hit) => ({
    title: hit.title?.trim() || 'Untitled listing',
    company: 'Unknown',
    location: 'Visakhapatnam / Vizag',
    apply_url: hit.url,
    posted_at: null,
    summary: hit.description?.trim() || null,
    source_url: hit.url,
    source_name: null,
  }));
}

async function geminiExtractJobs(markdown: string, apiKey: string): Promise<ExtractedJob[]> {
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const instruction =
    `You extract job postings relevant to Visakhapatnam (Vizag), Andhra Pradesh, India from the provided web crawl text.\n` +
    `Return ONLY JSON matching the schema. Use ISO 8601 for posted_at when the page states a date; otherwise null.\n` +
    `Deduplicate by source_url. Prefer listings that mention Vizag, Visakhapatnam, or Andhra Pradesh.\n` +
    `If apply URL is missing, use the source page URL as apply_url.\n\n` +
    `--- CONTENT ---\n${markdown}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: instruction }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          jobs: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                company: { type: 'STRING' },
                location: { type: 'STRING' },
                apply_url: { type: 'STRING' },
                posted_at: { type: 'STRING' },
                summary: { type: 'STRING' },
                source_url: { type: 'STRING' },
                source_name: { type: 'STRING' },
              },
              required: ['title', 'company', 'source_url'],
            },
          },
        },
        required: ['jobs'],
      },
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = payload?.error?.message ?? res.statusText;
      throw new Error(`Gemini request failed (${res.status}): ${msg}`);
    }

    const text =
      payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ??
      '';

    if (!text.trim()) {
      throw new Error('Gemini returned no text.');
    }

    const parsed = JSON.parse(text) as { jobs?: ExtractedJob[] };
    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
    return jobs
      .filter((j) => j && typeof j.title === 'string' && typeof j.source_url === 'string')
      .map((j) => ({
        title: String(j.title),
        company: typeof j.company === 'string' && j.company.trim() ? j.company : 'Unknown',
        location: j.location ?? null,
        apply_url: j.apply_url ?? j.source_url,
        posted_at: j.posted_at ?? null,
        summary: j.summary ?? null,
        source_url: String(j.source_url),
        source_name: j.source_name ?? null,
      }));
  } finally {
    clearTimeout(timeout);
  }
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

  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')?.trim();
  const scrapflyKey = Deno.env.get('SCRAPFLY_API_KEY')?.trim();
  const geminiKey = Deno.env.get('GEMINI_API_KEY')?.trim();

  try {
    let hits: RawHit[];
    let provider: 'firecrawl' | 'scrapfly';

    if (firecrawlKey) {
      ({ hits, provider } = await collectViaFirecrawl(firecrawlKey));
    } else if (scrapflyKey) {
      ({ hits, provider } = await collectViaScrapfly(scrapflyKey));
    } else {
      return jsonResponse(
        {
          ok: false,
          error:
            'No crawler configured. Set FIRECRAWL_API_KEY or SCRAPFLY_API_KEY + SCRAPFLY_SCRAPE_URLS as Edge Function secrets.',
        },
        501,
      );
    }

    let jobs: ExtractedJob[];

    if (geminiKey) {
      const contextBlob = hitsToContextBlob(hits);
      try {
        jobs = await geminiExtractJobs(contextBlob, geminiKey);
        if (jobs.length === 0) {
          jobs = fallbackJobsFromHits(hits);
        }
      } catch {
        jobs = fallbackJobsFromHits(hits);
      }
    } else {
      jobs = fallbackJobsFromHits(hits);
    }

    const cutoff = Date.now() - MS_24H;
    const jobs_within_24h = jobs.filter((j) => {
      const ts = parsePostedAt(j.posted_at ?? null);
      return ts !== null && ts >= cutoff;
    });
    const jobs_without_usable_posted_at = jobs.filter((j) => parsePostedAt(j.posted_at ?? null) === null);

    const summary = summarizeJobs(jobs, cutoff);

    return jsonResponse({
      ok: true,
      fetched_at: new Date().toISOString(),
      provider_used: provider,
      gemini_used: Boolean(geminiKey),
      location_focus: 'Visakhapatnam / Vizag',
      jobs,
      jobs_within_24h,
      jobs_without_usable_posted_at,
      summary,
      sources: hits.map((h) => ({ url: h.url, title: h.title ?? null })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Fetch failed.';
    return jsonResponse({ ok: false, error: message }, 502);
  }
});
