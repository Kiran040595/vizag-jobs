import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { getJobDetailPath } from '../lib/jobRoutes';

const QUESTION_COLUMNS = `
  id,
  job_id,
  asker_name,
  asker_email,
  body,
  status,
  answer_body,
  answered_by,
  answered_at,
  published_at,
  published_by,
  created_at
`;

const mapQuestion = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    jobId: row.job_id,
    askerName: row.asker_name || '',
    askerEmail: row.asker_email || '',
    body: row.body,
    status: row.status,
    answerBody: row.answer_body || '',
    answeredBy: row.answered_by,
    answeredAt: row.answered_at,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    createdAt: row.created_at,
  };
};

const mapNotification = (row) => {
  if (!row) return null;

  const question = row.question ? mapQuestion(row.question) : null;
  const job = row.question?.job
    ? {
        id: row.question.job.id,
        slug: row.question.job.slug,
        title: row.question.job.title,
        company: row.question.job.company,
      }
    : null;

  return {
    id: row.id,
    questionId: row.question_id,
    isRead: row.is_read,
    isDismissed: row.is_dismissed,
    createdAt: row.created_at,
    question,
    job,
    jobPath: job ? getJobDetailPath(job) : null,
  };
};

export const validateQuestionInput = ({ askerName, askerEmail, body }) => {
  const name = (askerName || '').trim();
  const email = (askerEmail || '').trim();
  const questionBody = (body || '').trim();

  if (!name && !email) {
    return 'Please enter your name or email.';
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address.';
  }

  if (questionBody.length < 3) {
    return 'Please enter a question with at least 3 characters.';
  }

  return '';
};

export const submitJobQuestion = async ({ jobId, askerName, askerEmail, body }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const validationError = validateQuestionInput({ askerName, askerEmail, body });
  if (validationError) {
    throw new Error(validationError);
  }

  const { error } = await supabase
    .from('job_questions')
    .insert({
      job_id: jobId,
      asker_name: (askerName || '').trim() || null,
      asker_email: (askerEmail || '').trim() || null,
      body: body.trim(),
      status: 'pending',
    });

  if (error) {
    throw new Error(error.message);
  }

  return { submitted: true };
};

export const fetchPublishedJobQuestions = async (jobId) => {
  if (!isSupabaseConfigured || !supabase || !jobId) {
    return [];
  }

  const { data, error } = await supabase
    .from('job_questions')
    .select(QUESTION_COLUMNS)
    .eq('job_id', jobId)
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapQuestion);
};

export const fetchModeratorJobQuestions = async (jobId) => {
  if (!isSupabaseConfigured || !supabase || !jobId) {
    return [];
  }

  const { data, error } = await supabase
    .from('job_questions')
    .select(QUESTION_COLUMNS)
    .eq('job_id', jobId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapQuestion);
};

export const saveJobQuestionAnswer = async ({ questionId, answerBody, userId }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const trimmedAnswer = (answerBody || '').trim();
  if (!trimmedAnswer) {
    throw new Error('Please enter an answer.');
  }

  const { data, error } = await supabase
    .from('job_questions')
    .update({
      answer_body: trimmedAnswer,
      answered_by: userId,
      answered_at: new Date().toISOString(),
    })
    .eq('id', questionId)
    .select(QUESTION_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapQuestion(data);
};

export const publishJobQuestion = async ({ questionId, userId, answerBody }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const patch = {
    status: 'published',
    published_at: new Date().toISOString(),
    published_by: userId,
  };

  const trimmedAnswer = (answerBody || '').trim();
  if (trimmedAnswer) {
    patch.answer_body = trimmedAnswer;
    patch.answered_by = userId;
    patch.answered_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('job_questions')
    .update(patch)
    .eq('id', questionId)
    .select(QUESTION_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapQuestion(data);
};

export const deleteJobQuestion = async (questionId) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('job_questions')
    .update({ status: 'deleted' })
    .eq('id', questionId)
    .select(QUESTION_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapQuestion(data);
};

export const ignoreJobQuestion = async ({ questionId, userId }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error: questionError } = await supabase
    .from('job_questions')
    .update({ status: 'ignored' })
    .eq('id', questionId);

  if (questionError) {
    throw new Error(questionError.message);
  }

  const { error: notificationError } = await supabase
    .from('job_question_notifications')
    .update({ is_dismissed: true, is_read: true })
    .eq('question_id', questionId)
    .eq('user_id', userId);

  if (notificationError) {
    throw new Error(notificationError.message);
  }
};

export const fetchQuestionNotifications = async (userId) => {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('job_question_notifications')
    .select(`
      id,
      question_id,
      is_read,
      is_dismissed,
      created_at,
      question:job_questions (
        id,
        job_id,
        asker_name,
        asker_email,
        body,
        status,
        answer_body,
        answered_by,
        answered_at,
        published_at,
        published_by,
        created_at,
        job:jobs (
          id,
          slug,
          title,
          company,
          category,
          job_type,
          work_mode,
          description,
          is_fresher
        )
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
    .map(mapNotification)
    .filter((item) => item.question?.status === 'pending');
};

export const fetchUnreadQuestionNotificationCount = async (userId) => {
  const notifications = await fetchQuestionNotifications(userId);
  return notifications.filter((item) => !item.isRead).length;
};

export const markQuestionNotificationRead = async ({ notificationId, userId }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase
    .from('job_question_notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
};

export const dismissQuestionNotification = async ({ notificationId, userId }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase
    .from('job_question_notifications')
    .update({ is_dismissed: true, is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
};

export const formatQuestionAsker = (question) => {
  if (question.askerName) return question.askerName;
  if (question.askerEmail) return question.askerEmail;
  return 'Anonymous';
};

export const formatQuestionTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};
