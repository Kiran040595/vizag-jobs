import { createClient } from '@supabase/supabase-js';

export const getSupabaseEnv = () => {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, anonKey, serviceRole };
};

export const createUserClient = (accessToken) => {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey || !accessToken) {
    return null;
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const createServiceClient = () => {
  const { url, serviceRole } = getSupabaseEnv();
  if (!url || !serviceRole) {
    return null;
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const getBearerToken = (req) => {
  const header = String(req.headers?.authorization || req.headers?.Authorization || '');
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || '';
};

export const requireUser = async (req) => {
  const token = getBearerToken(req);
  if (!token) {
    return { error: 'Sign in required.', status: 401 };
  }

  const client = createUserClient(token);
  if (!client) {
    return { error: 'Supabase is not configured.', status: 500 };
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);

  if (error || !user) {
    return { error: 'Invalid or expired session.', status: 401 };
  }

  return { user, client, token };
};
