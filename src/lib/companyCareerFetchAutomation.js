import { createAdminJob } from '../services/adminJobs.js';
import {
  fetchCompanyCareerJobs,
  seoOptimizeExternalJob,
} from '../services/externalJobFetch.js';
import { geminiKeyFieldsFromSeoResponse } from './formatGeminiKeyUsage.js';
import {
  getJobPublishBlockReason,
  recoverPublishableFieldsFromOriginal,
} from './jobPublishQuality.js';

const INVALID_APPLY_TOKENS = /^(null|undefined|none|n\/a|na)$/i;
const DEFAULT_COMPANY_SEO_GAP_MS = 1_500;

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function normalizeUrlForCompare(url) {
  const raw = String(url || '').trim().toLowerCase();
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}

export function normalizeCompanyTitleKey(company, title) {
  const cleanCompany = String(company || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const cleanTitle = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!cleanCompany || !cleanTitle) return '';
  return `${cleanCompany}::${cleanTitle}`;
}

export function resolveCompanyJobApplyLink(job, fallbackCareersUrl = '') {
  let apply = String(job?.apply_link || '').trim();
  if (!apply || INVALID_APPLY_TOKENS.test(apply)) {
    apply = String(job?.source_url || fallbackCareersUrl || '').trim();
  }
  return !apply || INVALID_APPLY_TOKENS.test(apply) ? '' : apply;
}

export function buildCompanyExistingJobIndex(existingJobs = []) {
  const slugs = new Set();
  const applyLinks = new Set();
  const companyTitleKeys = new Set();

  for (const row of existingJobs || []) {
    const slug = String(row?.slug || '').trim().toLowerCase();
    if (slug) slugs.add(slug);

    const apply = normalizeUrlForCompare(row?.apply_link);
    if (apply && !INVALID_APPLY_TOKENS.test(apply)) {
      applyLinks.add(apply);
    }

    const ctKey = normalizeCompanyTitleKey(row?.company, row?.title);
    if (ctKey) {
      companyTitleKeys.add(ctKey);
    }
  }

  return { slugs, applyLinks, companyTitleKeys };
}

/**
 * Determine whether an extracted company career job should be skipped before/after SEO.
 * Handles the common case where multiple roles on a company's career page share the
 * same hub `careersUrl` as their `apply_link`.
 */
export function shouldSkipCompanyCareerJob(job, companyCareersUrl, existingIndex) {
  const title = String(job?.title || '').trim();
  const company = String(job?.company || '').trim();
  if (!title || !company) {
    return { skip: true, reason: 'missing title or company' };
  }

  const applyRaw = resolveCompanyJobApplyLink(job, companyCareersUrl);
  const applyNorm = normalizeUrlForCompare(applyRaw);
  if (!applyNorm) {
    return { skip: true, reason: 'missing apply link' };
  }

  const slug = String(job?.slug || '').trim().toLowerCase();
  if (slug && existingIndex?.slugs?.has(slug)) {
    return { skip: true, reason: 'slug already in database' };
  }

  const ctKey = normalizeCompanyTitleKey(company, title);
  if (ctKey && existingIndex?.companyTitleKeys?.has(ctKey)) {
    return { skip: true, reason: 'role already published for this company' };
  }

  const hubNorm = normalizeUrlForCompare(companyCareersUrl);
  const isDistinctJobUrl = !hubNorm || applyNorm !== hubNorm;
  if (isDistinctJobUrl && existingIndex?.applyLinks?.has(applyNorm)) {
    return { skip: true, reason: 'apply link already in database' };
  }

  const qualityReason = getJobPublishBlockReason(job);
  if (qualityReason) {
    return { skip: true, reason: qualityReason };
  }

  return { skip: false, reason: '' };
}

function mergeSeoJob(job, data) {
  const optimized = data?.job;
  if (!optimized) {
    throw new Error('SEO response did not include a job.');
  }

  return {
    ...optimized,
    company: job.company || optimized.company,
    source_name: 'Direct Company Website',
    source_url: job.source_url || optimized.source_url,
    apply_link: resolveCompanyJobApplyLink(optimized, job.apply_link || job.source_url),
    seo_optimized: true,
    seo_show_preview: true,
    seo_meta: {
      ...(optimized.seo_meta && typeof optimized.seo_meta === 'object' ? optimized.seo_meta : {}),
      ...(geminiKeyFieldsFromSeoResponse(data) ?? {}),
      ...(data.gemini_model || data.runtime_ms
        ? {
            gemini_model: data.gemini_model ?? optimized.seo_meta?.gemini_model,
            runtime_ms: data.runtime_ms ?? optimized.seo_meta?.runtime_ms,
            seo_profile: data.seo_profile ?? optimized.seo_meta?.seo_profile,
          }
        : {}),
    },
  };
}

/**
 * Fetch raw Vizag jobs from a company career page and classify them against existing jobs.
 * Used for admin pre-optimization approval review.
 */
