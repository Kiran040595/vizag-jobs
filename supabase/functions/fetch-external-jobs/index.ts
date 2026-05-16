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

const MAX_GEMINI_CHUNK_CHARS = 36_000;
/** Max listing URLs to fully scrape (full markdown beats SERP snippets for extracting individual roles). */
const DEFAULT_SCRAPE_PAGE_LIMIT = 10;
/** Max Gemini calls per request (each processes one chunk of pages). */
const DEFAULT_MAX_GEMINI_CHUNKS = 4;
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
  const scrapeLimit = Math.min(
    Math.max(1, Number(Deno.env.get('FETCH_JOB_SCRAPE_PAGE_LIMIT') ?? String(DEFAULT_SCRAPE_PAGE_LIMIT)) || DEFAULT_SCRAPE_PAGE_LIMIT),
    20,
  );

  const merged = new Map<string, RawHit>();
  for (const query of queries) {
    const rows = await firecrawlSearch(query, limitPerQuery, apiKey);
    for (const row of rows) {
      if (!merged.has(row.url)) {
        merged.set(row.url, row);
      }
    }
  }

  const ordered = [...merged.values()];
  const enriched: RawHit[] = [];

  for (let i = 0; i < ordered.length; i += 1) {
    const hit = ordered[i];
    if (i < scrapeLimit) {
      const md = await firecrawlScrapeUrl(hit.url, apiKey);
      enriched.push({
        ...hit,
        markdown: md || hit.markdown || hit.content || hit.description || '',
      });
    } else {
      enriched.push({
        ...hit,
        markdown: hit.markdown ?? hit.content ?? hit.description ?? '',
      });
    }
  }

  return { hits: enriched, provider: 'firecrawl' };
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

function hitsToContextBlob(hits: RawHit[], startIndex = 0): string {
  const chunks = hits.map((hit, index) => {
    const head = [hit.title, hit.description].filter(Boolean).join('\n');
    const body = hit.markdown ?? hit.content ?? '';
    return `--- SOURCE ${startIndex + index + 1} ---\nPAGE_URL: ${hit.url}\n${head}\n\n${body}`;
  });
  return chunks.join('\n\n');
}

