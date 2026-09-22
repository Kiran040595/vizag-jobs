import { mapStudentProfileRow } from './adminStudentProfile.js';

const ANONYMOUS_CLICK_NOTE = 'Anonymous visitor clicked Apply (Redirected to official application link)';
const REGISTERED_CLICK_NOTE = 'Clicked Apply (Redirected to official/company application link)';

/** Convert a `student_profiles` row (or mapped student) into an application snapshot. */
export const profileToExportSnapshot = (profile) => {
  if (!profile) {
    return {};
  }

  const mapped = profile.user_id ? mapStudentProfileRow(profile) : profile;
  if (!mapped) {
    return {};
  }

  return {
    fullName: mapped.fullName || '',
    college: mapped.college || '',
    degree: mapped.degree || '',
    branch: mapped.branch || '',
    graduationYear: mapped.graduationYear ?? null,
    phone: mapped.phone || '',
    contactEmail: mapped.contactEmail || '',
    skills: Array.isArray(mapped.skills) ? mapped.skills : [],
    certifications: Array.isArray(mapped.certifications) ? mapped.certifications : [],
    isFresher: mapped.isFresher !== false,
    targetJobCategories: Array.isArray(mapped.targetJobCategories) ? mapped.targetJobCategories : [],
    primaryTargetRole: mapped.primaryTargetRole || '',
    roleExperienceLevel: mapped.roleExperienceLevel || '',
    preferredLocations: Array.isArray(mapped.preferredLocations) ? mapped.preferredLocations : [],
    availability: mapped.availability || '',
    expectedSalaryMin: mapped.expectedSalaryMin ?? null,
    expectedSalaryMax: mapped.expectedSalaryMax ?? null,
  };
};

export const buildApplyClickExportApplication = (click, profile) => {
  const snapshot = profileToExportSnapshot(profile);
  const isRegistered = Boolean(click?.user_id || click?.userId);
  const fallbackName = isRegistered ? 'Registered Student' : 'External Visitor';

  return {
    id: click?.id,
    studentUserId: click?.user_id || click?.userId || null,
    status: 'external_click',
    coverNote: isRegistered ? REGISTERED_CLICK_NOTE : ANONYMOUS_CLICK_NOTE,
    resumePath: '',
    resumeShareToken: '',
    profileSnapshot: {
      ...snapshot,
      fullName: snapshot.fullName || fallbackName,
    },
    recruiterNotes: '',
    interviewScheduledAt: null,
    interviewMode: '',
    interviewLocation: '',
    interviewInstructions: '',
    submittedAt: click?.created_at || click?.createdAt || null,
  };
};

/**
 * Combine on-platform applications with unique apply-click profiles.
 * Clickers who already submitted an application are omitted so they are not duplicated.
 */
export const mergeApplicationsWithApplyClicks = (
  applications = [],
  clicks = [],
  profileByUserId = new Map(),
) => {
  const appliedUserIds = new Set(
    (applications || []).map((application) => application.studentUserId).filter(Boolean),
  );

  const clickRows = (clicks || [])
    .filter((click) => {
      const userId = click?.user_id || click?.userId;
      return !userId || !appliedUserIds.has(userId);
    })
    .map((click) => {
      const userId = click?.user_id || click?.userId;
      const profile = userId ? profileByUserId.get(userId) : null;
      return buildApplyClickExportApplication(click, profile);
    });

  return [...(applications || []), ...clickRows];
};
