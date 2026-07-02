import { createClient } from '@supabase/supabase-js';

import { applySystemPostedAtToPayload } from '../../src/lib/jobPostedAt.js';
import { classifyJobRecord } from '../../src/lib/jobCategoryTaxonomy.js';
import {
  PUBLIC_JOB_DISPLAY,
  companyNameForSlug,
  sanitizeJobSeoRecord,
} from '../../src/lib/jobDisplayLabels.js';
import { pipelineConfig } from './pipeline-env.mjs';

const REQUIRED_DEFAULTS = { location: 'Visakhapatnam', experience: PUBLIC_JOB_DISPLAY.experience };
const INVALID_APPLY_TOKENS = /^(null|undefined|none|n\/a|na)$/i;

const normalizeText = (value) => String(value || '').trim();
const normalizeOptionalText = (value) => normalizeText(value) || null;

const toIsoString = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  return ['true', 't', '1', 'yes'].includes(String(value || '').trim().toLowerCase());
};

const normalizeLineItems = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : String(value || '')
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);

const slugify = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const createSuggestedSlug = ({ title, company, postedAt }) => {
  const parts = [title, company];
  const date = postedAt ? new Date(postedAt) : null;
  if (date && !Number.isNaN(date.getTime())) {
    parts.push(date.toISOString().slice(0, 10));
  }
  return slugify(parts.filter(Boolean).join(' '));
};

export const isInvalidApplyLink = (value) => {
  const trimmed = normalizeText(value);
  return !trimmed || INVALID_APPLY_TOKENS.test(trimmed);
};

export const resolveApplyLink = (job) => {
  let applyLink = normalizeText(job?.apply_link);
  if (isInvalidApplyLink(applyLink)) {
    applyLink = normalizeText(job?.source_url) || '';
  }
  return isInvalidApplyLink(applyLink) ? '' : applyLink;
};

export const sanitizeExternalJobForInsert = (values) => {
  const title = normalizeText(values?.title) || 'Job opening';
  const rawCompany = normalizeText(values?.company);
  const company = rawCompany || PUBLIC_JOB_DISPLAY.company;
  const slugCompany = companyNameForSlug(rawCompany) || 'role';
  const postedAt = values?.posted_at;
  let slug = normalizeText(values?.slug);
  if (!slug) {
    slug = createSuggestedSlug({ title, company: slugCompany, postedAt });
  }
  if (!slug) {
    slug = slugify(`${title}-${slugCompany}`);
  }

  const applyLink = resolveApplyLink(values);

  const incomingSeoMeta =
    values?.seo_meta && typeof values.seo_meta === 'object' ? values.seo_meta : null;
  const incomingJsonLd =
    values?.json_ld && typeof values.json_ld === 'object'
      ? values.json_ld
      : incomingSeoMeta?.json_ld && typeof incomingSeoMeta.json_ld === 'object'
        ? incomingSeoMeta.json_ld
        : null;

  const {
    seo_source_context: _seoCtx,
    seo_optimized: _seoOpt,
    seo_custom_instructions: _seoInstr,
    seo_meta: _seoMeta,
    seo_show_preview: _seoPreview,
    linkedin_post_text: _post,
    needs_review: _review,
    is_likely_hiring_post: _hiring,
    source_kind: _kind,
    linkedin_post_preset: _liPreset,
    linkedin_post_preset_label: _liPresetLabel,
    ...rest
  } = values ?? {};

  const sanitized = {
    ...rest,
    title,
    company,
    slug,
    apply_link: applyLink || null,
    location: normalizeText(values?.location) || REQUIRED_DEFAULTS.location,
    category: normalizeText(values?.category) || 'General',
    job_type: normalizeText(values?.job_type) || 'Full-time',
    experience: normalizeText(values?.experience) || REQUIRED_DEFAULTS.experience,
    warning:
      normalizeText(values?.warning) ||
      'Verify job details on the employer site before sharing personal documents or payments. Never pay a fee to apply.',
    json_ld: incomingJsonLd,
    seo_meta: incomingSeoMeta,
    responsibilities: normalizeLineItems(values?.responsibilities),
    eligibility: normalizeLineItems(values?.eligibility),
    skills: normalizeLineItems(values?.skills),
    is_fresher: toBoolean(values?.is_fresher),
  };

  const classified = classifyJobRecord(sanitized);
  return sanitizeJobSeoRecord({
    ...sanitized,
    company: classified.company,
    category: classified.category,
    is_fresher: classified.is_fresher,
    experience: classified.experience,
  });
};

