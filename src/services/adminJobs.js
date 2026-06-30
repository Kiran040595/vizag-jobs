import { clearJobsCache } from './jobs';
import { supabase } from '../lib/supabaseClient';
import {
  applySystemPostedAtToPayload,
  getSystemPostedAtIso,
  shouldUseSystemPostedAtOnPublish,
} from '../lib/jobPostedAt';

const JOBS_TABLE = import.meta.env.VITE_SUPABASE_JOBS_TABLE || 'jobs';

const MULTILINE_FIELDS = ['responsibilities', 'eligibility', 'skills'];
const OPTIONAL_TEXT_FIELDS = [
  'salary',
  'apply_link',
  'short_description',
  'description',
  'warning',
  'expires_at',
  'source_name',
  'source_url',
  'company_logo_url',
  'work_mode',
];

const REQUIRED_DEFAULTS = {
  location: 'Visakhapatnam',
  experience: 'Not specified',
};

const SUPPORTED_SQL_TABLE_PATTERN = /^insert\s+into\s+(?:public\.)?jobs\s*\(([\s\S]*?)\)\s*values\s*\(([\s\S]*?)\)\s*;?\s*$/i;
const SUPPORTED_JOB_COLUMNS = new Set([
  'slug',
  'title',
  'company',
  'location',
  'category',
  'job_type',
  'work_mode',
  'experience',
  'is_fresher',
  'salary',
  'apply_link',
  'short_description',
  'description',
  'responsibilities',
  'eligibility',
  'warning',
  'posted_at',
  'expires_at',
  'source_name',
  'source_url',
  'skills',
  'company_logo_url',
  'status',
  'is_featured',
  'json_ld',
  'seo_meta',
]);

const splitTopLevelCommaValues = (value, options = {}) => {
  const {
    bracketPairs = { '(': ')', '[': ']', '{': '}' },
  } = options;

  const values = [];
  let currentValue = '';
  let singleQuoteOpen = false;
  let doubleQuoteOpen = false;
  const stack = [];

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const nextCharacter = value[index + 1];

    if (singleQuoteOpen) {
      currentValue += character;
      if (character === "'" && nextCharacter === "'") {
        currentValue += nextCharacter;
        index += 1;
        continue;
      }
      if (character === "'") {
        singleQuoteOpen = false;
      }
      continue;
    }

    if (doubleQuoteOpen) {
      currentValue += character;
      if (character === '"' && nextCharacter === '"') {
        currentValue += nextCharacter;
        index += 1;
        continue;
      }
      if (character === '"') {
        doubleQuoteOpen = false;
      }
      continue;
    }

    if (character === "'") {
      singleQuoteOpen = true;
      currentValue += character;
      continue;
    }

    if (character === '"') {
      doubleQuoteOpen = true;
      currentValue += character;
      continue;
    }

    if (bracketPairs[character]) {
      stack.push(bracketPairs[character]);
      currentValue += character;
      continue;
    }

    if (stack.length > 0 && character === stack[stack.length - 1]) {
      stack.pop();
      currentValue += character;
      continue;
    }

    if (character === ',' && stack.length === 0) {
      values.push(currentValue.trim());
      currentValue = '';
      continue;
    }

    currentValue += character;
  }

  if (singleQuoteOpen || doubleQuoteOpen || stack.length > 0) {
    throw new Error('The SQL query has unclosed quotes or brackets.');
  }

  if (currentValue.trim()) {
    values.push(currentValue.trim());
  }

  return values;
};

const unquoteSqlString = (value) => {
  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith("'") || !trimmedValue.endsWith("'")) {
    return trimmedValue;
  }

  return trimmedValue.slice(1, -1).replaceAll("''", "'");
};

const parsePgArrayLiteral = (value) => {
  const trimmedValue = value.trim();
  if (!trimmedValue.startsWith('{') || !trimmedValue.endsWith('}')) {
    return [];
  }

  const innerValue = trimmedValue.slice(1, -1).trim();
  if (!innerValue) {
    return [];
  }

  return splitTopLevelCommaValues(innerValue, { bracketPairs: {} }).map((item) => {
    const trimmedItem = item.trim();

    if (trimmedItem.startsWith('"') && trimmedItem.endsWith('"')) {
      return trimmedItem.slice(1, -1).replaceAll('""', '"');
    }

    return trimmedItem;
  });
};

