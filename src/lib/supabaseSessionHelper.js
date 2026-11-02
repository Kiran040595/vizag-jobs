/**
 * Helper to synchronously inspect if there is any stored Supabase auth token
 * or pending OAuth redirect in the browser before waiting on async getSession().
 */

const getLocalStorageSafely = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

export const hasStoredSupabaseSession = () => {
  const storage = getLocalStorageSafely();
  if (!storage) {
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
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
        const val = storage.getItem(key);
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
  const storage = getLocalStorageSafely();
  if (!storage) {
    return null;
  }

  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
        const val = storage.getItem(key);
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
