import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { normalizeApplicationStatus } from '../lib/applicationStatus.js';
import { enrichQuickCandidate } from '../lib/quickApply.js';

export const buildCandidateSnapshot = (student) => {
  if (!student) return {};
  return {
    fullName: student.fullName || student.full_name || '',
    college: student.college || '',
    degree: student.degree || '',
    branch: student.branch || '',
    graduationYear: student.graduationYear || student.graduation_year || null,
    phone: student.phone || '',
    contactEmail: student.contactEmail || student.contact_email || '',
    skills: Array.isArray(student.skills) ? student.skills : [],
    certifications: Array.isArray(student.certifications) ? student.certifications : [],
    isFresher: Boolean(student.isFresher ?? student.is_fresher),
    targetJobCategories: Array.isArray(student.targetJobCategories || student.target_job_categories)
      ? (student.targetJobCategories || student.target_job_categories)
      : [],
    primaryTargetRole: student.primaryTargetRole || student.primary_target_role || '',
    roleExperienceLevel: student.roleExperienceLevel || student.role_experience_level || '',
    preferredLocations: Array.isArray(student.preferredLocations || student.preferred_locations)
      ? (student.preferredLocations || student.preferred_locations)
      : [],
    availability: student.availability || '',
    expectedSalaryMin: student.expectedSalaryMin || student.expected_salary_min || null,
    expectedSalaryMax: student.expectedSalaryMax || student.expected_salary_max || null,
  };
};

export const mapSuitableProfile = (row) => {
  if (!row) return null;

  const profile = {
    id: row.id,
    jobId: row.job_id,
    studentUserId: row.student_user_id,
    assignedBy: row.assigned_by,
    adminNotes: row.admin_notes || '',
    status: normalizeApplicationStatus(row.status || 'suitable'),
    recruiterNotes: row.recruiter_notes || '',
    interviewScheduledAt: row.interview_scheduled_at || null,
    interviewMode: row.interview_mode || 'in_person',
    interviewLocation: row.interview_location || '',
    interviewInstructions: row.interview_instructions || '',
    profileSnapshot: row.profile_snapshot || {},
    resumePath: row.resume_path || '',
    submittedAt: row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSuitableProfile: true,
  };

  return enrichQuickCandidate(profile, row.profile_snapshot);
};

/**
 * Assigns one or more candidate profiles directly to a company's job as suitable profiles.
 * Upserts to prevent duplicate errors if already assigned.
 */
export const assignCandidatesToJob = async ({
  jobId,
  candidateUserIds = [],
  adminNotes = '',
  candidateProfiles = [],
}) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Database service is not configured.');
  }

  if (!jobId) {
    throw new Error('A target job must be selected.');
  }

  const userIds = Array.from(new Set(candidateUserIds.filter(Boolean)));
  if (userIds.length === 0) {
    throw new Error('At least one candidate must be selected to assign.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Create a lookup for candidate profiles by userId
  const profileMap = new Map();
  for (const profile of candidateProfiles) {
    const id = profile.userId || profile.user_id;
    if (id) {
      profileMap.set(id, profile);
    }
  }

  // If any profiles aren't in candidateProfiles, fetch them from student_profiles
  const missingIds = userIds.filter((id) => !profileMap.has(id));
  if (missingIds.length > 0) {
    const { data: fetchedProfiles, error: fetchError } = await supabase
      .from('student_profiles')
      .select('*')
      .in('user_id', missingIds);

    if (!fetchError && fetchedProfiles) {
      for (const row of fetchedProfiles) {
        profileMap.set(row.user_id, row);
      }
    }
  }

  const rowsToUpsert = userIds.map((userId) => {
    const student = profileMap.get(userId) || {};
    const snapshot = buildCandidateSnapshot(student);
    const resumePath = student.resumePath || student.resume_path || '';

    return {
      job_id: jobId,
      student_user_id: userId,
      assigned_by: user?.id || null,
      admin_notes: (adminNotes || '').trim() || null,
      status: 'suitable',
      profile_snapshot: snapshot,
      resume_path: resumePath || null,
      updated_at: new Date().toISOString(),
    };
  });

  const { data, error } = await supabase
    .from('job_suitable_profiles')
    .upsert(rowsToUpsert, {
      onConflict: 'job_id,student_user_id',
    })
    .select('*');

  if (error) {
    throw new Error(error.message || 'Could not assign candidates to this job.');
  }

  return {
    count: data ? data.length : rowsToUpsert.length,
    profiles: (data || []).map(mapSuitableProfile),
  };
};

/**
 * Fetches suitable profiles assigned by admin for a specific job.
 */
export const fetchJobSuitableProfiles = async (jobId) => {
  if (!isSupabaseConfigured || !supabase || !jobId) {
    return [];
  }

  const { data, error } = await supabase
    .from('job_suitable_profiles')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching job suitable profiles:', error);
    return [];
  }

  return (data || []).map(mapSuitableProfile);
};

/**
 * Updates a suitable profile stage, recruiter notes, or interview schedule.
 */
export const updateSuitableProfileStage = async ({
  profileId,
  status,
  recruiterNotes,
  interviewScheduledAt,
  interviewMode,
  interviewLocation,
  interviewInstructions,
  clearInterview = false,
  jobId,
  studentUserId,
}) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Database service is not configured.');
  }

  const updates = {
    updated_at: new Date().toISOString(),
  };

  if (status !== undefined) {
    updates.status = normalizeApplicationStatus(status);
  }

  if (recruiterNotes !== undefined) {
    updates.recruiter_notes = typeof recruiterNotes === 'string' ? recruiterNotes.trim() : null;
  }

  if (clearInterview) {
    updates.interview_scheduled_at = null;
    updates.interview_mode = 'in_person';
    updates.interview_location = null;
    updates.interview_instructions = null;
  } else if (interviewScheduledAt !== undefined && interviewScheduledAt !== null) {
    updates.interview_scheduled_at = new Date(interviewScheduledAt).toISOString();
    if (interviewMode) updates.interview_mode = interviewMode;
    if (interviewLocation !== undefined) updates.interview_location = interviewLocation ? interviewLocation.trim() : null;
    if (interviewInstructions !== undefined) updates.interview_instructions = interviewInstructions ? interviewInstructions.trim() : null;
  }

  let query = supabase.from('job_suitable_profiles').update(updates);

  if (profileId) {
    query = query.eq('id', profileId);
  } else if (jobId && studentUserId) {
    query = query.eq('job_id', jobId).eq('student_user_id', studentUserId);
  } else {
    throw new Error('Target suitable profile ID or job+student pair is required.');
  }

  const { data, error } = await query.select('*').single();

  if (error) {
    throw new Error(error.message || 'Could not update candidate status.');
  }

  return mapSuitableProfile(data);
};

/**
 * Fetches suitable profiles count mapped by jobId for the employer dashboard.
 */
export const fetchEmployerSuitableProfileCounts = async (jobIds = []) => {
  if (!isSupabaseConfigured || !supabase || !Array.isArray(jobIds) || jobIds.length === 0) {
    return { byJobId: {}, totalCount: 0 };
  }

  const { data, error } = await supabase
    .from('job_suitable_profiles')
    .select('job_id')
    .in('job_id', jobIds);

  if (error) {
    console.warn('Could not fetch suitable profile counts:', error);
    return { byJobId: {}, totalCount: 0 };
  }

  const byJobId = {};
  let totalCount = 0;

  for (const row of data || []) {
    byJobId[row.job_id] = (byJobId[row.job_id] || 0) + 1;
    totalCount += 1;
  }

  return { byJobId, totalCount };
};
