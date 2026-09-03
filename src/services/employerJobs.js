import {
  createSuggestedSlug,
  deserializeJobForForm,
  getEmptyJobForm,
  serializeJobForm,
} from './adminJobs';
import { supabase } from '../lib/supabaseClient';

const JOBS_TABLE = import.meta.env.VITE_SUPABASE_JOBS_TABLE || 'jobs';

const mapError = (error, fallbackMessage) => {
  if (error?.code === '23505' || error?.message?.toLowerCase().includes('duplicate key')) {
    return new Error('That slug already exists. Please adjust the slug and try again.');
  }

  return new Error(error?.message || fallbackMessage);
};

export const getEmptyEmployerJobForm = (companyName = '') => {
  const form = getEmptyJobForm();
  return {
    ...form,
    company: companyName || form.company,
    source_name: '',
    source_url: '',
    apply_mode: 'internal',
    is_featured: false,
    status: 'pending',
  };
};

export const serializeEmployerJobForm = (values) => {
  const payload = serializeJobForm(values, 'pending');
  const applyMode = values.apply_mode === 'external' ? 'external' : 'internal';

  return {
    ...payload,
    apply_mode: applyMode,
    apply_link: applyMode === 'external' ? payload.apply_link : null,
    is_featured: false,
    source_name: null,
    source_url: null,
  };
};

export const fetchEmployerProfile = async () => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in.');
  }

  const { data, error } = await supabase
    .from('employer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw mapError(error, 'Could not load your company profile.');
  }

  return data;
};

export const upsertEmployerProfile = async (profile) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in.');
  }

  const payload = {
    user_id: user.id,
    company_name: String(profile.company_name || '').trim(),
    contact_name: profile.contact_name?.trim() || null,
    contact_email: profile.contact_email?.trim() || user.email,
    phone: profile.phone?.trim() || null,
    website: profile.website?.trim() || null,
    company_logo_url: profile.company_logo_url?.trim() || null,
    is_active: true,
  };

  if (!payload.company_name) {
    throw new Error('Company name is required.');
  }

  const { data, error } = await supabase
    .from('employer_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not save your company profile.');
  }

  return data;
};

export const fetchMyJobs = async (userId) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  let currentUserId = userId;

  if (!currentUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    currentUserId = user?.id;
  }

  if (!currentUserId) {
    throw new Error('You must be signed in.');
  }

  const { data, error } = await supabase
    .from(JOBS_TABLE)
    .select('*')
    .eq('created_by', currentUserId)
    .order('created_at', { ascending: false });

  if (error) {
    throw mapError(error, 'Could not load your job submissions.');
  }

  return data || [];
};

export const fetchMyJobById = async (jobId) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in.');
  }

  const { data, error } = await supabase
    .from(JOBS_TABLE)
    .select('*')
    .eq('id', jobId)
    .eq('created_by', user.id)
    .maybeSingle();

  if (error) {
    throw mapError(error, 'Could not load the job.');
  }

  if (!data) {
    throw new Error('Job not found.');
  }

  return data;
};

export const createEmployerJob = async (values) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in.');
  }

  const payload = {
    ...serializeEmployerJobForm(values),
    created_by: user.id,
  };

  if (!payload.slug) {
    payload.slug = createSuggestedSlug({
      title: payload.title,
      company: payload.company,
      postedAt: payload.posted_at,
    });
  }

  const { data, error } = await supabase.from(JOBS_TABLE).insert(payload).select('*').single();

  if (error) {
    throw mapError(error, 'Could not submit the job for review.');
  }

  return data;
};

export const updateEmployerJob = async (jobId, values) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const existing = await fetchMyJobById(jobId);

  if (!['pending', 'draft'].includes(existing.status)) {
    throw new Error('Only pending submissions can be edited.');
  }

  const payload = serializeEmployerJobForm(values);

  const { data, error } = await supabase
    .from(JOBS_TABLE)
    .update(payload)
    .eq('id', jobId)
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not update the job submission.');
  }

  return data;
};

export { createSuggestedSlug, deserializeJobForForm };
