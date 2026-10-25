import { supabase } from '../lib/supabaseClient.js';
import { validateCredentialsUpdate } from '../lib/adminUserCredentials.js';

const mapError = (error, fallbackMessage) =>
  new Error(error?.message || fallbackMessage);

/**
 * Fetches the real-time Supabase Auth and profile status of a target user account.
 * (Admin privileges required)
 * @param {string} userId - Auth user UUID
 * @returns {Promise<{
 *   ok: boolean,
 *   user_id: string,
 *   email: string,
 *   email_confirmed: boolean,
 *   email_confirmed_at: string | null,
 *   last_sign_in_at: string | null,
 *   created_at: string,
 *   updated_at: string,
 *   phone: string,
 *   banned_until: string | null,
 *   has_password: boolean,
 *   account_type: 'employer' | 'student' | 'admin' | 'unknown',
 *   is_active: boolean,
 *   display_name: string
 * }>}
 */
export async function fetchUserAccountStatus(userId) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  if (!userId) {
    throw new Error('User ID is required to fetch account status.');
  }

  const { data, error } = await supabase.rpc('admin_get_user_account_status', {
    p_target_user_id: userId,
  });

  if (error) {
    throw mapError(error, 'Could not retrieve user account status.');
  }

  return data;
}

/**
 * Batch-fetches the account status for a list of user IDs.
 * @param {string[]} userIds
 */
export async function fetchUsersAccountStatus(userIds) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const cleanIds = (userIds || []).filter(Boolean);
  if (!cleanIds.length) return [];

  const { data, error } = await supabase.rpc('admin_get_users_account_status', {
    p_user_ids: cleanIds,
  });

  if (error) {
    throw mapError(error, 'Could not batch retrieve user account statuses.');
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Updates a user's login email and/or password.
 * Synchronizes auth.users, auth.identities, and respective profile tables.
 * (Admin privileges required)
 * @param {{
 *   userId: string,
 *   newEmail?: string,
 *   newPassword?: string
 * }} params
 */
export async function updateUserCredentials({ userId, newEmail, newPassword }) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  if (!userId) {
    throw new Error('Target User ID is required.');
  }

  const validation = validateCredentialsUpdate({ newEmail, newPassword });
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { data, error } = await supabase.rpc('admin_update_user_credentials', {
    p_target_user_id: userId,
    p_new_email: validation.cleanEmail || null,
    p_new_password: validation.cleanPassword || null,
  });

  if (error) {
    throw mapError(error, 'Failed to update user credentials.');
  }

  return data;
}
