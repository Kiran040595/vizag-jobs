import { pipelineConfig } from './pipeline-env.mjs';

function buildSeoJobPayload(job) {
  const isLinkedInPost = job.source_kind === 'linkedin_post';
  const postRaw =
    (typeof job.linkedin_post_text === 'string' && job.linkedin_post_text.trim()) ||
    (typeof job.description === 'string' && job.description.trim()) ||
    '';
  const postText = postRaw ? postRaw.slice(0, isLinkedInPost ? 2_400 : 0) : null;

  return {
    slug: job.slug,
    title: job.title,
    company: job.company,
    location: job.location,
    category: job.category,
    job_type: job.job_type,
    work_mode: job.work_mode,
    experience: job.experience,
    is_fresher: job.is_fresher,
    salary: job.salary,
    apply_link: job.apply_link,
    source_url: job.source_url,
    source_name: job.source_name,
    source_kind: job.source_kind,
    posted_at: job.posted_at,
    short_description:
      typeof job.short_description === 'string' ? job.short_description.slice(0, 600) : job.short_description,
    description: isLinkedInPost
      ? undefined
      : typeof job.description === 'string'
        ? job.description.slice(0, 2_500)
        : job.description,
    responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities.slice(0, 12) : [],
    eligibility: Array.isArray(job.eligibility) ? job.eligibility.slice(0, 10) : [],
    skills: Array.isArray(job.skills) ? job.skills.slice(0, 16) : [],
    linkedin_post_text: postText,
    needs_review: job.needs_review,
    is_likely_hiring_post: job.is_likely_hiring_post,
  };
}

export function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callEdgeFunction(body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(pipelineConfig.functionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: pipelineConfig.supabaseAnonKey,
        Authorization: `Bearer ${pipelineConfig.cronSecret}`,
        'x-fetch-jobs-cron-secret': pipelineConfig.cronSecret,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Edge function returned non-JSON (${res.status}): ${text.slice(0, 300)}`);
    }

    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || `Edge function failed (${res.status})`);
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Edge function timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function startNaukriFetch() {
  return callEdgeFunction(
    {
      mode: 'fetch',
      fetch_channel: 'naukri',
      naukri_action: 'start',
    },
    pipelineConfig.fetchTimeoutMs,
  );
}

export async function collectNaukriFetch(runId) {
  return callEdgeFunction(
    {
      mode: 'fetch',
      fetch_channel: 'naukri',
      naukri_action: 'collect',
      apify_naukri_run_id: runId,
    },
    pipelineConfig.fetchTimeoutMs,
  );
}

export async function fetchNaukriJobs() {
  const started = await startNaukriFetch();
  const runId = started.apify_naukri_run_id;
  if (!runId) {
    throw new Error('Naukri Apify run id missing from start response.');
  }

  const waitMs = Number(started.collect_after_ms) || pipelineConfig.naukriCollectWaitMs;
  console.log(`[auto] Naukri Apify run ${runId} started; waiting ${Math.round(waitMs / 1000)}s before collect…`);
  await sleepMs(waitMs);

  for (let attempt = 1; attempt <= pipelineConfig.naukriCollectMaxAttempts; attempt += 1) {
    const data = await collectNaukriFetch(runId);
    const pending = data.naukri_action === 'pending';
    const emptyWithRetry = Array.isArray(data.jobs) && data.jobs.length === 0 && data.retry_after_sec;

    if (pending || emptyWithRetry) {
      const retryMs = (Number(data.retry_after_sec) || 15) * 1000;
      console.log(`[auto] Apify still running (attempt ${attempt}); retry in ${Math.round(retryMs / 1000)}s`);
      await sleepMs(retryMs);
      continue;
    }

    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    console.log(`[auto] Collected ${jobs.length} Naukri job(s).`);
    return { jobs, meta: data, apifyRunId: runId };
  }

  throw new Error('Naukri Apify run did not finish in time.');
}

export async function fetchLinkedInJobs() {
  const data = await callEdgeFunction(
    { mode: 'fetch', fetch_channel: 'linkedin_jobs' },
    pipelineConfig.fetchTimeoutMs,
  );
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  console.log(`[auto] Fetched ${jobs.length} LinkedIn Jobs listing(s).`);
  return { jobs, meta: data };
}

export async function fetchLinkedInPosts(fetchOptions = {}) {
  const body = {
    mode: 'fetch',
    fetch_channel: 'linkedin_posts',
    linkedin_post_preset: fetchOptions.preset || 'general',
  };
  if (body.linkedin_post_preset === 'custom') {
    const url = String(fetchOptions.customSearchUrl || '').trim();
    if (!url) {
      throw new Error('AUTO_LINKEDIN_CUSTOM_SEARCH_URL required when preset is custom.');
    }
    body.linkedin_custom_search_url = url;
  }

  const data = await callEdgeFunction(body, pipelineConfig.fetchTimeoutMs);
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  console.log(`[auto] Fetched ${jobs.length} LinkedIn post job(s) (preset: ${body.linkedin_post_preset}).`);
  return { jobs, meta: data };
}

export async function fetchJobsForChannel(channel, fetchOptions = {}) {
  if (channel === 'naukri') {
    return fetchNaukriJobs();
  }
  if (channel === 'linkedin_jobs') {
    return fetchLinkedInJobs();
  }
  if (channel === 'linkedin_posts') {
    return fetchLinkedInPosts(fetchOptions);
  }
  throw new Error(`Unsupported automation channel: ${channel}`);
}

export async function seoOptimizeJob(job) {
  const isLinkedInPost = job.source_kind === 'linkedin_post';
  const timeoutMs = isLinkedInPost ? 120_000 : pipelineConfig.seoTimeoutMs;
  const data = await callEdgeFunction(
    {
      mode: 'seo',
      job: buildSeoJobPayload(job),
    },
    timeoutMs,
  );

  if (!data?.job) {
    throw new Error('SEO response missing job payload.');
  }

  return data.job;
}
