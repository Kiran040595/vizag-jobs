import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

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

  return (data || []).map(mapReplyNotification);
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
