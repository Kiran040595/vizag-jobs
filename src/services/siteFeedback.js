import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { notifyReplyByEmailSafe } from '../lib/replyNotification';

const FEEDBACK_COLUMNS = `
  id,
  feedback_type,
  author_name,
  author_email,
  author_user_id,
  body,
  page_url,
  wants_public,
  status,
  admin_reply,
  published_at,
  published_by,
  created_at,
  updated_at
`;

const FEEDBACK_TYPES = new Set(['feature_request', 'problem', 'general']);

const mapFeedback = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    feedbackType: row.feedback_type,
    authorName: row.author_name || '',
    authorEmail: row.author_email || '',
    authorUserId: row.author_user_id || null,
    body: row.body,
    pageUrl: row.page_url || '',
    wantsPublic: Boolean(row.wants_public),
    status: row.status,
    adminReply: row.admin_reply || '',
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const FEEDBACK_TYPE_OPTIONS = [
  { value: 'feature_request', label: 'Feature request' },
  { value: 'problem', label: 'Problem on site' },
  { value: 'general', label: 'General feedback' },
];

export const FEEDBACK_TYPE_LABELS = Object.fromEntries(
  FEEDBACK_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

export const validateSiteFeedbackInput = ({
  feedbackType,
  authorName,
  authorEmail,
  body,
  honeypot = '',
}) => {
  if (honeypot) {
    return 'Submission blocked.';
  }

  const name = (authorName || '').trim();
  const email = (authorEmail || '').trim();
  const message = (body || '').trim();
  const type = (feedbackType || '').trim();

  if (!FEEDBACK_TYPES.has(type)) {
    return 'Please choose a feedback type.';
  }

  if (!name && !email) {
    return 'Please enter your name or email.';
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address.';
  }

  if (message.length < 10) {
    return 'Please enter at least 10 characters.';
  }

  return '';
};

export const submitSiteFeedback = async ({
  feedbackType,
  authorName,
  authorEmail,
  body,
  pageUrl,
  honeypot = '',
  authorUserId = null,
}) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const validationError = validateSiteFeedbackInput({
    feedbackType,
    authorName,
    authorEmail,
    body,
    honeypot,
  });
  if (validationError) {
    throw new Error(validationError);
  }

  let resolvedUserId = authorUserId || null;
  if (!resolvedUserId) {
    const { data: sessionData } = await supabase.auth.getSession();
    resolvedUserId = sessionData?.session?.user?.id || null;
  }

  const { error } = await supabase.from('site_feedback').insert({
    feedback_type: feedbackType,
    author_name: (authorName || '').trim() || null,
    author_email: (authorEmail || '').trim() || null,
    author_user_id: resolvedUserId,
    body: body.trim(),
    page_url: (pageUrl || '').trim() || null,
    wants_public: false,
    status: 'pending',
  });

  if (error) {
    throw new Error(error.message);
  }

  return { submitted: true };
};

export const fetchPublishedSiteFeedback = async (limit = 50) => {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('site_feedback')
    .select(FEEDBACK_COLUMNS)
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapFeedback);
};

export const fetchAdminSiteFeedback = async (status = 'pending') => {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  let query = supabase
    .from('site_feedback')
    .select(FEEDBACK_COLUMNS)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .limit(100);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapFeedback);
};

export const publishSiteFeedback = async ({ feedbackId, userId, adminReply }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data: existing, error: existingError } = await supabase
    .from('site_feedback')
    .select('admin_reply, author_email')
    .eq('id', feedbackId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const previousReply = (existing?.admin_reply || '').trim();
  const patch = {
    status: 'published',
    published_at: new Date().toISOString(),
    published_by: userId,
  };

  const trimmedReply = (adminReply || '').trim();
  if (trimmedReply) {
    patch.admin_reply = trimmedReply;
  }

  const { data, error } = await supabase
    .from('site_feedback')
    .update(patch)
    .eq('id', feedbackId)
    .select(FEEDBACK_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const mapped = mapFeedback(data);
  const shouldNotify =
    Boolean(mapped.authorEmail) &&
    Boolean(mapped.adminReply) &&
    mapped.adminReply !== previousReply;

  if (shouldNotify) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    await notifyReplyByEmailSafe(accessToken, { kind: 'feedback', id: feedbackId });
  }

  return mapped;
};

export const ignoreSiteFeedback = async ({ feedbackId, userId }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error: feedbackError } = await supabase
    .from('site_feedback')
    .update({ status: 'ignored' })
    .eq('id', feedbackId);

  if (feedbackError) {
    throw new Error(feedbackError.message);
  }

  if (userId) {
    await supabase
      .from('site_feedback_notifications')
      .update({ is_dismissed: true, is_read: true })
      .eq('feedback_id', feedbackId)
      .eq('user_id', userId);
  }
};

export const deleteSiteFeedback = async (feedbackId) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('site_feedback')
    .update({ status: 'deleted' })
    .eq('id', feedbackId)
    .select(FEEDBACK_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapFeedback(data);
};

export const formatFeedbackAuthor = (feedback) => {
  if (feedback.authorName) return feedback.authorName;
  if (feedback.authorEmail) return feedback.authorEmail;
  return 'Anonymous';
};

export const formatFeedbackTime = (value) => {
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

const mapFeedbackNotification = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    feedbackId: row.feedback_id,
    isRead: row.is_read,
    isDismissed: row.is_dismissed,
    createdAt: row.created_at,
    feedback: row.feedback ? mapFeedback(row.feedback) : null,
  };
};

export const fetchFeedbackNotifications = async (userId) => {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('site_feedback_notifications')
    .select(`
      id,
      feedback_id,
      is_read,
      is_dismissed,
      created_at,
      feedback:site_feedback (
        id,
        feedback_type,
        author_name,
        author_email,
        body,
        page_url,
        wants_public,
        status,
        admin_reply,
        published_at,
        published_by,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', userId)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(error.message);
  }

  return (data || [])
    .map(mapFeedbackNotification)
    .filter((item) => item.feedback?.status === 'pending');
};

export const fetchUnreadFeedbackNotificationCount = async (userId) => {
  const notifications = await fetchFeedbackNotifications(userId);
  return notifications.filter((item) => !item.isRead).length;
};

export const markFeedbackNotificationRead = async ({ notificationId, userId }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase
    .from('site_feedback_notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
};