export async function fetchAndClassifyCompanyJobs({
  company,
  accessToken,
  existingJobs = [],
  signal,
  services = {},
}) {
  const fetchFn = services.fetchCompanyCareerJobs ?? fetchCompanyCareerJobs;
  const companyName = String(company?.name || '').trim();
  const careersUrl = String(company?.careersUrl || company?.careers_url || '').trim();

  if (!companyName || !careersUrl) {
    throw new Error('Company name and Careers Page URL are required.');
  }

  const existingIndex = buildCompanyExistingJobIndex(existingJobs);

  const fetchData = await fetchFn(accessToken, {
    name: companyName,
    careersUrl,
    website: company?.website,
    category: company?.category,
    location: company?.location,
  });

  if (signal?.aborted) {
    throw new DOMException('Company fetch cancelled.', 'AbortError');
  }

  const rawJobs = Array.isArray(fetchData?.jobs) ? fetchData.jobs : [];
  const classifiedJobs = [];
  const batchSeenKeys = new Set();

  for (let index = 0; index < rawJobs.length; index += 1) {
    const rawJob = rawJobs[index];
    const job = {
      ...rawJob,
      company: companyName,
      source_name: 'Direct Company Website',
      source_url: careersUrl,
      apply_link: resolveCompanyJobApplyLink(rawJob, careersUrl),
      location: rawJob.location || 'Visakhapatnam',
      category: rawJob.category || company?.category || 'General',
    };

    const ctKey = normalizeCompanyTitleKey(job.company, job.title);
    let isDuplicate = false;
    let duplicateReason = '';

    if (ctKey && batchSeenKeys.has(ctKey)) {
      isDuplicate = true;
      duplicateReason = 'duplicate role in same page scrape';
    } else {
      if (ctKey) batchSeenKeys.add(ctKey);
      const preCheck = shouldSkipCompanyCareerJob(job, careersUrl, existingIndex);
      if (preCheck.skip) {
        isDuplicate = true;
        duplicateReason = preCheck.reason;
      }
    }

    classifiedJobs.push({
      ...job,
      isDuplicate,
      duplicateReason,
      selectedForSeo: !isDuplicate,
      seoStatus: 'idle',
      seoError: null,
      optimizedJob: null,
      selectedForPublish: false,
      publishStatus: 'idle',
      publishError: null,
      publishedJob: null,
    });
  }

  return {
    companyName,
    careersUrl,
    scrapeSource: fetchData?.scrape_source || 'direct_html',
    scrapedChars: Number(fetchData?.scraped_chars) || 0,
    jobs: classifiedJobs,
    existingIndex,
  };
}

/**
 * Optimize a single company job with Gemini SEO.
 */
export async function optimizeSingleCompanyJob({
  job,
  company,
  accessToken,
  services = {},
}) {
  const seoFn = services.seoOptimizeExternalJob ?? seoOptimizeExternalJob;
  const companyName = String(company?.name || job?.company || '').trim();
  const careersUrl = String(company?.careersUrl || company?.careers_url || job?.source_url || '').trim();

  const seoData = await seoFn(accessToken, job, job.seo_source_context || '');
  const merged = mergeSeoJob(job, seoData);
  const recovered = recoverPublishableFieldsFromOriginal(job, merged);

  return {
    ...recovered,
    company: companyName,
    source_name: 'Direct Company Website',
    source_url: careersUrl,
    apply_link: resolveCompanyJobApplyLink(recovered, careersUrl),
    seo_optimized: true,
  };
}

/**
 * Publish a single approved SEO-optimized company job.
 */
export async function publishSingleCompanyJob({
  job,
  company,
  existingIndex,
  services = {},
}) {
  const publishFn = services.createAdminJob ?? createAdminJob;
  const companyName = String(company?.name || job?.company || '').trim();
  const careersUrl = String(company?.careersUrl || company?.careers_url || job?.source_url || '').trim();

  const saved = await publishFn(job, 'published');

  if (existingIndex) {
    const savedSlug = String(saved?.slug || job.slug || '').trim().toLowerCase();
    if (savedSlug) existingIndex.slugs?.add(savedSlug);

    const savedCtKey = normalizeCompanyTitleKey(companyName, saved?.title || job.title);
    if (savedCtKey) existingIndex.companyTitleKeys?.add(savedCtKey);

    const savedApply = normalizeUrlForCompare(saved?.apply_link || job.apply_link);
    if (savedApply && savedApply !== normalizeUrlForCompare(careersUrl)) {
      existingIndex.applyLinks?.add(savedApply);
    }
  }

  return saved;
}

/**
 * Run the automated end-to-end Fetch -> Gemini Vizag Filter -> Dedupe -> Gemini SEO -> Publish
 * pipeline for a single company from scripts or one-click automated testing.
 */
