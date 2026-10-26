import { enrichQuickCandidate } from '../lib/quickApply';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { getJobDetailPath } from '../lib/jobRoutes';
import {
  APPLICATION_STATUSES,
  normalizeApplicationStatus,
} from '../lib/applicationStatus';
import { createResumeSignedUrl, saveResumePathOnProfile, uploadStudentResume } from './studentResume';
import { fetchStudentProfile } from './studentJobs';
import { mapHiringProgressRow } from '../lib/hiringProgress';
import { notifyApplicationStatusChange } from '../lib/applicationPushNotify';

const APPLICATION_COLUMNS = `
  id,
  job_id,
  student_user_id,
  status,
  cover_note,
  resume_path,
  resume_share_token,
  profile_snapshot,
  is_starred,
  starred_at,
  admin_notes,
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

  const isStarred = Boolean(
    row.is_starred ||
      row.profile_snapshot?.is_starred ||
      row.profile_snapshot?.isStarred
  );
  const adminNotes =
    row.admin_notes ||
    row.profile_snapshot?.admin_notes ||
    row.profile_snapshot?.adminNotes ||
    '';

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
    adminNotes,
    isStarred,
    starredAt: row.starred_at || null,
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

  let data;
  const res = await supabase
    .from('job_applications')
    .select(APPLICATION_COLUMNS)
    .eq('job_id', jobId)
    .order('submitted_at', { ascending: false });

  if (res.error) {
    const fallbackRes = await supabase
      .from('job_applications')
      .select(APPLICATION_COLUMNS)
      .eq('job_id', jobId)
      .order('submitted_at', { ascending: false });

    if (fallbackRes.error) {
      throw new Error(fallbackRes.error.message);
    }
    data = fallbackRes.data;
  } else {
    data = res.data;
  }

  const mapped = (data || []).map(mapApplication);

  // If any application has an incomplete snapshot, enrich from student_profiles
  const missingStudentUserIds = mapped
    .filter((app) => !app.profileSnapshot?.fullName && app.studentUserId)
    .map((app) => app.studentUserId);

  if (missingStudentUserIds.length > 0) {
    try {
      const { data: students } = await supabase
        .from('student_profiles')
        .select('user_id, full_name, phone, contact_email, college, degree, branch, graduation_year, is_fresher, skills')
        .in('user_id', missingStudentUserIds);

      if (students && students.length > 0) {
        const studentMap = new Map(students.map((s) => [s.user_id, s]));
        for (const app of mapped) {
          if (!app.profileSnapshot?.fullName && studentMap.has(app.studentUserId)) {
            const student = studentMap.get(app.studentUserId);
            app.profileSnapshot = {
              ...(app.profileSnapshot || {}),
              fullName: student.full_name || '',
              phone: student.phone || '',
              contactEmail: student.contact_email || '',
              college: student.college || '',
              degree: student.degree || '',
              branch: student.branch || '',
              graduationYear: student.graduation_year ?? null,
              isFresher: student.is_fresher !== false,
              skills: Array.isArray(student.skills) ? student.skills : (app.profileSnapshot?.skills || []),
            };
          }
        }
      }
    } catch {
      // ignore fallback
    }
  }

  return mapped;
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
      let appExtrasMap = new Map();
      try {
        const { data: appExtras } = await supabase
          .from('job_applications')
          .select('id,profile_snapshot,is_starred,admin_notes')
          .eq('job_id', jobId);
        if (appExtras) {
          appExtrasMap = new Map(appExtras.map((row) => [row.id, row]));
        }
      } catch {
        // ignore fallback
      }

      return data
        .map((row) => {
          const extra = appExtrasMap.get(row.id) || {};
          const isStarred = Boolean(
            extra.is_starred ||
              extra.profile_snapshot?.is_starred ||
              extra.profile_snapshot?.isStarred
          );
          const adminNotes =
            extra.admin_notes ||
            extra.profile_snapshot?.admin_notes ||
            extra.profile_snapshot?.adminNotes ||
            '';

          return {
            id: row.id,
            jobId: row.job_id,
            studentUserId: row.user_id,
            status: normalizeApplicationStatus(row.status),
            source: row.source,
            coverNote: row.cover_note || '',
            resumePath: row.resume_path || '',
            resumeShareToken: row.resume_share_token || '',
            isStarred,
            adminNotes,
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
          };
        })
        .map((candidate) => {
          const extra = appExtrasMap.get(candidate.id);
          return enrichQuickCandidate(candidate, extra?.profile_snapshot);
        });
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
  viewType = null,
  forceNotify = false,
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
        const mapped = mapApplication(data[0]);
        if (studentUserId || mapped?.studentUserId) {
          notifyApplicationStatusChange({
            applicationId: mapped.id,
            jobId: mapped.jobId || jobId,
            studentUserId: mapped.studentUserId || studentUserId,
            newStatus: mapped.status || normalizedStatus,
            viewType,
            forceNotify,
            interviewScheduledAt: mapped.interviewScheduledAt || interviewScheduledAt,
            interviewMode: mapped.interviewMode || interviewMode,
            interviewLocation: mapped.interviewLocation || interviewLocation,
            interviewInstructions: mapped.interviewInstructions || interviewInstructions,
          }).catch((err) => console.warn('Status push notification dispatch failed:', err?.message));
        }
        return mapped;
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
    const mapped = mapApplication(data);
    if (studentUserId || mapped?.studentUserId) {
      notifyApplicationStatusChange({
        applicationId: mapped.id,
        jobId: mapped.jobId || jobId,
        studentUserId: mapped.studentUserId || studentUserId,
        newStatus: mapped.status || normalizedStatus,
        viewType,
        forceNotify,
        interviewScheduledAt: mapped.interviewScheduledAt || interviewScheduledAt,
        interviewMode: mapped.interviewMode || interviewMode,
        interviewLocation: mapped.interviewLocation || interviewLocation,
        interviewInstructions: mapped.interviewInstructions || interviewInstructions,
      }).catch((err) => console.warn('Status push notification dispatch failed:', err?.message));
    }
    return mapped;
  }

  throw new Error('Could not update application stage.');
};

export const updateApplicationStatus = async ({
  applicationId,
  status,
  jobId,
  studentUserId,
  viewType = null,
  forceNotify = false,
}) => {
  return updateCandidatePipelineStage({
    applicationId,
    status,
    jobId,
    studentUserId,
    viewType,
    forceNotify,
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

/**
 * Toggle star status and optionally update admin recommendation notes on an application.
 * Supports both direct applications (job_applications) and assigned suitable profiles (job_suitable_profiles).
 */
export const updateApplicationStar = async ({
  applicationId,
  isStarred,
  adminNotes,
  isSuitableProfile = false,
  existingProfileSnapshot = {},
}) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  if (isSuitableProfile) {
    const updatePayload = {
      is_starred: isStarred,
      starred_at: isStarred ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    if (adminNotes !== undefined) {
      updatePayload.admin_notes = adminNotes;
    }

    try {
      const { data, error } = await supabase
        .from('job_suitable_profiles')
        .update(updatePayload)
        .eq('id', applicationId)
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          isStarred: Boolean(data.is_starred),
          adminNotes: data.admin_notes || '',
          isSuitableProfile: true,
          profileSnapshot: existingProfileSnapshot,
        };
      }
    } catch {
      // fallback
    }

    return {
      id: applicationId,
      isStarred,
      adminNotes: adminNotes || '',
      isSuitableProfile: true,
      profileSnapshot: existingProfileSnapshot,
    };
  }

  // Direct application in job_applications
  let currentSnapshot = { ...existingProfileSnapshot };
  let studentUserId = null;
  try {
    const { data: current } = await supabase
      .from('job_applications')
      .select('student_user_id, profile_snapshot, admin_notes')
      .eq('id', applicationId)
      .maybeSingle();
    studentUserId = current?.student_user_id;
    if (current?.profile_snapshot && Object.keys(current.profile_snapshot).length > 0) {
      currentSnapshot = {
        ...currentSnapshot,
        ...current.profile_snapshot,
      };
    }
  } catch {
    // ignore
  }

  // If candidate name is still missing in snapshot, look up student_profiles
  if (!currentSnapshot.fullName && studentUserId) {
    try {
      const { data: student } = await supabase
        .from('student_profiles')
        .select('full_name, phone, contact_email, college, degree, branch, graduation_year, is_fresher, skills')
        .eq('user_id', studentUserId)
        .maybeSingle();
      if (student) {
        currentSnapshot = {
          fullName: student.full_name || '',
          phone: student.phone || '',
          contactEmail: student.contact_email || '',
          college: student.college || '',
          degree: student.degree || '',
          branch: student.branch || '',
          graduationYear: student.graduation_year ?? null,
          isFresher: student.is_fresher !== false,
          skills: Array.isArray(student.skills) ? student.skills : [],
          ...currentSnapshot,
        };
      }
    } catch {
      // ignore
    }
  }

  const updatedSnapshot = {
    ...currentSnapshot,
    is_starred: isStarred,
    isStarred,
    ...(adminNotes !== undefined ? { admin_notes: adminNotes, adminNotes } : {}),
  };

  const payload = {
    is_starred: isStarred,
    starred_at: isStarred ? new Date().toISOString() : null,
    profile_snapshot: updatedSnapshot,
    updated_at: new Date().toISOString(),
  };
  if (adminNotes !== undefined) {
    payload.admin_notes = adminNotes;
  }

  let updateError = null;
  let updatedRow = null;

  try {
    const res = await supabase
      .from('job_applications')
      .update(payload)
      .eq('id', applicationId)
      .select(APPLICATION_COLUMNS)
      .single();

    if (!res.error) {
      updatedRow = res.data;
    } else {
      updateError = res.error;
    }
  } catch (err) {
    updateError = err;
  }

  // Fallback updating profile_snapshot only if dedicated columns fail
  if (updateError) {
    const fallbackRes = await supabase
      .from('job_applications')
      .update({
        profile_snapshot: updatedSnapshot,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)
      .select(APPLICATION_COLUMNS)
      .single();

    if (fallbackRes.error) {
      throw new Error(fallbackRes.error.message);
    }
    updatedRow = fallbackRes.data;
  }

  const mapped = mapApplication(updatedRow);
  if (mapped) {
    mapped.isStarred = isStarred;
    if (adminNotes !== undefined) {
      mapped.adminNotes = adminNotes;
    }
    mapped.profileSnapshot = {
      ...currentSnapshot,
      ...(mapped.profileSnapshot || {}),
      is_starred: isStarred,
      isStarred,
      ...(adminNotes !== undefined ? { admin_notes: adminNotes, adminNotes } : {}),
    };
  }
  return mapped;
};

/**
 * Fetch hiring progress for all jobs applied by the signed-in student.
 * Returns a Map keyed by jobId.
 */
export const fetchMyAppliedJobsHiringProgress = async () => {
  if (!isSupabaseConfigured || !supabase) {
    return new Map();
  }

  try {
    const { data, error } = await supabase.rpc('get_my_applied_jobs_hiring_progress');
    if (error) {
      console.warn('get_my_applied_jobs_hiring_progress rpc error:', error);
      return new Map();
    }

    const map = new Map();
    if (Array.isArray(data)) {
      for (const row of data) {
        const mapped = mapHiringProgressRow(row);
        if (mapped?.jobId) {
          map.set(mapped.jobId, mapped);
        }
      }
    }
    return map;
  } catch (err) {
    console.warn('fetchMyAppliedJobsHiringProgress exception:', err);
    return new Map();
  }
};

/**
 * Fetch hiring progress for a single job (for applied student or authorized admin/employer).
 */
export const fetchJobHiringProgress = async (jobId) => {
  if (!isSupabaseConfigured || !supabase || !jobId) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('get_job_hiring_progress', { p_job_id: jobId });
    if (error) {
      console.warn('get_job_hiring_progress rpc error:', error);
      return null;
    }

    if (Array.isArray(data) && data.length > 0) {
      return mapHiringProgressRow(data[0]);
    }
    return null;
  } catch (err) {
    console.warn('fetchJobHiringProgress exception:', err);
    return null;
  }
};

