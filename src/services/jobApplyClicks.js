import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { buildApplyClickVisitorKey } from '../lib/applyVisitorKey.js';

export const recordExternalApplyClick = async (jobId) => {
  if (!isSupabaseConfigured || !supabase || !jobId) {
    return { ok: false, recorded: false };
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const visitorKey = buildApplyClickVisitorKey(session?.user?.id);
    const { data, error } = await supabase.rpc('record_job_apply_click', {
      p_job_id: jobId,
      p_visitor_key: visitorKey,
    });
    if (error) {
      console.warn('Could not record apply click:', error.message);
      return { ok: false, recorded: false };
    }
    return data && typeof data === 'object'
      ? { ok: Boolean(data.ok), recorded: Boolean(data.recorded), applyClickCount: data.apply_click_count }
      : { ok: true, recorded: false };
  } catch (error) {
    console.warn('Could not record apply click:', error);
    return { ok: false, recorded: false };
  }
};

/** Fire-and-forget unique click, then open the apply URL so redirect is never blocked. */
export const recordAndOpenExternalApply = (url, jobId) => {
  if (jobId) {
    void recordExternalApplyClick(jobId);
  }
  if (url && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

export const fetchJobApplyClicks = async (jobId) => {
  if (!isSupabaseConfigured || !supabase || !jobId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('job_apply_clicks')
      .select('id, job_id, visitor_key, user_id, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not fetch job apply clicks:', error.message);
      return [];
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('Could not fetch job apply clicks:', error);
    return [];
  }
};