export const serializeJobForm = (values, statusOverride) => {
  const payload = {
    slug: normalizeText(values.slug),
    title: normalizeText(values.title),
    company: normalizeText(values.company),
    location: normalizeText(values.location) || REQUIRED_DEFAULTS.location,
    category: normalizeText(values.category),
    job_type: normalizeText(values.job_type),
    work_mode: normalizeOptionalText(values.work_mode),
    experience: normalizeText(values.experience) || REQUIRED_DEFAULTS.experience,
    is_fresher: toBoolean(values.is_fresher),
    posted_at: toIsoString(values.posted_at) || new Date().toISOString(),
    expires_at: toIsoString(values.expires_at),
    status: statusOverride || values.status || 'draft',
    is_featured: toBoolean(values.is_featured),
    salary: normalizeOptionalText(values.salary),
    apply_link: normalizeOptionalText(values.apply_link),
    short_description: normalizeOptionalText(values.short_description),
    description: normalizeOptionalText(values.description),
    warning: normalizeOptionalText(values.warning),
    source_name: normalizeOptionalText(values.source_name),
    source_url: normalizeOptionalText(values.source_url),
    company_logo_url: normalizeOptionalText(values.company_logo_url),
    responsibilities: normalizeLineItems(values.responsibilities),
    eligibility: normalizeLineItems(values.eligibility),
    skills: normalizeLineItems(values.skills),
  };

  if (values.json_ld && typeof values.json_ld === 'object' && !Array.isArray(values.json_ld)) {
    payload.json_ld = values.json_ld;
  }

  if (values.seo_meta && typeof values.seo_meta === 'object' && !Array.isArray(values.seo_meta)) {
    payload.seo_meta = values.seo_meta;
  }

  return payload;
};

let supabaseAdmin;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(pipelineConfig.supabaseUrl, pipelineConfig.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdmin;
}

export async function fetchExistingJobKeys() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(pipelineConfig.jobsTable)
    .select('slug, apply_link, source_url');

  if (error) {
    throw new Error(`Could not load existing jobs: ${error.message}`);
  }

  const slugs = new Set();
  const applyLinks = new Set();

  for (const row of data || []) {
    const slug = normalizeText(row.slug).toLowerCase();
    if (slug) slugs.add(slug);

    const apply = normalizeText(row.apply_link).toLowerCase();
    if (apply && !isInvalidApplyLink(apply)) {
      applyLinks.add(apply);
    }
  }

  return { slugs, applyLinks };
}

export function getJobDedupeKey(job) {
  const sourceUrl = normalizeText(job?.source_url).toLowerCase();
  if (sourceUrl && sourceUrl.includes('naukri.com')) {
    return sourceUrl;
  }
  const apply = resolveApplyLink(job).toLowerCase();
  return apply || normalizeText(job?.slug).toLowerCase() || sourceUrl;
}

export function shouldSkipJob(job, existing) {
  const applyLink = resolveApplyLink(job);
  if (!applyLink) {
    return { skip: true, reason: 'missing apply link' };
  }

  const slug = normalizeText(job.slug).toLowerCase();
  if (slug && existing.slugs.has(slug)) {
    return { skip: true, reason: 'slug already in database' };
  }

  if (existing.applyLinks.has(applyLink.toLowerCase())) {
    return { skip: true, reason: 'apply link already in database' };
  }

  if (!normalizeText(job.title) || !normalizeText(job.company)) {
    return { skip: true, reason: 'missing title or company' };
  }

  return { skip: false, reason: '' };
}

export async function publishJob(job, status = 'published') {
  const sanitized = sanitizeExternalJobForInsert(job);
  let payload = serializeJobForm(sanitized, status);

  if (status === 'published') {
    payload = applySystemPostedAtToPayload(payload);
  }

  if (!payload.title || !payload.company || !payload.slug) {
    throw new Error('Missing title, company, or slug after SEO.');
  }
  if (!payload.category || !payload.job_type) {
    throw new Error('Missing category or job type after SEO.');
  }
  if (!payload.apply_link) {
    throw new Error('Missing apply link — will not publish.');
  }

  if (pipelineConfig.dryRun) {
    return { dryRun: true, payload };
  }

  const supabase = getSupabaseAdmin();
  const insertOnce = (row) =>
    supabase.from(pipelineConfig.jobsTable).insert(row).select('*').single();

  let { data, error } = await insertOnce(payload);

  if (error?.code === '23505' && payload.slug) {
    const suffix = Date.now().toString(36).slice(-5);
    const nextSlug = `${payload.slug}-${suffix}`.replace(/-+/g, '-').slice(0, 160);
    payload = { ...payload, slug: nextSlug };
    ({ data, error } = await insertOnce(payload));
  }

  if (error) {
    throw new Error(error.message || 'Could not publish job.');
  }

  return data;
}
