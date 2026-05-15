import { useEffect, useState } from 'react';
import { EmployerAuthContext } from './employerAuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { setPendingEmployerCompanyName, takePendingEmployerCompanyName } from '../lib/employerOAuth';
import { getAuthRedirectUrl } from '../lib/site';
import { upsertEmployerProfile } from '../services/employerJobs';

const EMPLOYER_ACCESS_CACHE_TTL_MS = 15 * 60 * 1000;
const EMPLOYER_ACCESS_CACHE_KEY = 'vizagjobs:employer-access-cache';

const readEmployerAccessCache = () => {
  try {
    const rawValue = sessionStorage.getItem(EMPLOYER_ACCESS_CACHE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

const writeEmployerAccessCache = (userId, isEmployer, profile) => {
  try {
    sessionStorage.setItem(
      EMPLOYER_ACCESS_CACHE_KEY,
      JSON.stringify({
        userId,
        isEmployer,
        profile,
        expiresAt: Date.now() + EMPLOYER_ACCESS_CACHE_TTL_MS,
      })
    );
  } catch {
    // Ignore cache write failures.
  }
};

const clearEmployerAccessCache = () => {
  try {
    sessionStorage.removeItem(EMPLOYER_ACCESS_CACHE_KEY);
  } catch {
    // Ignore cache clear failures.
  }
};

const getCachedEmployerAccess = (userId) => {
  const cachedValue = readEmployerAccessCache();

  if (!cachedValue || cachedValue.userId !== userId) {
    return null;
  }

  if (typeof cachedValue.expiresAt !== 'number' || cachedValue.expiresAt <= Date.now()) {
    clearEmployerAccessCache();
    return null;
  }

  return {
    isEmployer: Boolean(cachedValue.isEmployer),
    profile: cachedValue.profile ?? null,
  };
};

const applyPendingCompanyFromOAuth = async (user) => {
  if (!supabase || !user) {
    return;
  }

  const pendingCompany = takePendingEmployerCompanyName();
  if (!pendingCompany) {
    return;
  }

  const { data: existing } = await supabase
    .from('employer_profiles')
    .select('company_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing || existing.company_name === 'Your company') {
    await upsertEmployerProfile({
      company_name: pendingCompany,
      contact_email: user.email,
      contact_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
    });
  }
};

const getEmployerProfile = async (userId) => {
  if (!supabase || !userId) {
    return { isEmployer: false, profile: null };
  }

  const { data, error } = await supabase
    .from('employer_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const isEmployer = Boolean(data?.user_id && data.is_active !== false);
  return { isEmployer, profile: data };
};

export function EmployerAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isEmployer, setIsEmployer] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(() => isSupabaseConfigured && Boolean(supabase));
  const [authError, setAuthError] = useState('');

  const refreshEmployerAccess = async (userId) => {
    const access = await getEmployerProfile(userId);
    setIsEmployer(access.isEmployer);
    setProfile(access.profile);
    writeEmployerAccessCache(userId, access.isEmployer, access.profile);
    return access;
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

      if (showLoader) {
        setIsLoading(true);
      }

      setAuthError('');
      setSession(nextSession);

      if (!nextSession?.user) {
        setIsEmployer(false);
        setProfile(null);
        clearEmployerAccessCache();
        if (showLoader) {
          setIsLoading(false);
        }
        return;
      }

      try {
        await applyPendingCompanyFromOAuth(nextSession.user);

        const cached = getCachedEmployerAccess(nextSession.user.id);
        const access =
          cached !== null
            ? { isEmployer: cached.isEmployer, profile: cached.profile }
            : await getEmployerProfile(nextSession.user.id);

        if (!isMounted) {
          return;
        }

        setIsEmployer(access.isEmployer);
        setProfile(access.profile);
        writeEmployerAccessCache(nextSession.user.id, access.isEmployer, access.profile);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setIsEmployer(false);
        setProfile(null);
        setAuthError(error instanceof Error ? error.message : 'Could not verify employer access.');
      } finally {
        if (isMounted && showLoader) {
          setIsLoading(false);
        }
      }
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthError(error.message);
        setIsLoading(false);
        return;
      }

      syncSession(data.session, { showLoader: true });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const shouldShowLoader =
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'USER_UPDATED' ||
        event === 'PASSWORD_RECOVERY';

      syncSession(nextSession, { showLoader: shouldShowLoader });
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

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  };

  const signUp = async ({ email, password, companyName }) => {
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          company_name: companyName,
        },
        emailRedirectTo: getAuthRedirectUrl('/employer/login'),
      },
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      await refreshEmployerAccess(data.user.id);
    }

    return data;
  };

  const signInWithGoogle = async ({ companyName } = {}) => {
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    setPendingEmployerCompanyName(companyName);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl('/employer/login'),
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      throw error;
    }
  };

  const signOut = async () => {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }

    clearEmployerAccessCache();
  };

  return (
    <EmployerAuthContext.Provider
      value={{
        authError,
        isEmployer,
        isLoading,
        isSupabaseConfigured,
        profile,
        refreshEmployerAccess,
        session,
        signIn,
        signInWithGoogle,
        signOut,
        signUp,
        user: session?.user ?? null,
      }}
    >
      {children}
    </EmployerAuthContext.Provider>
  );
}