const parseSqlLiteral = (token) => {
  const trimmedToken = token.trim();
  const normalizedToken = trimmedToken.toLowerCase();

  if (!trimmedToken) {
    return null;
  }

  if (normalizedToken === 'null') {
    return null;
  }

  if (normalizedToken === 'true') {
    return true;
  }

  if (normalizedToken === 'false') {
    return false;
  }

  if (/^array\s*\[/i.test(trimmedToken) && trimmedToken.endsWith(']')) {
    const innerValue = trimmedToken.replace(/^array\s*\[/i, '').slice(0, -1);
    if (!innerValue.trim()) {
      return [];
    }

    return splitTopLevelCommaValues(innerValue).map((item) => {
      const parsedItem = parseSqlLiteral(item);
      return parsedItem === null ? '' : String(parsedItem);
    });
  }

  if (trimmedToken.startsWith("'") && trimmedToken.endsWith("'")) {
    const stringValue = unquoteSqlString(trimmedToken);
    if (stringValue.startsWith('{') && stringValue.endsWith('}')) {
      return parsePgArrayLiteral(stringValue);
    }

    return stringValue;
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmedToken)) {
    return Number(trimmedToken);
  }

  return trimmedToken;
};

const parseSqlInsertToRecord = (sqlQuery) => {
  const normalizedSql = String(sqlQuery || '').trim();
  const matchedSql = normalizedSql.match(SUPPORTED_SQL_TABLE_PATTERN);

  if (!matchedSql) {
    throw new Error('Use a single INSERT INTO public.jobs (...) VALUES (...) query.');
  }

  const [, rawColumns, rawValues] = matchedSql;
  const columns = splitTopLevelCommaValues(rawColumns, { bracketPairs: {} }).map((column) =>
    column.trim().replace(/^"|"$/g, '').toLowerCase()
  );
  const values = splitTopLevelCommaValues(rawValues);

  if (columns.length !== values.length) {
    throw new Error('The number of SQL columns does not match the number of values.');
  }

  const parsedRecord = {};

  columns.forEach((column, index) => {
    if (!SUPPORTED_JOB_COLUMNS.has(column)) {
      throw new Error(`The SQL column "${column}" is not supported in this importer.`);
    }

    parsedRecord[column] = parseSqlLiteral(values[index]);
  });

  return parsedRecord;
};

const normalizeLineItems = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : String(value || '')
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);

const normalizeText = (value) => String(value || '').trim();

const normalizeOptionalText = (value) => {
  const nextValue = normalizeText(value);
  return nextValue || null;
};

const toIsoString = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalizedValue = String(value || '').trim().toLowerCase();
  return ['true', 't', '1', 'yes'].includes(normalizedValue);
};

const slugify = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

export const createSuggestedSlug = ({ title, company, postedAt }) => {
  const parts = [title, company];
  const date = postedAt ? new Date(postedAt) : null;

  if (date && !Number.isNaN(date.getTime())) {
    parts.push(date.toISOString().slice(0, 10));
  }

  return slugify(parts.filter(Boolean).join(' '));
};

const invalidatePublicJobCache = () => {
  clearJobsCache();
  sessionStorage.removeItem('vizagJobs');
};

const INVALID_APPLY_TOKENS = /^(null|undefined|none|n\/a|na)$/i;

const isInvalidApplyLink = (value) => {
  const trimmed = normalizeText(value);
  return !trimmed || INVALID_APPLY_TOKENS.test(trimmed);
};

/** Normalize fetched / SEO jobs before insert (stable slug, required fields, valid apply link). */
export const sanitizeExternalJobForInsert = (values) => {
  const title = normalizeText(values?.title) || 'Job opening';
  const company = normalizeText(values?.company) || 'Unknown';
  const postedAt = values?.posted_at;
  let slug = normalizeText(values?.slug);
  if (!slug) {
    slug = createSuggestedSlug({ title, company, postedAt });
  }
  if (!slug) {
    slug = slugify(`${title}-${company}`);
  }

  let applyLink = normalizeText(values?.apply_link);
  if (isInvalidApplyLink(applyLink)) {
    applyLink = normalizeText(values?.source_url) || '';
  }

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

  return {
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
  };
};

