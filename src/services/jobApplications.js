import { enrichQuickCandidate } from '../lib/quickApply';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { getJobDetailPath } from '../lib/jobRoutes';
import {
  APPLICATION_STATUSES,
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
  recruiter_notes,
  interview_scheduled_at,
  interview_mode,
  interview_location,
  interview_instructions,
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

  const application = {
    id: row.id,
    jobId: row.job_id,
    studentUserId: row.student_user_id,
    status: normalizeApplicationStatus(row.status),
    coverNote: row.cover_note || '',
    resumePath: row.resume_path || '',
    resumeShareToken: row.resume_share_token || '',
    profileSnapshot: row.profile_snapshot || {},
    recruiterNotes: row.recruiter_notes || '',
    interviewScheduledAt: row.interview_scheduled_at || null,
    interviewMode: row.interview_mode || 'in_person',
    interviewLocation: row.interview_location || '',
    interviewInstructions: row.interview_instructions || '',
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    job,
    jobPath: job ? getJobDetailPath(job) : null,
  };
  return enrichQuickCandidate(application, row.profile_snapshot);
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

export const fetchJobCandidates = async (jobId) => {
  if (!isSupabaseConfigured || !supabase || !jobId) {
    return [];
  }

  try {
    const { data, error } = await supabase.rpc('get_job_applicant_records', {
      p_job_id: jobId,
    });

    if (!error && Array.isArray(data)) {
      const { data: quickDetails } = await supabase.from('job_applications')
        .select('id,profile_snapshot').eq('job_id', jobId).not('quick_form_id', 'is', null);
      const quickSnapshots = new Map((quickDetails || []).map(row => [row.id, row.profile_snapshot]));
      return data.map((row) => ({
        id: row.id,
        jobId: row.job_id,
        studentUserId: row.user_id,
        status: normalizeApplicationStatus(row.status),
        source: row.source,
        coverNote: row.cover_note || '',
        resumePath: row.resume_path || '',
        resumeShareToken: row.resume_share_token || '',
        profileSnapshot: {
          fullName: row.full_name || '',
          phone: row.phone || '',
          contactEmail: row.email || '',
          college: row.college || '',
          degree: row.degree || '',
          branch: row.branch || '',
          graduationYear: row.graduation_year ?? null,
          skills: Array.isArray(row.skills) ? row.skills : [],
          isFresher: row.is_fresher !== false,
        },
        recruiterNotes: row.recruiter_notes || '',
        interviewScheduledAt: row.interview_scheduled_at || null,
        interviewMode: row.interview_mode || 'in_person',
        interviewLocation: row.interview_location || '',
        interviewInstructions: row.interview_instructions || '',
        submittedAt: row.created_at,
      })).map(candidate => enrichQuickCandidate(candidate, quickSnapshots.get(candidate.id)));
    }
  } catch (rpcError) {
    console.warn('get_job_applicant_records RPC failed, falling back to fetchJobApplications:', rpcError);
  }

  return fetchJobApplications(jobId);
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
    .in('job_id', jobIds)
    .neq('status', 'withdrawn');

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

export const updateCandidatePipelineStage = async ({
  applicationId,
  jobId,
  studentUserId,
  status,
  recruiterNotes = null,
  interviewScheduledAt = null,
  interviewMode = null,
  interviewLocation = null,
  interviewInstructions = null,
  clearInterview = false,
}) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const normalizedStatus = status ? normalizeApplicationStatus(status) : null;
  if (normalizedStatus && !APPLICATION_STATUSES_SET.has(normalizedStatus)) {
    throw new Error('Invalid application status.');
  }

  if (jobId) {
    try {
      const { data, error } = await supabase.rpc('update_job_applicant_stage', {
        p_job_id: jobId,
        p_candidate_id: applicationId || null,
        p_student_user_id: studentUserId || null,
        p_status: normalizedStatus || null,
        p_recruiter_notes: recruiterNotes,
        p_interview_scheduled_at: interviewScheduledAt ? new Date(interviewScheduledAt).toISOString() : null,
        p_interview_mode: interviewMode || null,
        p_interview_location: interviewLocation || null,
        p_interview_instructions: interviewInstructions || null,
        p_clear_interview: Boolean(clearInterview),
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        return mapApplication(data[0]);
      }
      if (error) {
        console.warn('update_job_applicant_stage RPC returned error, attempting fallback:', error);
      }
    } catch (rpcErr) {
      console.warn('update_job_applicant_stage exception, falling back:', rpcErr);
    }
  }

  const updates = {};
  if (normalizedStatus) updates.status = normalizedStatus;
  if (recruiterNotes !== null) updates.recruiter_notes = recruiterNotes;
  if (clearInterview) {
    updates.interview_scheduled_at = null;
    updates.interview_location = null;
    updates.interview_instructions = null;
  } else if (interviewScheduledAt !== null) {
    updates.interview_scheduled_at = new Date(interviewScheduledAt).toISOString();
    if (interviewMode) updates.interview_mode = interviewMode;
    if (interviewLocation !== null) updates.interview_location = interviewLocation;
    if (interviewInstructions !== null) updates.interview_instructions = interviewInstructions;
  }

  if (applicationId && Object.keys(updates).length > 0) {
    const { data, error } = await supabase
      .from('job_applications')
      .update(updates)
      .eq('id', applicationId)
      .select(APPLICATION_COLUMNS)
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return mapApplication(data);
  }

  throw new Error('Could not update application stage.');
};

export const updateApplicationStatus = async ({
  applicationId,
  status,
  jobId,
  studentUserId,
}) => {
  return updateCandidatePipelineStage({
    applicationId,
    status,
    jobId,
    studentUserId,
  });
};

export const updateApplicationRecruiterNotes = async ({
  applicationId,
  recruiterNotes,
  jobId,
  studentUserId,
}) => {
  const trimmed = typeof recruiterNotes === 'string' ? recruiterNotes.trim() : '';
  return updateCandidatePipelineStage({
    applicationId,
    recruiterNotes: trimmed || null,
    jobId,
    studentUserId,
  });
};

export const scheduleApplicationInterview = async ({
  applicationId,
  interviewScheduledAt,
  interviewMode = 'in_person',
  interviewLocation = '',
  interviewInstructions = '',
  status = 'interview_scheduled',
  jobId,
  studentUserId,
}) => {
  return updateCandidatePipelineStage({
    applicationId,
    interviewScheduledAt,
    interviewMode,
    interviewLocation: interviewLocation ? interviewLocation.trim() : null,
    interviewInstructions: interviewInstructions ? interviewInstructions.trim() : null,
    status,
    jobId,
    studentUserId,
  });
};

export const cancelApplicationInterview = async ({
  applicationId,
  jobId,
  studentUserId,
}) => {
  return updateCandidatePipelineStage({
    applicationId,
    clearInterview: true,
    jobId,
    studentUserId,
  });
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
