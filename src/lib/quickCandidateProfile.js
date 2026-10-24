import { formatSkillLabel, normalizeSkillValue } from './studentProfileOptions.js';

/**
 * Normalizes quick job form answers and application data into a canonical student profile record
 * compatible with Candidate Finder, Talent Pools, Excel export, and Employer sharing.
 */
export const mapQuickApplicationToCandidate = (row) => {
  if (!row) return null;

  const answers = row.form_answers && typeof row.form_answers === 'object' ? row.form_answers : {};
  const candidate = row.candidate || {};
  const job = row.job || {};

  const fullName = String(candidate.full_name || answers.full_name || 'Quick Candidate').trim();
  const phone = String(candidate.phone || answers.phone || '').trim();
  const contactEmail = String(answers.email || '').trim();

  // Extract skills from form answers and applied role
  const extractedSkills = new Set();
  const answersText = JSON.stringify(answers).toLowerCase();

  // Two-Wheeler / Bike detection
  const hasVehicleAnswer =
    answers.vehicle === 'Yes' ||
    answers.two_wheeler === 'Yes' ||
    answers.bike === 'Yes' ||
    /two[\s-]?wheeler|bike|motorcycle/i.test(answersText);
  if (hasVehicleAnswer) {
    extractedSkills.add('two wheeler riding');
  }

  // Driving License detection
  const hasLicenseAnswer =
    answers.licence === 'Yes' ||
    answers.license === 'Yes' ||
    answers.driving_license === 'Yes' ||
    /driving[\s-]?license|licence|\bdl\b/i.test(answersText);
  if (hasLicenseAnswer) {
    extractedSkills.add('driving license');
  }

  // Delivery & Logistics detection
  const appliedRoleRaw = String(row.applied_role || job.role || job.title || '').trim();
  const isDeliveryRole =
    /delivery|rider|courier|food delivery|parcel|swiggy|zomato/i.test(appliedRoleRaw) ||
    /delivery|rider|courier/i.test(answersText);
  if (isDeliveryRole) {
    extractedSkills.add('route navigation');
    extractedSkills.add('food delivery');
  }

  // Telecaller & Calling detection
  const isTelecallerRole =
    /telecaller|calling|bpo|voice|customer support/i.test(appliedRoleRaw) ||
    /telecaller|calling|inbound|outbound/i.test(answersText);
  if (isTelecallerRole) {
    extractedSkills.add('telecalling');
    extractedSkills.add('voice process');
  }

  // Languages detection
  if (/telugu/i.test(answersText)) extractedSkills.add('telugu fluency');
  if (/english/i.test(answersText)) extractedSkills.add('english communication');
  if (/hindi/i.test(answersText)) extractedSkills.add('hindi speaking');

  const skills = Array.from(extractedSkills).map(normalizeSkillValue).filter(Boolean);

  // Certifications
  const certifications = [];
  if (hasLicenseAnswer) {
    certifications.push('Two-Wheeler Driving License (DL)');
  }
  const certificationsText = certifications.join('; ');

  // Target Job Categories
  const targetJobCategories = [];
  if (isDeliveryRole || hasVehicleAnswer) targetJobCategories.push('delivery_logistics');
  if (isTelecallerRole) targetJobCategories.push('telecaller_bpo');
  if (/teacher|teaching|tutor/i.test(appliedRoleRaw)) targetJobCategories.push('teaching_education');
  if (targetJobCategories.length === 0) targetJobCategories.push('other');

  // Primary Role
  const primaryTargetRole = appliedRoleRaw || (isDeliveryRole ? 'Delivery Boy / Delivery Executive' : 'Candidate Lead');

  // Location / Area
  const currentArea = String(answers.location || answers.area || answers.address || job.location || '').trim();
  const currentCity = 'Visakhapatnam';
  const preferredLocations = ['Visakhapatnam'];

  // Experience
  let roleExperienceLevel = 'fresher';
  let roleExperienceLabel = 'Fresher';
  let isFresher = true;
  if (answers.experience !== undefined && answers.experience !== null && answers.experience !== '') {
    const expNum = Number(answers.experience);
    if (!isNaN(expNum) && expNum > 0) {
      isFresher = false;
      if (expNum <= 1) {
        roleExperienceLevel = '0_6_months';
        roleExperienceLabel = `${expNum} yr exp`;
      } else if (expNum <= 2) {
        roleExperienceLevel = '1_2_years';
        roleExperienceLabel = `${expNum} yrs exp`;
      } else {
        roleExperienceLevel = '2_4_years';
        roleExperienceLabel = `${expNum}+ yrs exp`;
      }
    }
  }

  // Education
  const rawEducation = String(answers.education || answers.qualification || '').trim();
  let degree = '10th Pass';
  if (/^10th/i.test(rawEducation)) degree = '10th Pass';
  else if (/12th|inter/i.test(rawEducation)) degree = '12th Pass';
  else if (/diploma/i.test(rawEducation)) degree = 'Diploma';
  else if (/graduate|degree|b\.?com|b\.?a|b\.?sc/i.test(rawEducation)) degree = 'B.Com';
  else if (/postgraduate|pg/i.test(rawEducation)) degree = 'MBA';
  else if (rawEducation) degree = rawEducation;

  const candidateId = row.quick_candidate_id || row.id;
  const userId = row.student_user_id || `quick-${candidateId}`;

  return {
    userId,
    studentUserId: row.student_user_id || null,
    quickCandidateId: row.quick_candidate_id || null,
    applicationId: row.id,
    candidateSource: 'quick_apply',
    isQuickCandidate: true,
    fullName,
    phone,
    contactEmail,
    college: job.title ? `Quick Apply: ${job.title}` : 'Quick Apply Lead',
    degree,
    branch: 'Not Applicable',
    graduationYear: null,
    currentCity,
    currentArea,
    educationStatus: 'completed',
    gender: '',
    willingToRelocate: false,
    interestedRoles: [],
    skills,
    skillLabels: skills.map(formatSkillLabel),
    certifications,
    certificationsText,
    targetJobCategories,
    targetJobCategoryLabels: targetJobCategories,
    primaryTargetRole,
    roleExperienceLevel,
    roleExperienceLabel,
    isFresher,
    preferredLocations,
    availability: 'immediate',
    availabilityLabel: 'Immediate',
    expectedSalaryMin: null,
    expectedSalaryMax: null,
    isActive: true,
    hasResume: false,
    resumePath: '',
    createdAt: row.submitted_at || new Date().toISOString(),
    quickAnswers: answers,
    quickJobTitle: job.title || '',
    quickCompany: job.company || '',
    needsReview: Boolean(candidate.needs_review),
  };
};