const mapError = (error, fallbackMessage) => {
  if (error?.code === '23505' || error?.message?.toLowerCase().includes('duplicate key')) {
    return new Error('That slug already exists. Please adjust the slug and try again.');
  }
  if (error?.code === '23502') {
    return new Error(
      `Missing required field: ${error?.message || 'check title, company, category, and job type.'}`,
    );
  }

  return new Error(error?.message || fallbackMessage);
};

export const getEmptyJobForm = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return {
    slug: '',
    title: '',
    company: '',
    location: REQUIRED_DEFAULTS.location,
    category: '',
    job_type: '',
    work_mode: '',
    experience: REQUIRED_DEFAULTS.experience,
    is_fresher: false,
    salary: '',
    apply_link: '',
    short_description: '',
    description: '',
    responsibilities: '',
    eligibility: '',
    warning: '',
    posted_at: localDate,
    expires_at: '',
    source_name: '',
    source_url: '',
    skills: '',
    company_logo_url: '',
    status: 'draft',
    is_featured: false,
  };
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
  };

  OPTIONAL_TEXT_FIELDS.forEach((field) => {
    if (!(field in payload)) {
      payload[field] = normalizeOptionalText(values[field]);
    }
  });

  MULTILINE_FIELDS.forEach((field) => {
    payload[field] = normalizeLineItems(values[field]);
  });

  if (values.json_ld && typeof values.json_ld === 'object' && !Array.isArray(values.json_ld)) {
    payload.json_ld = values.json_ld;
  }

  if (values.seo_meta && typeof values.seo_meta === 'object' && !Array.isArray(values.seo_meta)) {
    payload.seo_meta = values.seo_meta;
  }

  return payload;
};

export const deserializeJobForForm = (job) => {
  const formValues = getEmptyJobForm();

  return {
    ...formValues,
    ...job,
    posted_at: job.posted_at ? new Date(job.posted_at).toISOString().slice(0, 16) : formValues.posted_at,
    expires_at: job.expires_at ? new Date(job.expires_at).toISOString().slice(0, 16) : '',
    responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities.join('\n') : '',
    eligibility: Array.isArray(job.eligibility) ? job.eligibility.join('\n') : '',
    skills: Array.isArray(job.skills) ? job.skills.join('\n') : '',
    is_fresher: Boolean(job.is_fresher),
    is_featured: Boolean(job.is_featured),
  };
};

/**
 * Check whether a slug is already used by *another* job. Used by the SEO
 * approval dialog to surface unique-constraint collisions before the
 * UPDATE round-trip, instead of after a failed save.
 *
 * @param {string} slug
 * @param {string | null | undefined} excludeJobId  Job id to ignore (so
 *        re-saving a job with its existing slug returns false).
 * @returns {Promise<boolean>}
 */
export const isJobSlugTaken = async (slug, excludeJobId) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const trimmed = normalizeText(slug);
  if (!trimmed) return false;

  let query = supabase.from(JOBS_TABLE).select('id').eq('slug', trimmed).limit(1);
  if (excludeJobId) {
    query = query.neq('id', excludeJobId);
  }

  const { data, error } = await query;
  if (error) {
    throw mapError(error, 'Could not verify slug availability.');
  }
  return Array.isArray(data) && data.length > 0;
};

export const fetchAdminJobs = async () => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from(JOBS_TABLE)
    .select('*')
    .order('posted_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw mapError(error, 'Could not load admin jobs.');
  }

  return data || [];
};

export const fetchAdminJobById = async (jobId) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from(JOBS_TABLE)
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    throw mapError(error, 'Could not load the selected job.');
  }

  if (!data) {
    throw new Error('Job not found.');
  }

  return data;
};