/** Split scraped pages into chunks so each Gemini call stays within limits and focuses on fewer URLs at once. */
function chunkHitsForGemini(hits: RawHit[], maxCharsPerChunk: number): RawHit[][] {
  const chunks: RawHit[][] = [];
  let current: RawHit[] = [];
  let size = 0;

  for (const hit of hits) {
    const one = hitsToContextBlob([hit], 0);
    const needBreak = current.length > 0 && size + one.length > maxCharsPerChunk;
    if (needBreak) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(hit);
    size += one.length;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks.length > 0 ? chunks : [[]];
}

function dedupeJobs(jobs: ExtractedJob[]): ExtractedJob[] {
  const seen = new Set<string>();
  const out: ExtractedJob[] = [];
  for (const j of jobs) {
    const title = j.title.trim().toLowerCase();
    const company = (j.company ?? '').trim().toLowerCase();
    const link = (j.apply_url ?? j.source_url ?? '').trim().toLowerCase();
    const key = `${title}|${company}|${link}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(j);
  }
  return out;
}

/** One row per SERP homepage (e.g. "2328 Vacancies | Naukri") — not what admins want as final jobs list. */
function isLikelyPortalAggregate(job: ExtractedJob): boolean {
  const t = job.title;
  const lower = t.toLowerCase();
  if (/\|\s*(indeed|naukri\.com|linkedin|glassdoor|olx|apna(\.co)?)\s*$/i.test(t)) {
    return true;
  }
  if (/^\d+\s+job vacancies\b/i.test(lower)) {
    return true;
  }
  if (/vacancies in visakhapatnam.*\|/i.test(lower)) {
    return true;
  }
  if (/jobs in visakhapatnam:\s*latest/i.test(lower)) {
    return true;
  }
  if (/^\d+\s+visakhapatnam jobs\b/i.test(lower)) {
    return true;
  }
  return false;
}

function filterAggregatePortalJobs(jobs: ExtractedJob[]): { kept: ExtractedJob[]; removed_count: number } {
  const kept = jobs.filter((j) => !isLikelyPortalAggregate(j));
  return { kept, removed_count: jobs.length - kept.length };
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
    `You are extracting INDIVIDUAL job openings (one employee role at one employer) from web page text crawled from Indian job sites.\n` +
    `GEOGRAPHY: Prefer roles tied to Visakhapatnam / Vizag / Andhra Pradesh when location appears.\n\n` +
    `CRITICAL RULES:\n` +
    `- Output ONE JSON object per SINGLE job posting (e.g. "Warehouse loader" at "Vaaradhi Manpower", "Software Engineer" at "Dr. Reddy's").\n` +
    `- Do NOT output a row for an entire portal landing page. Examples of INVALID rows (never emit these):\n` +
    `  titles like "2328 Job Vacancies In Visakhapatnam - Naukri.com", "700 Job Vacancies ... | Indeed", "472 Visakhapatnam jobs - LinkedIn", search-results headings with only counts.\n` +
    `- If the text only describes a portal without listing separate roles, return an empty jobs array rather than inventing one aggregate row.\n` +
    `- Parse bullet lists, cards, and lines like "Role · Company" or "Role — Company" into separate jobs.\n` +
    `- company = hiring employer / brand when stated (NOT "Unknown" when the employer name appears beside the role). Only use Unknown if no employer is visible.\n` +
    `- title = job title / role name only (short), not the whole page heading.\n` +
    `- source_url = PAGE_URL of THIS chunk section where the role appeared (copy from PAGE_URL line).\n` +
    `- apply_url = absolute URL to apply or job detail if present in markdown links; else null (NOT the generic PAGE_URL unless it is clearly that single job's page).\n` +
    `- posted_at = ISO 8601 only when an explicit date for THAT posting appears; else null.\n` +
    `- summary = one line (skills, salary snippet, or location) when available.\n\n` +
    `Return ONLY JSON matching the schema.\n\n` +
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
      .map((j) => {
        const applyRaw = typeof j.apply_url === 'string' ? j.apply_url.trim() : '';
        return {
          title: String(j.title),
          company: typeof j.company === 'string' && j.company.trim() ? j.company : 'Unknown',
          location: j.location ?? null,
          apply_url: applyRaw.length > 0 ? applyRaw : null,
          posted_at: j.posted_at ?? null,
          summary: j.summary ?? null,
          source_url: String(j.source_url),
          source_name: j.source_name ?? null,
        };
      });
  } finally {
    clearTimeout(timeout);
  }
}

async function geminiExtractJobsChunked(hits: RawHit[], apiKey: string): Promise<ExtractedJob[]> {
  const maxChunks = Math.min(
    Math.max(1, Number(Deno.env.get('FETCH_JOB_MAX_GEMINI_CHUNKS') ?? String(DEFAULT_MAX_GEMINI_CHUNKS)) ||
      DEFAULT_MAX_GEMINI_CHUNKS),
    8,
  );
  const chunks = chunkHitsForGemini(hits, MAX_GEMINI_CHUNK_CHARS).slice(0, maxChunks);
  const merged: ExtractedJob[] = [];

  for (const chunk of chunks) {
    if (chunk.length === 0) {
      continue;
    }
    const blob = hitsToContextBlob(chunk, 0);
    const extracted = await geminiExtractJobs(blob, apiKey);
    merged.push(...extracted);
  }

  return dedupeJobs(merged);
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
    let portal_rows_removed = 0;

    if (geminiKey) {
      try {
        jobs = await geminiExtractJobsChunked(hits, geminiKey);
        const filtered = filterAggregatePortalJobs(jobs);
        portal_rows_removed = filtered.removed_count;
        jobs = filtered.kept;
        if (jobs.length === 0) {
          jobs = fallbackJobsFromHits(hits);
          portal_rows_removed = 0;
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
      extraction_hint:
        'jobs[] aims for one object per role; portal landing-page rows are dropped when individual roles are found. If every row still looks like a homepage, increase FETCH_JOB_SCRAPE_PAGE_LIMIT and tune FETCH_JOB_SEARCH_QUERIES.',
      portal_aggregate_rows_removed: portal_rows_removed,
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