/**
 * Merges multiple quick applications by normalized phone or candidate ID,
 * preserving the most recent answers and combining applied roles.
 */
export const mergeQuickApplications = (applications = []) => {
  if (!Array.isArray(applications) || applications.length === 0) return [];

  const grouped = new Map();

  for (const row of applications) {
    if (!row) continue;
    const profile = mapQuickApplicationToCandidate(row);
    if (!profile) continue;

    const phoneKey = profile.phone ? profile.phone.replace(/\D/g, '') : '';
    const key = phoneKey || profile.quickCandidateId || profile.userId;

    if (!grouped.has(key)) {
      grouped.set(key, profile);
    } else {
      const existing = grouped.get(key);
      // If this application is newer, update primary fields but keep combined skills/roles
      const isNewer = new Date(profile.createdAt) > new Date(existing.createdAt);
      const combinedSkills = Array.from(new Set([...existing.skills, ...profile.skills]));
      const combinedRoles = Array.from(new Set([
        existing.primaryTargetRole,
        profile.primaryTargetRole,
        ...existing.interestedRoles,
        ...profile.interestedRoles,
      ].filter(Boolean)));

      const primary = isNewer ? profile : existing;
      const otherRole = combinedRoles.find((r) => r !== primary.primaryTargetRole);

      grouped.set(key, {
        ...primary,
        skills: combinedSkills,
        skillLabels: combinedSkills.map(formatSkillLabel),
        interestedRoles: otherRole ? [otherRole] : [],
        targetJobCategories: Array.from(new Set([...existing.targetJobCategories, ...profile.targetJobCategories])),
      });
    }
  }

  return Array.from(grouped.values());
};
