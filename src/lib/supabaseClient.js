import { createClient } from '@supabase/supabase-js';

const viteEnv =
  (typeof import.meta !== 'undefined' && import.meta.env) ||
  (typeof globalThis !== 'undefined' && globalThis.process?.env) ||
  {};
const supabaseUrl = viteEnv.VITE_SUPABASE_URL;
const supabaseAnonKey = viteEnv.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** Authenticated app client (session refresh, user JWT). */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;

/**
 * Anon-only client for public reads (job lists, published posts, etc.).
 * Avoids waiting on auth lock / token refresh that can leave the home page
 * stuck on "Jobs are loading…" after the first visit (when a session exists).
 */
export const supabasePublic = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'vizagjobs-public-anon',
      },
    })
  : null;