export async function runSingleCompanyCareerPipeline({
  company,
  accessToken,
  existingJobs = [],
  onProgress,
  signal,
  seoGapMs = DEFAULT_COMPANY_SEO_GAP_MS,
  services = {},
}) {
  const companyName = String(company?.name || '').trim();
  const careersUrl = String(company?.careersUrl || company?.careers_url || '').trim();

  if (!companyName || !careersUrl) {
    throw new Error('Company name and Careers Page URL are required.');
  }

  const existingIndex = buildCompanyExistingJobIndex(existingJobs);
  const publishedJobs = [];

  const report = {
    company: companyName,
    careersUrl,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    scrapeSource: null,
    scrapedChars: 0,
    cancelled: false,
    stats: {
      fetched: 0,
      queued: 0,
      seoOk: 0,
      seoFailed: 0,
      published: 0,
      skipped: 0,
      publishFailed: 0,
    },
    jobs: [],
  };

  onProgress?.({
    phase: 'fetching',
    company: companyName,
    message: `Scraping ${companyName} careers page & extracting Vizag roles with Gemini…`,
    report,
  });

  const classifiedResult = await fetchAndClassifyCompanyJobs({
    company,
    accessToken,
    existingJobs,
    signal,
    services,
  });

  if (signal?.aborted) {
    report.cancelled = true;
    report.finishedAt = new Date().toISOString();
    throw new DOMException('Company fetch cancelled.', 'AbortError');
  }

  report.scrapeSource = classifiedResult.scrapeSource;
  report.scrapedChars = classifiedResult.scrapedChars;
  report.stats.fetched = classifiedResult.jobs.length;

  const queue = [];
  for (const item of classifiedResult.jobs) {
    if (item.isDuplicate) {
      report.stats.skipped += 1;
      report.jobs.push({
        title: item.title,
        company: companyName,
        location: item.location || 'Visakhapatnam',
        applyLink: item.apply_link,
        status: 'skipped',
        reason: item.duplicateReason,
      });
    } else {
      queue.push(item);
    }
  }

  report.stats.queued = queue.length;

  if (queue.length === 0) {
    report.finishedAt = new Date().toISOString();
    onProgress?.({
      phase: 'done',
      company: companyName,
      message:
        report.stats.fetched === 0
          ? `No active Visakhapatnam/Vizag roles found on ${companyName}'s careers page.`
          : `Found ${report.stats.fetched} Vizag role(s) for ${companyName}, all already published.`,
      report,
    });
    return { stats: report.stats, report, publishedJobs };
  }

  for (let i = 0; i < queue.length; i += 1) {
    if (signal?.aborted) {
      report.cancelled = true;
      report.finishedAt = new Date().toISOString();
      throw new DOMException('Company fetch cancelled.', 'AbortError');
    }

    let job = queue[i];

    if (i > 0 && seoGapMs > 0) {
      await sleepMs(seoGapMs);
    }

    onProgress?.({
      phase: 'seo',
      company: companyName,
      current: i + 1,
      total: queue.length,
      jobTitle: job.title,
      message: `Refining with Gemini SEO (${i + 1}/${queue.length}): "${job.title}"…`,
      report,
    });

    try {
      job = await optimizeSingleCompanyJob({
        job,
        company,
        accessToken,
        services,
      });
      report.stats.seoOk += 1;
    } catch (seoErr) {
      report.stats.seoFailed += 1;
      const errMsg = seoErr instanceof Error ? seoErr.message : String(seoErr);
      report.jobs.push({
        title: job.title,
        company: companyName,
        location: job.location || 'Visakhapatnam',
        applyLink: job.apply_link,
        status: 'seo_failed',
        reason: 'Gemini SEO refinement failed',
        error: errMsg,
      });
      continue;
    }

    const postCheck = shouldSkipCompanyCareerJob(job, careersUrl, existingIndex);
    if (postCheck.skip) {
      report.stats.skipped += 1;
      report.jobs.push({
        title: job.title,
        company: companyName,
        location: job.location || 'Visakhapatnam',
        applyLink: job.apply_link,
        status: 'skipped',
        reason: postCheck.reason,
      });
      continue;
    }

    onProgress?.({
      phase: 'publishing',
      company: companyName,
      current: i + 1,
      total: queue.length,
      jobTitle: job.title,
      message: `Publishing (${i + 1}/${queue.length}): "${job.title}"…`,
      report,
    });

    try {
      const saved = await publishSingleCompanyJob({
        job,
        company,
        existingIndex,
        services,
      });
      report.stats.published += 1;
      publishedJobs.push(saved);

      report.jobs.push({
        id: saved?.id || null,
        title: saved?.title || job.title,
        company: companyName,
        location: saved?.location || job.location || 'Visakhapatnam',
        applyLink: saved?.apply_link || job.apply_link,
        publishedSlug: saved?.slug || job.slug,
        status: 'published',
        reason: 'Refined with Gemini SEO & published',
      });
    } catch (pubErr) {
      report.stats.publishFailed += 1;
      const errMsg = pubErr instanceof Error ? pubErr.message : String(pubErr);
      report.jobs.push({
        title: job.title,
        company: companyName,
        location: job.location || 'Visakhapatnam',
        applyLink: job.apply_link,
        status: 'publish_failed',
        reason: 'Database publish failed',
        error: errMsg,
      });
    }
  }

  report.finishedAt = new Date().toISOString();
  onProgress?.({
    phase: 'done',
    company: companyName,
    message: `Finished ${companyName}: ${report.stats.published} published, ${report.stats.skipped} skipped.`,
    report,
  });

  return { stats: report.stats, report, publishedJobs };
}
