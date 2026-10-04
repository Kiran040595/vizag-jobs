/**
 * Helper to synchronously inspect if there is any stored Supabase auth token
 * or pending OAuth redirect in the browser before waiting on async getSession().
 */

export const hasStoredSupabaseSession = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    // Check for pending OAuth redirect tokens in URL hash or query
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    if (
      hash.includes('access_token=') ||
      hash.includes('refresh_token=') ||
      search.includes('code=')
    ) {
      return true;
    }

    // Check localStorage for any Supabase auth storage key
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
        const val = window.localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          const session = parsed?.currentSession || parsed;
          if (session?.access_token) {
            return true;
          }
        }
      }
    }
  } catch {
    return false;
  }

  return false;
};

/**
 * Synchronously reads any stored Supabase session from localStorage.
 */
export const getStoredSupabaseSession = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
        const val = window.localStorage.getItem(key);
        if (!val) continue;
        const parsed = JSON.parse(val);
        const session = parsed?.currentSession || parsed;
        if (session?.access_token && session?.user) {
          return session;
        }
      }
    }
  } catch {
    return null;
  }

  return null;
};
