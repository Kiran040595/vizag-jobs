import { supabasePublic } from '../lib/supabaseClient';

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
