import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { buildApplyClickVisitorKey } from '../lib/applyVisitorKey';

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
