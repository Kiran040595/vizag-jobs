import { useEffect, useState } from 'react';
import { AdminAuthContext } from './adminAuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const getAdminMembership = async (userId) => {
  if (!supabase || !userId) {
    return false;
  }

  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.user_id);
};

export function AdminAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(() => isSupabaseConfigured && Boolean(supabase));
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return undefined;
    }

    let isMounted = true;

    const syncSession = async (nextSession) => {
      if (!isMounted) {
        return;
      }

      setIsLoading(true);
      setAuthError('');
      setSession(nextSession);

      if (!nextSession?.user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const adminAccess = await getAdminMembership(nextSession.user.id);
        if (!isMounted) {
          return;
        }

        setIsAdmin(adminAccess);
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
      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthError(error.message);
        setIsLoading(false);
        return;
      }

      syncSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      syncSession(nextSession);
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

  const signOut = async () => {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
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
