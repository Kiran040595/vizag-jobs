import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { getJobDetailPath } from '../lib/jobRoutes';
import {
  APPLICATION_STATUSES,
  formatApplicationStatus,
  normalizeApplicationStatus,
} from '../lib/applicationStatus';
import { createResumeSignedUrl, saveResumePathOnProfile, uploadStudentResume } from './studentResume';
import { fetchStudentProfile } from './studentJobs';

const APPLICATION_COLUMNS = `
  id,
  job_id,
  student_user_id,
  status,
  cover_note,
  resume_path,
  resume_share_token,
  profile_snapshot,
  submitted_at,
  updated_at
`;

const APPLICATION_STATUSES_SET = new Set(APPLICATION_STATUSES);

const mapApplication = (row) => {
  if (!row) {
    return null;
  }

  const job = row.job
    ? {
        id: row.job.id,
        slug: row.job.slug,
        title: row.job.title,
        company: row.job.company,
        status: row.job.status,
      }
    : null;

  return {
    id: row.id,
    jobId: row.job_id,
    studentUserId: row.student_user_id,
    status: normalizeApplicationStatus(row.status),
    coverNote: row.cover_note || '',
    resumePath: row.resume_path || '',
    resumeShareToken: row.resume_share_token || '',
    profileSnapshot: row.profile_snapshot || {},
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    job,
    jobPath: job ? getJobDetailPath(job) : null,
  };
};

const buildProfileSnapshot = (profile) => ({
  fullName: profile.full_name || '',
  college: profile.college || '',
  degree: profile.degree || '',
  branch: profile.branch || '',
  graduationYear: profile.graduation_year || null,
  phone: profile.phone || '',
  contactEmail: profile.contact_email || '',
  skills: Array.isArray(profile.skills) ? profile.skills : [],
  certifications: Array.isArray(profile.certifications) ? profile.certifications : [],
  isFresher: Boolean(profile.is_fresher),
  targetJobCategories: Array.isArray(profile.target_job_categories)
    ? profile.target_job_categories
    : [],
  primaryTargetRole: profile.primary_target_role || '',
  roleExperienceLevel: profile.role_experience_level || '',
  preferredLocations: Array.isArray(profile.preferred_locations)
    ? profile.preferred_locations
    : [],
  availability: profile.availability || '',
  expectedSalaryMin: profile.expected_salary_min || null,
  expectedSalaryMax: profile.expected_salary_max || null,
});

export const fetchMyApplicationForJob = async (jobId) => {
  if (!isSupabaseConfigured || !supabase || !jobId) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('job_applications')
    .select(APPLICATION_COLUMNS)
    .eq('job_id', jobId)
    .eq('student_user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return mapApplication(data);
};

export const fetchMyApplications = async () => {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('job_applications')
    .select(`
      ${APPLICATION_COLUMNS},
      job:jobs (
        id,
        slug,
        title,
        company,
        status
      )
    `)
    .eq('student_user_id', user.id)
    .order('submitted_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapApplication);
};

export const fetchJobApplications = async (jobId) => {
  if (!isSupabaseConfigured || !supabase || !jobId) {
    return [];
  }

  const { data, error } = await supabase
    .from('job_applications')
    .select(APPLICATION_COLUMNS)
    .eq('job_id', jobId)
    .order('submitted_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapApplication);
};

export const fetchJobApplicationCounts = async (jobIds = []) => {
  const stats = await fetchJobApplicationStats(jobIds);
  return stats.byJobId;
};

/** Aggregate application counts across jobs (per job + per status). */
export const fetchJobApplicationStats = async (jobIds = []) => {
  const empty = { total: 0, byJobId: {}, byStatus: {} };

  if (!isSupabaseConfigured || !supabase || jobIds.length === 0) {
    return empty;
  }

  const { data, error } = await supabase
    .from('job_applications')
    .select('job_id, status')
    .in('job_id', jobIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).reduce(
    (stats, row) => {
      const status = normalizeApplicationStatus(row.status);
      stats.total += 1;
      stats.byJobId[row.job_id] = (stats.byJobId[row.job_id] || 0) + 1;
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      return stats;
    },
    { total: 0, byJobId: {}, byStatus: {} },
  );
};

export const submitJobApplication = async ({ jobId, coverNote, resumeFile, existingResumePath }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in as a student.');
  }

  const profile = await fetchStudentProfile();
  if (!profile) {
    throw new Error('Complete your student profile before applying.');
  }

  let resumePath = '';
  if (resumeFile) {
    resumePath = await uploadStudentResume(resumeFile, user.id);
    await saveResumePathOnProfile(resumePath);
  } else if (existingResumePath) {
    resumePath = existingResumePath;
  }

  const trimmedCover = String(coverNote || '').trim();

  const { data, error } = await supabase
    .from('job_applications')
    .insert({
      job_id: jobId,
      student_user_id: user.id,
      cover_note: trimmedCover || null,
      resume_path: resumePath || null,
      profile_snapshot: buildProfileSnapshot(profile),
      status: 'applied',
    })
    .select(APPLICATION_COLUMNS)
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('You have already applied for this job.');
    }
    throw new Error(error.message);
  }

  return mapApplication(data);
};

export const updateApplicationStatus = async ({ applicationId, status }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const normalizedStatus = normalizeApplicationStatus(status);
  if (!APPLICATION_STATUSES_SET.has(normalizedStatus)) {
    throw new Error('Invalid application status.');
  }

  const { data, error } = await supabase
    .from('job_applications')
    .update({ status: normalizedStatus })
    .eq('id', applicationId)
    .select(APPLICATION_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapApplication(data);
};

export const getApplicationResumeUrl = async (application) =>
  createResumeSignedUrl(application?.resumePath);

export { formatApplicationStatus } from '../lib/applicationStatus';

export const formatApplicationTime = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};
