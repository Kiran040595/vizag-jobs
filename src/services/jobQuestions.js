import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { getJobDetailPath } from '../lib/jobRoutes';
import { notifyReplyByEmailSafe } from '../lib/replyNotification';

const QUESTION_COLUMNS = `
  id,
  job_id,
  asker_name,
  asker_email,
  asker_user_id,
  body,
  status,
  answer_body,
  answered_by,
  answered_at,
  published_at,
  published_by,
  created_at
`;

export const CURATED_COMMUNITY_FAQS = [
  {
    id: 'curated-1',
    askerName: 'Sai Tarun (Madhurawada)',
    category: 'fresher',
    body: 'Are 2025 and 2026 batch freshers eligible for walk-ins in Rushikonda IT SEZ companies?',
    answerBody: 'Yes! Several companies in Rushikonda IT SEZ and Hill No. 2 (such as Fluentgrid, Wipro, and local software firms) frequently conduct walk-ins accepting final-year and recent graduates (B.Tech, MCA, B.Sc, BCA). Look for listings tagged with the "Fresher" badge on our portal.',
    answeredByRole: 'VizagJobs Editorial Team',
    publishedAt: '2026-09-20T10:00:00Z',
    helpfulCount: 28,
  },
  {
    id: 'curated-2',
    askerName: 'Priya R. (Gajuwaka)',
    category: 'scam_prevention',
    body: 'Do any companies or recruiters on JobsInVizag ask for registration or training fees?',
    answerBody: 'Strictly NO. Genuine employers and companies never charge money for application forms, interviews, or mandatory training. If any recruiter contacts you demanding money, report them immediately to our team — we maintain a zero-tolerance policy against paid consultancies.',
    answeredByRole: 'VizagJobs Trust & Safety',
    publishedAt: '2026-09-18T14:30:00Z',
    helpfulCount: 45,
  },
  {
    id: 'curated-3',
    askerName: 'Karthik V. (Pendurthi)',
    category: 'salary',
    body: 'Is the salary shown on job cards in-hand salary or CTC?',
    answerBody: 'Most corporate and IT listings specify annual CTC (Cost to Company) unless explicitly stated as "In-hand" or "Per Month" (e.g. ₹15,000 - ₹20,000/mo). For exact breakup including PF and ESI, you can clarify during the HR screening round.',
    answeredByRole: 'Verified HR Partner',
    publishedAt: '2026-09-15T09:15:00Z',
    helpfulCount: 19,
  },
  {
    id: 'curated-4',
    askerName: 'M. Divya (MVP Colony)',
    category: 'application',
    body: 'How long does it typically take for employers in Vizag to review student applications submitted on this site?',
    answerBody: 'For direct employer listings on JobsInVizag, recruiters usually review applications within 2 to 4 working days. You can track your real-time application status directly in your Student Dashboard under "Applied Jobs".',
    answeredByRole: 'VizagJobs Support',
    publishedAt: '2026-09-12T16:00:00Z',
    helpfulCount: 33,
  },
  {
    id: 'curated-5',
    askerName: 'Anil Kumar (Dwaraka Nagar)',
    category: 'it',
    body: 'Are there remote (Work From Home) IT developer opportunities based out of Visakhapatnam?',
    answerBody: 'Yes, select IT firms in Vizag offer hybrid or fully remote options, particularly for React, Node, Python, and UI/UX developers. Use the "Work Mode" filter on our jobs page to isolate Hybrid and Remote openings.',
    answeredByRole: 'VizagJobs Editorial Team',
    publishedAt: '2026-09-10T11:20:00Z',
    helpfulCount: 22,
  },
];

export const QA_CATEGORIES = [
  { id: 'all', label: 'All Doubts' },
  { id: 'fresher', label: 'Freshers & Walk-ins' },
  { id: 'it', label: 'IT & Software' },
  { id: 'salary', label: 'Salary & Eligibility' },
  { id: 'scam_prevention', label: 'Verification & Safety' },
  { id: 'application', label: 'Application Help' },
];

