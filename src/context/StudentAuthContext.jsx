import { useEffect, useState } from 'react';
import { StudentAuthContext } from './studentAuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { getAuthRedirectUrl } from '../lib/site';
import { upsertStudentProfile } from '../services/studentJobs';

const STUDENT_ACCESS_CACHE_TTL_MS = 15 * 60 * 1000;
const STUDENT_ACCESS_CACHE_KEY = 'vizagjobs:student-access-cache';

const readStudentAccessCache = () => {
  try {
    const rawValue = sessionStorage.getItem(STUDENT_ACCESS_CACHE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

const writeStudentAccessCache = (userId, isStudent, profile) => {
  try {
    sessionStorage.setItem(
      STUDENT_ACCESS_CACHE_KEY,
      JSON.stringify({
        userId,
        isStudent,
        profile,
        expiresAt: Date.now() + STUDENT_ACCESS_CACHE_TTL_MS,
      }),
    );
  } catch {
    // Ignore cache write failures.
  }
};

const clearStudentAccessCache = () => {
  try {
    sessionStorage.removeItem(STUDENT_ACCESS_CACHE_KEY);
  } catch {
    // Ignore cache clear failures.
  }
};

const getCachedStudentAccess = (userId) => {
  const cachedValue = readStudentAccessCache();
  if (!cachedValue || cachedValue.userId !== userId) {
    return null;
  }
  if (typeof cachedValue.expiresAt !== 'number' || cachedValue.expiresAt <= Date.now()) {
    clearStudentAccessCache();
    return null;
  }
  return {
    isStudent: Boolean(cachedValue.isStudent),
    profile: cachedValue.profile ?? null,
  };
};

const getStudentProfile = async (userId) => {
  if (!supabase || !userId) {
    return { isStudent: false, profile: null };
  }

  const { data, error } = await supabase
    .from('student_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const isStudent = Boolean(data?.user_id && data.is_active !== false);
  return { isStudent, profile: data };
};

export function StudentAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isStudent, setIsStudent] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(() => isSupabaseConfigured && Boolean(supabase));
  const [authError, setAuthError] = useState('');

  const refreshStudentAccess = async (userId) => {
    const access = await getStudentProfile(userId);
    setIsStudent(access.isStudent);
    setProfile(access.profile);
    writeStudentAccessCache(userId, access.isStudent, access.profile);
    return access;
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return undefined;
    }

    let isMounted = true;

    const syncSession = async (nextSession, options = {}) => {
      const { showLoader = false } = options;
      if (!isMounted) return;

      if (showLoader) {
        setIsLoading(true);
      }

      setAuthError('');
      setSession(nextSession);

      if (!nextSession?.user) {
        setIsStudent(false);
        setProfile(null);
        clearStudentAccessCache();
        if (showLoader) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const cached = getCachedStudentAccess(nextSession.user.id);
        const access =
          cached !== null
            ? { isStudent: cached.isStudent, profile: cached.profile }
            : await getStudentProfile(nextSession.user.id);

        if (!isMounted) return;

        setIsStudent(access.isStudent);
        setProfile(access.profile);
        writeStudentAccessCache(nextSession.user.id, access.isStudent, access.profile);
      } catch (error) {
        if (!isMounted) return;
        setIsStudent(false);
        setProfile(null);
        setAuthError(error instanceof Error ? error.message : 'Could not verify student access.');
      } finally {
        if (isMounted && showLoader) {
          setIsLoading(false);
        }
      }
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
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

  const signUp = async ({ email, password, fullName, college }) => {
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          user_type: 'student',
          full_name: fullName,
          college,
        },
        emailRedirectTo: getAuthRedirectUrl('/student/login'),
      },
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      const name = String(fullName || '').trim();
      const collegeName = String(college || '').trim();
      if (name && name.toLowerCase() !== 'your name') {
        await upsertStudentProfile({
          full_name: name,
          college: collegeName,
          contact_email: email,
          is_fresher: true,
        }).catch(() => {
          // Trigger may have already created the row.
        });
      }
      await refreshStudentAccess(data.user.id);
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
    clearStudentAccessCache();
  };

  return (
    <StudentAuthContext.Provider
      value={{
        authError,
        isStudent,
        isLoading,
        isSupabaseConfigured,
        profile,
        refreshStudentAccess,
        session,
        signIn,
        signOut,
        signUp,
        user: session?.user ?? null,
      }}
    >
      {children}
    </StudentAuthContext.Provider>
  );
}
