import { clearJobsCache } from './jobs';
import { supabase } from '../lib/supabaseClient';

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

const normalizeLineItems = (value) =>
  String(value || '')
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

const toBoolean = (value) => Boolean(value);

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

const mapError = (error, fallbackMessage) => {
  if (error?.code === '23505' || error?.message?.toLowerCase().includes('duplicate key')) {
    return new Error('That slug already exists. Please adjust the slug and try again.');
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

export const createAdminJob = async (values, statusOverride) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const payload = serializeJobForm(values, statusOverride);
  const { data, error } = await supabase.from(JOBS_TABLE).insert(payload).select('*').single();

  if (error) {
    throw mapError(error, 'Could not create the job.');
  }

  invalidatePublicJobCache();
  return data;
};

export const updateAdminJob = async (jobId, values, statusOverride) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const payload = serializeJobForm(values, statusOverride);
  const { data, error } = await supabase
    .from(JOBS_TABLE)
    .update(payload)
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

  const { data, error } = await supabase
    .from(JOBS_TABLE)
    .update({ status })
    .eq('id', jobId)
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not update the job status.');
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