export const createAdminJob = async (values, statusOverride) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const sanitized = sanitizeExternalJobForInsert(values);
  let payload = serializeJobForm(sanitized, statusOverride);

  if (shouldUseSystemPostedAtOnPublish(statusOverride, values?.status)) {
    payload = applySystemPostedAtToPayload(payload);
  }

  if (!payload.title || !payload.company || !payload.slug) {
    throw new Error('Missing title, company, or slug. Edit the job or re-run Make SEO, then publish again.');
  }
  if (!payload.category || !payload.job_type) {
    throw new Error('Missing category or job type. Edit the job before publishing.');
  }

  const insertOnce = (row) => supabase.from(JOBS_TABLE).insert(row).select('*').single();

  let { data, error } = await insertOnce(payload);

  if (error?.code === '23505' && payload.slug) {
    const suffix = Date.now().toString(36).slice(-5);
    const nextSlug = `${payload.slug}-${suffix}`.replace(/-+/g, '-').slice(0, 160);
    payload = { ...payload, slug: nextSlug };
    ({ data, error } = await insertOnce(payload));
  }

  if (error) {
    throw mapError(error, 'Could not create the job.');
  }

  invalidatePublicJobCache();
  return data;
};

export const createAdminJobFromSql = async (sqlQuery) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const parsedRecord = parseSqlInsertToRecord(sqlQuery);
  let payload = serializeJobForm(parsedRecord, parsedRecord.status || undefined);
  if (shouldUseSystemPostedAtOnPublish(payload.status, parsedRecord.status)) {
    payload = applySystemPostedAtToPayload(payload);
  }
  const { data, error } = await supabase.from(JOBS_TABLE).insert(payload).select('*').single();

  if (error) {
    throw mapError(error, 'Could not create the job from SQL.');
  }

  invalidatePublicJobCache();
  return data;
};

export const updateAdminJob = async (jobId, values, statusOverride) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const payload = serializeJobForm(values, statusOverride);

  const nextPayload = shouldUseSystemPostedAtOnPublish(statusOverride, values?.status)
    ? applySystemPostedAtToPayload(payload)
    : payload;

  const { data, error } = await supabase
    .from(JOBS_TABLE)
    .update(nextPayload)
    .eq('id', jobId)
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not update the job.');
  }

  invalidatePublicJobCache();
  return data;
};

export const updateAdminJobStatus = async (jobId, status) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  let patch = { status };

  if (status === 'published') {
    const { data: existing, error: fetchError } = await supabase
      .from(JOBS_TABLE)
      .select('status, json_ld, seo_meta')
      .eq('id', jobId)
      .maybeSingle();

    if (fetchError) {
      throw mapError(fetchError, 'Could not load the job before publishing.');
    }

    if (shouldUseSystemPostedAtOnPublish('published', existing?.status)) {
      patch = applySystemPostedAtToPayload({
        status,
        json_ld: existing?.json_ld ?? null,
        seo_meta: existing?.seo_meta ?? null,
      });
    }
  }

  const { data, error } = await supabase
    .from(JOBS_TABLE)
    .update(patch)
    .eq('id', jobId)
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not update the job status.');
  }

  invalidatePublicJobCache();
  return data;
};

export const approveAdminJob = async (jobId) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in as an admin.');
  }

  const now = getSystemPostedAtIso();
  const { data: existing, error: fetchError } = await supabase
    .from(JOBS_TABLE)
    .select('json_ld, seo_meta')
    .eq('id', jobId)
    .maybeSingle();

  if (fetchError) {
    throw mapError(fetchError, 'Could not load the job before approval.');
  }

  const publishPatch = applySystemPostedAtToPayload({
    status: 'published',
    posted_at: now,
    json_ld: existing?.json_ld ?? null,
    seo_meta: existing?.seo_meta ?? null,
  });

  const { data, error } = await supabase
    .from(JOBS_TABLE)
    .update({
      ...publishPatch,
      reviewed_at: now,
      reviewed_by: user.id,
      rejection_reason: null,
    })
    .eq('id', jobId)
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not approve the job.');
  }

  invalidatePublicJobCache();
  return data;
};

export const rejectAdminJob = async (jobId, rejectionReason = '') => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in as an admin.');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(JOBS_TABLE)
    .update({
      status: 'archived',
      reviewed_at: now,
      reviewed_by: user.id,
      rejection_reason: normalizeOptionalText(rejectionReason),
    })
    .eq('id', jobId)
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not reject the job.');
  }

  invalidatePublicJobCache();
  return data;
};

export const toggleAdminJobFeatured = async (jobId, isFeatured) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from(JOBS_TABLE)
    .update({ is_featured: isFeatured })
    .eq('id', jobId)
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not update featured status.');
  }

  invalidatePublicJobCache();
  return data;
};
