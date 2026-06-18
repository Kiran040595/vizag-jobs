import { clearBlogCache } from './blogs';
import { supabase } from '../lib/supabaseClient';


const BLOG_TABLE = import.meta.env.VITE_SUPABASE_BLOG_TABLE || 'blog_posts';

const normalizeText = (value) => String(value || '').trim();

const normalizeOptionalText = (value) => {
  const next = normalizeText(value);
  return next || null;
};

const toIsoString = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const slugify = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

export const createSuggestedBlogSlug = ({ title, publishedAt }) => {
  const parts = [title];
  const date = publishedAt ? new Date(publishedAt) : null;

  if (date && !Number.isNaN(date.getTime())) {
    parts.push(date.toISOString().slice(0, 10));
  }

  return slugify(parts.filter(Boolean).join(' '));
};

const mapError = (error, fallbackMessage) => {
  if (error?.code === '23505' || error?.message?.toLowerCase().includes('duplicate key')) {
    return new Error('That slug already exists. Please adjust the slug and try again.');
  }

  return new Error(error?.message || fallbackMessage);
};

export const getEmptyBlogForm = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return {
    slug: '',
    title: '',
    excerpt: '',
    body: '',
    status: 'draft',
    published_at: localDate,
  };
};

export const serializeBlogForm = (values, statusOverride) => {
  const status = statusOverride || values.status || 'draft';
  let publishedAt = toIsoString(values.published_at);

  if (status === 'published' && !publishedAt) {
    publishedAt = new Date().toISOString();
  }

  if (status !== 'published') {
    publishedAt = publishedAt || null;
  }

  return {
    slug: normalizeText(values.slug),
    title: normalizeText(values.title),
    excerpt: normalizeOptionalText(values.excerpt),
    body: String(values.body ?? ''),
    status,
    published_at: publishedAt,
  };
};

export const deserializeBlogForForm = (post) => {
  const formValues = getEmptyBlogForm();

  return {
    ...formValues,
    slug: post.slug || '',
    title: post.title || '',
    excerpt: post.excerpt || '',
    body: post.body || '',
    status: post.status || 'draft',
    published_at: post.published_at
      ? new Date(post.published_at).toISOString().slice(0, 16)
      : formValues.published_at,
  };
};

export const fetchAdminPosts = async () => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from(BLOG_TABLE)
    .select('*')
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw mapError(error, 'Could not load blog posts.');
  }

  return data || [];
};

export const fetchAdminPostById = async (postId) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from(BLOG_TABLE)
    .select('*')
    .eq('id', postId)
    .maybeSingle();

  if (error) {
    throw mapError(error, 'Could not load the selected post.');
  }

  if (!data) {
    throw new Error('Post not found.');
  }

  return data;
};

export const createAdminPost = async (values, statusOverride) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const payload = serializeBlogForm(values, statusOverride);
  const { data, error } = await supabase.from(BLOG_TABLE).insert(payload).select('*').single();

  if (error) {
    throw mapError(error, 'Could not create the post.');
  }

  clearBlogCache();
  return data;
};

export const updateAdminPost = async (postId, values, statusOverride) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const payload = serializeBlogForm(values, statusOverride);
  const { data, error } = await supabase
    .from(BLOG_TABLE)
    .update(payload)
    .eq('id', postId)
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not update the post.');
  }

  clearBlogCache();
  return data;
};

export const updateAdminPostStatus = async (postId, status) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const updates = { status };
  if (status === 'published') {
    const { data: existing } = await supabase
      .from(BLOG_TABLE)
      .select('published_at')
      .eq('id', postId)
      .maybeSingle();

    if (!existing?.published_at) {
      updates.published_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from(BLOG_TABLE)
    .update(updates)
    .eq('id', postId)
    .select('*')
    .single();

  if (error) {
    throw mapError(error, 'Could not update the post status.');
  }

  clearBlogCache();
  return data;
};
