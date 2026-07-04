import { normalizeBlogBodyMarkdown } from '../lib/blogBodyMarkdown.js';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const CACHE_DURATION = 60000;
const DEFAULT_TABLE_NAME = 'blog_posts';
const blogTable = import.meta.env.VITE_SUPABASE_BLOG_TABLE || DEFAULT_TABLE_NAME;

const postsCache = new Map();

const generateListCacheKey = (limit) => `list:${limit ?? 'all'}`;

const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelay * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return [];
};

const mapRowToPost = (row) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  excerpt: row.excerpt || '',
  body: normalizeBlogBodyMarkdown(row.body || ''),
  status: row.status,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * @param {{ limit?: number }} [options]
 * @param {boolean} [forceRefresh]
 */
export const fetchPublishedPosts = async (options = {}, forceRefresh = false) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
    );
  }

  const { limit } = options;
  const cacheKey = generateListCacheKey(limit);
  const cached = postsCache.get(cacheKey);

  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.posts;
  }

  const rows = await retryWithBackoff(async () => {
    let query = supabase
      .from(blogTable)
      .select('id, slug, title, excerpt, body, status, published_at, created_at, updated_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (limit !== undefined && limit !== null) {
      query = query.limit(Number(limit));
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Supabase blog query failed: ${error.message}`);
    }

    if (!Array.isArray(data)) {
      throw new Error('Supabase returned an invalid blog response.');
    }

    return data;
  });

  const posts = rows.map(mapRowToPost);
  postsCache.set(cacheKey, { posts, timestamp: Date.now() });
  return posts;
};

/**
 * @param {string} slug
 * @param {boolean} [forceRefresh]
 */
export const fetchPublishedPostBySlug = async (slug, forceRefresh = false) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
    );
  }

  const normalizedSlug = String(slug || '').trim();
  if (!normalizedSlug) {
    return null;
  }

  const cacheKey = `slug:${normalizedSlug}`;
  const cached = postsCache.get(cacheKey);

  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.post;
  }

  const row = await retryWithBackoff(async () => {
    const { data, error } = await supabase
      .from(blogTable)
      .select('id, slug, title, excerpt, body, status, published_at, created_at, updated_at')
      .eq('status', 'published')
      .eq('slug', normalizedSlug)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase blog query failed: ${error.message}`);
    }

    return data;
  });

  const post = row ? mapRowToPost(row) : null;
  postsCache.set(cacheKey, { post, timestamp: Date.now() });
  return post;
};

export const clearBlogCache = () => {
  postsCache.clear();
};