const mapQuestion = (row) => {
  if (!row) return null;

  const isAiAnswer = !row.answered_by && Boolean(row.answer_body);

  return {
    id: row.id,
    jobId: row.job_id || null,
    askerName: row.asker_name || '',
    askerEmail: row.asker_email || '',
    askerUserId: row.asker_user_id || null,
    body: row.body,
    status: row.status,
    category: row.category || 'general',
    helpfulCount: Number(row.helpful_count || 0),
    answerBody: row.answer_body || '',
    answeredBy: row.answered_by,
    answeredAt: row.answered_at,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    createdAt: row.created_at,
    isAiAnswer,
    answeredByRole: row.answered_by
      ? 'VizagJobs Admin'
      : (row.answer_body ? '🤖 AI Assistant (Verified from Job Post)' : null),
    job: row.job
      ? {
          id: row.job.id,
          slug: row.job.slug,
          title: row.job.title,
          company: row.job.company,
        }
      : null,
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

export function getAnswerJobQuestionUrl() {
  const functionsOverride = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.trim();
  if (functionsOverride) {
    const base = functionsOverride.replace(/\/$/, '');
    if (base.endsWith('/answer-job-question')) {
      return base;
    }
    if (base.includes('/functions/v1')) {
      return `${base}/answer-job-question`;
    }
  }

  const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim()?.replace(/\/$/, '');
  if (!projectUrl) {
    return '';
  }
  return `${projectUrl}/functions/v1/answer-job-question`;
}

export const requestJobAiAnswer = async ({
  jobId = null,
  job = null,
  body,
  askerName = '',
  askerEmail = '',
  askerUserId = null,
}) => {
  const validationError = validateQuestionInput({ askerName, askerEmail, body });
  if (validationError) {
    throw new Error(validationError);
  }

  const url = getAnswerJobQuestionUrl();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

  let resolvedUserId = askerUserId || null;
  if (!resolvedUserId && supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      resolvedUserId = sessionData?.session?.user?.id || null;
    } catch {
      // ignore
    }
  }

  if (url && anon) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anon}`,
          apikey: anon,
        },
        body: JSON.stringify({
          jobId,
          job,
          question: body.trim(),
          askerName: (askerName || '').trim() || null,
          askerEmail: (askerEmail || '').trim() || null,
          askerUserId: resolvedUserId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.answer) {
        return {
          answer: data.answer,
          question: data.question ? mapQuestion(data.question) : null,
          model: data.model || 'gemini-2.5-flash',
          source: 'gemini-ai',
          isAiAnswer: true,
        };
      }
    } catch (err) {
      console.warn('Edge function answer-job-question call failed, falling back:', err);
    }
  }

  // Graceful fallback: submit pending question to db
  await submitJobQuestion({
    jobId,
    askerName,
    askerEmail,
    body,
    askerUserId: resolvedUserId,
  });

  return {
    answer: null,
    question: null,
    isAiAnswer: false,
    submittedPending: true,
  };
};

export const submitJobQuestion = async ({
  jobId = null,
  askerName,
  askerEmail,
  body,
  askerUserId = null,
}) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const validationError = validateQuestionInput({ askerName, askerEmail, body });
  if (validationError) {
    throw new Error(validationError);
  }

  let resolvedUserId = askerUserId || null;
  if (!resolvedUserId) {
    const { data: sessionData } = await supabase.auth.getSession();
    resolvedUserId = sessionData?.session?.user?.id || null;
  }

  const { error } = await supabase
    .from('job_questions')
    .insert({
      job_id: jobId || null,
      asker_name: (askerName || '').trim() || null,
      asker_email: (askerEmail || '').trim() || null,
      asker_user_id: resolvedUserId,
      body: body.trim(),
      status: 'pending',
    });

  if (error) {
    throw new Error(error.message);
  }

  return { submitted: true };
};

const VOTED_QUESTIONS_STORAGE_KEY = 'vizagjobs_voted_questions';

export const getVotedQuestions = () => {
  try {
    const raw = localStorage.getItem(VOTED_QUESTIONS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

export const hasUserVotedHelpful = (questionId) => {
  return getVotedQuestions().has(questionId);
};

export const voteQuestionHelpful = async (questionId) => {
  if (!questionId) return;
  const voted = getVotedQuestions();
  if (voted.has(questionId)) {
    return;
  }

  try {
    voted.add(questionId);
    localStorage.setItem(VOTED_QUESTIONS_STORAGE_KEY, JSON.stringify(Array.from(voted)));
  } catch {
    // ignore
  }

  if (isSupabaseConfigured && supabase && !String(questionId).startsWith('curated-')) {
    try {
      await supabase.rpc('increment_question_helpful', { question_uuid: questionId });
    } catch {
      // silent fallback
    }
  }
};

export const fetchRecentCommunityQuestions = async ({ limit = 6, category = null } = {}) => {
  let dbQuestions = [];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('job_questions')
        .select(`
          ${QUESTION_COLUMNS},
          job:jobs (
            id,
            slug,
            title,
            company
          )
        `)
        .eq('status', 'published')
        .not('answer_body', 'is', null)
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit * 2);

      if (!error && Array.isArray(data)) {
        dbQuestions = data.map(mapQuestion);
      }
    } catch {
      // ignore
    }
  }

  let filteredDb = dbQuestions;
  if (category && category !== 'all') {
    filteredDb = dbQuestions.filter((q) => q.category === category);
  }

  const curatedFiltered = (category && category !== 'all')
    ? CURATED_COMMUNITY_FAQS.filter((f) => f.category === category)
    : CURATED_COMMUNITY_FAQS;

  const combined = [...filteredDb];
  for (const item of curatedFiltered) {
    if (!combined.some((q) => q.id === item.id || q.body === item.body)) {
      combined.push(item);
    }
    if (combined.length >= limit) break;
  }

  return combined.slice(0, limit);
};

export const fetchAllCommunityQuestions = async ({
  search = '',
  category = 'all',
  limit = 30,
} = {}) => {
  let dbQuestions = [];

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('job_questions')
        .select(`
          ${QUESTION_COLUMNS},
          job:jobs (
            id,
            slug,
            title,
            company
          )
        `)
        .eq('status', 'published')
        .not('answer_body', 'is', null)
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      const cleanSearch = (search || '').trim();
      if (cleanSearch) {
        query = query.or(`body.ilike.%${cleanSearch}%,answer_body.ilike.%${cleanSearch}%`);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        dbQuestions = data.map(mapQuestion);
      }
    } catch {
      // ignore
    }
  }

  let filteredDb = dbQuestions;
  if (category && category !== 'all') {
    filteredDb = dbQuestions.filter((q) => q.category === category);
  }

  const cleanSearch = (search || '').trim().toLowerCase();
  const matchedCurated = CURATED_COMMUNITY_FAQS.filter((item) => {
    const matchCategory = category === 'all' || item.category === category;
    const matchSearch =
      !cleanSearch ||
      item.body.toLowerCase().includes(cleanSearch) ||
      item.answerBody.toLowerCase().includes(cleanSearch);
    return matchCategory && matchSearch;
  });

  const allItems = [...filteredDb];
  for (const item of matchedCurated) {
    if (!allItems.some((q) => q.id === item.id || q.body === item.body)) {
      allItems.push(item);
    }
  }

  return allItems;
};

export const fetchAdminAllJobQuestions = async ({
  status = 'pending',
  search = '',
  limit = 50,
} = {}) => {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  let query = supabase
    .from('job_questions')
    .select(`
      ${QUESTION_COLUMNS},
      job:jobs (
        id,
        slug,
        title,
        company
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const cleanSearch = (search || '').trim();
  if (cleanSearch) {
    query = query.or(`body.ilike.%${cleanSearch}%,asker_name.ilike.%${cleanSearch}%,asker_email.ilike.%${cleanSearch}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapQuestion);
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

const maybeNotifyQuestionReply = async ({
  questionId,
  askerEmail,
  answerBody,
  previousAnswer,
  status,
}) => {
  const shouldNotify =
    status === 'published' &&
    Boolean((askerEmail || '').trim()) &&
    Boolean((answerBody || '').trim()) &&
    (answerBody || '').trim() !== (previousAnswer || '').trim();

  if (!shouldNotify) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  await notifyReplyByEmailSafe(accessToken, { kind: 'job_question', id: questionId });
};

export const saveJobQuestionAnswer = async ({ questionId, answerBody, userId }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const trimmedAnswer = (answerBody || '').trim();
  if (!trimmedAnswer) {
    throw new Error('Please enter an answer.');
  }

  const { data: existing, error: existingError } = await supabase
    .from('job_questions')
    .select('answer_body, asker_email, status')
    .eq('id', questionId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
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

  const mapped = mapQuestion(data);
  await maybeNotifyQuestionReply({
    questionId,
    askerEmail: mapped.askerEmail || existing?.asker_email,
    answerBody: mapped.answerBody,
    previousAnswer: existing?.answer_body,
    status: mapped.status,
  });

  return mapped;
};

export const publishJobQuestion = async ({ questionId, userId, answerBody }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data: existing, error: existingError } = await supabase
    .from('job_questions')
    .select('answer_body, asker_email, status')
    .eq('id', questionId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
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

  const mapped = mapQuestion(data);
  // First publish with an answer should notify even if the answer was saved while pending.
  const previousAnswerForNotify =
    existing?.status === 'published' ? existing?.answer_body || '' : '';
  await maybeNotifyQuestionReply({
    questionId,
    askerEmail: mapped.askerEmail || existing?.asker_email,
    answerBody: mapped.answerBody,
    previousAnswer: previousAnswerForNotify,
    status: mapped.status,
  });

  return mapped;
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
