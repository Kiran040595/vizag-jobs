import { supabase } from '../lib/supabaseClient.js';

export const BUG_STATUS_OPTIONS = [
  { value: 'all', label: 'All Reports' },
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'ignored', label: 'Ignored / Noise' },
];

export const BUG_STATUS_COLORS = {
  open: {
    bg: 'bg-red-50 text-red-700 border-red-200',
    badge: 'bg-red-100 text-red-800',
    dot: 'bg-red-500',
  },
  investigating: {
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
  },
  resolved: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
    dot: 'bg-emerald-500',
  },
  ignored: {
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    badge: 'bg-slate-200 text-slate-700',
    dot: 'bg-slate-400',
  },
};

export async function fetchAdminBugs({ status = 'all', search = '', limit = 50, offset = 0 } = {}) {
  try {
    let query = supabase
      .from('site_error_logs')
      .select('id, error_message, stack_trace, component_stack, context, url, pathname, user_agent, screen_size, status, resolution_notes, resolved_at, resolved_in_commit, created_at, updated_at', { count: 'exact' });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`error_message.ilike.${term},pathname.ilike.${term},resolution_notes.ilike.${term},context.ilike.${term}`);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return { data: [], count: 0, error: null };
      }
      throw error;
    }

    return { data: data || [], count: count || 0, error: null };
  } catch (err) {
    return { data: [], count: 0, error: err.message || 'Failed to fetch bug reports' };
  }
}

export async function fetchAdminBugStats() {
  try {
    const { data, error } = await supabase
      .from('site_error_logs')
      .select('status');

    if (error) {
      return { total: 0, open: 0, investigating: 0, resolved: 0, ignored: 0 };
    }

    const stats = {
      total: data.length,
      open: 0,
      investigating: 0,
      resolved: 0,
      ignored: 0,
    };

    for (const item of data) {
      if (item.status === 'open') stats.open += 1;
      else if (item.status === 'investigating') stats.investigating += 1;
      else if (item.status === 'resolved') stats.resolved += 1;
      else if (item.status === 'ignored') stats.ignored += 1;
    }

    return stats;
  } catch {
    return { total: 0, open: 0, investigating: 0, resolved: 0, ignored: 0 };
  }
}

export async function updateAdminBug(id, { status, resolution_notes, resolved_in_commit } = {}) {
  const updates = {
    updated_at: new Date().toISOString(),
  };

  if (status) {
    updates.status = status;
    if (status === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }
  }

  if (resolution_notes !== undefined) {
    updates.resolution_notes = resolution_notes;
  }

  if (resolved_in_commit !== undefined) {
    updates.resolved_in_commit = resolved_in_commit;
  }

  const { data, error } = await supabase
    .from('site_error_logs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAdminBug(id) {
  const { error } = await supabase
    .from('site_error_logs')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

export function formatBugTimestamp(isoDate) {
  if (!isoDate) return 'Unknown';
  try {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return isoDate;
  }
}
