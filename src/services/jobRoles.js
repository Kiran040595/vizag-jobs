import { supabasePublic } from '../lib/supabaseClient.js';
import { normalizeRoleLabel, roleKey } from '../lib/studentRoles.js';

/** Search the shared catalog before applying the limit, so rare new roles remain discoverable. */
export const fetchStudentRoleSuggestions = async (query = '', limit = 60) => {
  if (!supabasePublic) return [];
  const legacySuggestions = async () => (await fetchLiveJobRoles(200))
    .filter(item => roleKey(item.role).includes(roleKey(query)))
    .slice(0, Math.max(1, Math.min(Number(limit) || 60, 200)));
  try {
    const { data, error } = await supabasePublic.rpc('student_role_suggestions', {
      search_text: normalizeRoleLabel(query),
      limit_count: Math.max(1, Math.min(Number(limit) || 60, 200)),
    });
    // Preserve existing job suggestions while the additive migration is rolling out.
    if (error || !Array.isArray(data)) return legacySuggestions();
    return data.map(row => ({ role: normalizeRoleLabel(row?.role) })).filter(item => item.role);
  } catch {
    return legacySuggestions();
  }
};

/**
 * Live roles from currently published jobs (popularity-sorted).
 * Soft-fails to [] so registration/forms stay usable offline.
 */
export const fetchLiveJobRoles = async (limit = 60) => {
  if (!supabasePublic) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 60, 200));

  try {
    const { data, error } = await supabasePublic.rpc('distinct_job_roles', {
      limit_count: safeLimit,
    });

    if (error || !Array.isArray(data)) {
      return [];
    }

    return data
      .map((row) => ({
        role: String(row?.role || '').trim(),
        usageCount: Number(row?.usage_count) || 0,
      }))
      .filter((item) => item.role);
  } catch {
    return [];
  }
};
