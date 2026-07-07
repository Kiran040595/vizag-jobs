import { createClient } from '@supabase/supabase-js';

import { getSupabaseReadKey, pipelineConfig } from './pipeline-env.mjs';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getIstDateString(dateInput = new Date()) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getIstDayBoundsUtc(dateInput = new Date()) {
  const istDate = getIstDateString(dateInput);
  const startUtc = new Date(`${istDate}T00:00:00+05:30`).toISOString();
  const endUtc = new Date(`${istDate}T23:59:59.999+05:30`).toISOString();
  return { istDate, startUtc, endUtc };
}

function getBlogFunctionsUrl() {
  const base = (
    process.env.SUPABASE_FUNCTIONS_URL ||
    process.env.VITE_SUPABASE_FUNCTIONS_URL ||
    (pipelineConfig.supabaseUrl
      ? `${pipelineConfig.supabaseUrl}/functions/v1/generate-daily-blog`
      : '')
  ).replace(/\/$/, '');

  if (base.endsWith('/generate-daily-blog')) {
    return base;
  }
  if (base.endsWith('/fetch-external-jobs')) {
    return base.replace('/fetch-external-jobs', '/generate-daily-blog');
  }
  if (base.includes('/functions/v1')) {
    return `${base.replace(/\/$/, '')}/generate-daily-blog`;
  }
  return pipelineConfig.supabaseUrl
    ? `${pipelineConfig.supabaseUrl}/functions/v1/generate-daily-blog`
    : '';
}

function categorySegment(category) {
  const text = String(category || 'general').trim().toLowerCase();
  return text.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';
}

export function mapJobRowForDailyBlog(job) {
  const slug = String(job.slug || '').trim();
  const category = String(job.category || '').trim();
  return {
    title: job.title,
    company: job.company,
    category: job.category,
    location: job.location,
    work_mode: job.work_mode,
    experience: job.experience,
    salary: job.salary,
    slug,
    path: slug ? `/jobs/${categorySegment(category)}/${slug}` : null,
    posted_at: job.posted_at,
    is_fresher: Boolean(job.is_fresher),
    job_type: job.job_type,
  };
}

export async function fetchTodaysPublishedJobs(dateInput = new Date()) {
  const { startUtc, endUtc, istDate } = getIstDayBoundsUtc(dateInput);
  const supabase = createClient(pipelineConfig.supabaseUrl, getSupabaseReadKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from(pipelineConfig.jobsTable)
    .select('title, company, category, location, work_mode, experience, salary, slug, posted_at, is_fresher, job_type')
    .eq('status', 'published')
    .gte('posted_at', startUtc)
    .lte('posted_at', endUtc)
    .order('posted_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Could not load today's jobs: ${error.message}`);
  }

  return {
    istDate,
    startUtc,
    endUtc,
    jobs: (data || []).map(mapJobRowForDailyBlog),
  };
}

export async function generateDailyBlog({
  jobs,
  date,
  publish,
  skipIfExists,
  minJobs,
  timeoutMs = 180_000,
}) {
  const functionsUrl = getBlogFunctionsUrl();
  if (!functionsUrl) {
    throw new Error('Could not resolve generate-daily-blog function URL.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(functionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: pipelineConfig.supabaseAnonKey,
        Authorization: `Bearer ${pipelineConfig.cronSecret}`,
        'x-fetch-jobs-cron-secret': pipelineConfig.cronSecret,
      },
      body: JSON.stringify({
        jobs,
        date,
        publish,
        skip_if_exists: skipIfExists,
        min_jobs: minJobs,
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`generate-daily-blog returned non-JSON (${res.status}): ${text.slice(0, 300)}`);
    }

    if (!res.ok) {
      throw new Error(data?.error || `generate-daily-blog failed (${res.status})`);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}
