import { useEffect, useState } from 'react';
import { AdminAuthContext } from './adminAuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { deferAuthWork } from '../lib/deferAuthWork';
import { getStoredSupabaseSession, hasStoredSupabaseSession } from '../lib/supabaseSessionHelper';

const ADMIN_ACCESS_CACHE_TTL_MS = 15 * 60 * 1000;
const ADMIN_ACCESS_CACHE_KEY = 'vizagjobs:admin-access-cache';

const readAdminAccessCache = () => {
  try {
    const rawValue = sessionStorage.getItem(ADMIN_ACCESS_CACHE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

const writeAdminAccessCache = (userId, isAdmin) => {
  try {
    sessionStorage.setItem(
      ADMIN_ACCESS_CACHE_KEY,
      JSON.stringify({
        userId,
        isAdmin,
        expiresAt: Date.now() + ADMIN_ACCESS_CACHE_TTL_MS,
      })
    );
  } catch {
    // Ignore cache write failures and keep auth usable.
  }
};

const clearAdminAccessCache = () => {
  try {
    sessionStorage.removeItem(ADMIN_ACCESS_CACHE_KEY);
  } catch {
    // Ignore cache clear failures and keep auth usable.
  }
};

const getCachedAdminAccess = (userId) => {
  const cachedValue = readAdminAccessCache();

  if (!cachedValue || cachedValue.userId !== userId) {
    return null;
  }

  if (typeof cachedValue.expiresAt !== 'number' || cachedValue.expiresAt <= Date.now()) {
    clearAdminAccessCache();
    return null;
  }

  return Boolean(cachedValue.isAdmin);
};

const withTimeout = (promise, ms = 5000) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Admin verification timed out')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

const getAdminMembership = async (userId) => {
  if (!supabase || !userId) {
    return false;
  }

  try {
    const query = supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    const { data, error } = await withTimeout(query, 5000);

    if (error) {
      throw error;
    }

    return Boolean(data?.user_id);
  } catch (err) {
    console.warn('[AdminAuth] Admin check error or timeout:', err);
    return false;
  }
};

export function AdminAuthProvider({ children }) {
  const initialSession = isSupabaseConfigured && Boolean(supabase) ? getStoredSupabaseSession() : null;
  const initialCachedAdmin = initialSession?.user ? getCachedAdminAccess(initialSession.user.id) : null;

  const [session, setSession] = useState(() => initialSession);
  const [isAdmin, setIsAdmin] = useState(() => Boolean(initialCachedAdmin));
  const [isLoading, setIsLoading] = useState(() => {
    if (!isSupabaseConfigured || !supabase) return false;
    if (!hasStoredSupabaseSession()) return false;
    if (initialSession && initialCachedAdmin !== null) return false;
    return true;
  });
  const [authError, setAuthError] = useState('');

  const refreshAdminAccess = async (userId) => {
    try {
      const adminAccess = await getAdminMembership(userId);
      setIsAdmin(adminAccess);
      writeAdminAccessCache(userId, adminAccess);
      return adminAccess;
    } catch (error) {
      setIsAdmin(false);
      setAuthError(error instanceof Error ? error.message : 'Could not verify admin access.');
      return false;
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return undefined;
    }

    let isMounted = true;

    const syncSession = async (nextSession, options = {}) => {
      const { showLoader = false } = options;

      if (!isMounted) {
        return;
      }

      if (showLoader && nextSession?.user) {
        setIsLoading(true);
      }

      setAuthError('');
      setSession(nextSession);

      if (!nextSession?.user) {
        setIsAdmin(false);
        clearAdminAccessCache();
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const cachedAdminAccess = getCachedAdminAccess(nextSession.user.id);
        const adminAccess =
          cachedAdminAccess !== null
            ? cachedAdminAccess
            : await getAdminMembership(nextSession.user.id);

        if (!isMounted) {
          return;
        }

        setIsAdmin(adminAccess);
        writeAdminAccessCache(nextSession.user.id, adminAccess);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setIsAdmin(false);
        setAuthError(error instanceof Error ? error.message : 'Could not verify admin access.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    supabase.auth.getSession().then(({ data, error }) => {
      deferAuthWork(() => {
        if (!isMounted) {
          return;
        }

        if (error) {
          setAuthError(error.message);
          setIsLoading(false);
          return;
        }

        void syncSession(data.session, { showLoader: Boolean(data.session?.user) });
      });
    }).catch(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      deferAuthWork(() => {
        if (!isMounted) {
          return;
        }

        const shouldShowLoader =
          (event === 'SIGNED_OUT' ||
          event === 'USER_UPDATED' ||
          event === 'PASSWORD_RECOVERY') && Boolean(nextSession?.user);

        void syncSession(nextSession, { showLoader: shouldShowLoader });
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async ({ email, password }) => {
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }

    if (data.session?.user) {
      setSession(data.session);
      await refreshAdminAccess(data.session.user.id);
      setIsLoading(false);
    }

    return data;
  };

  const signOut = async () => {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }

    clearAdminAccessCache();
  };

  return (
    <AdminAuthContext.Provider
      value={{
        authError,
        isAdmin,
        isLoading,
        isSupabaseConfigured,
        session,
        signIn,
        signOut,
        user: session?.user ?? null,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}
