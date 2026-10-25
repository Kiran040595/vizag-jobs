import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';

const mapReplyNotification = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    refId: row.ref_id,
    title: row.title || 'You have a reply',
    preview: row.preview || '',
    linkPath: row.link_path,
    isRead: Boolean(row.is_read),
    isDismissed: Boolean(row.is_dismissed),
    createdAt: row.created_at,
  };
};

export const fetchReplyNotifications = async (userId) => {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('reply_notifications')
    .select('id, kind, ref_id, title, preview, link_path, is_read, is_dismissed, created_at')
    .eq('user_id', userId)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(error.message);
  }

  // Filter out any broadcast Q&A spam so students only see notifications directed to them
  const rows = (data || []).filter((row) => {
    if (row.kind === 'job_question') {
      const title = String(row.title || '');
      if (title.startsWith('New Q&A:') || title.startsWith('New Q&A answered for')) {
        return false;
      }
    }
    return true;
  });

  return rows.map(mapReplyNotification);
};

export const fetchUnreadReplyNotificationCount = async (userId) => {
  const notifications = await fetchReplyNotifications(userId);
  return notifications.filter((item) => !item.isRead).length;
};

export const markReplyNotificationRead = async ({ notificationId, userId }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase
    .from('reply_notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
};

export const dismissReplyNotification = async ({ notificationId, userId }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase
    .from('reply_notifications')
    .update({ is_dismissed: true, is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
};

export const dismissAllReplyNotifications = async (userId) => {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return;
  }

  const { error } = await supabase
    .from('reply_notifications')
    .update({ is_dismissed: true, is_read: true })
    .eq('user_id', userId)
    .eq('is_dismissed', false);

  if (error) {
    throw new Error(error.message);
  }
};

export const formatReplyNotificationTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const replyNotificationKindLabel = (kind) => {
  switch (String(kind || '').trim()) {
    case 'application_status':
      return 'Application status';
    case 'new_application':
      return 'New application';
    case 'new_job':
      return 'New job';
    case 'new_employer':
      return 'New employer';
    case 'new_employer_job':
      return 'New employer job';
    case 'job_question':
      return 'Job question reply';
    case 'site_feedback':
      return 'Feedback reply';
    default:
      return 'Notification';
  }
};

export const notifyAdminsNewEmployer = async ({
  userId,
  companyName,
  contactName,
  email,
  phone,
  industry,
  location,
}) => {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return;
  }

  try {
    const preview = [contactName, industry, location, email, phone].filter(Boolean).join(' · ');
    await supabase.rpc('notify_admins', {
      notif_kind: 'new_employer',
      notif_ref_id: userId,
      notif_title: `New employer registered: ${String(companyName || 'New employer').trim()}`,
      notif_preview: preview || 'A new employer has registered on Vizag Jobs.',
      notif_link: '/admin/employers',
    });
  } catch (err) {
    console.debug('[ReplyNotifications] notify_admins RPC fallback notice:', err?.message);
  }
};

export const notifyAdminsNewEmployerJob = async (job) => {
  if (!isSupabaseConfigured || !supabase || !job?.id) {
    return;
  }

  try {
    const preview = [job.company || 'Employer', job.location || 'Visakhapatnam', 'Pending review'].filter(Boolean).join(' · ');
    await supabase.rpc('notify_admins', {
      notif_kind: 'new_employer_job',
      notif_ref_id: job.id,
      notif_title: `New employer job: ${String(job.title || 'Untitled opening').trim()}`,
      notif_preview: preview,
      notif_link: '/admin/jobs',
    });
  } catch (err) {
    console.debug('[ReplyNotifications] notify_admins RPC fallback notice:', err?.message);
  }
};

