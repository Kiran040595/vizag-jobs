import {
  ADMIN_STATUS_OPTIONS,
  formatApplicationStatus,
  normalizeApplicationStatus,
} from './applicationStatus.js';

export const ALL_APPLICATION_STATUSES = 'all';

export const APPLICATION_STATUS_FILTER_OPTIONS = [
  { value: ALL_APPLICATION_STATUSES, label: 'All statuses' },
  ...ADMIN_STATUS_OPTIONS.map((status) => ({
    value: status,
    label: formatApplicationStatus(status),
  })),
  { value: 'withdrawn', label: formatApplicationStatus('withdrawn') },
];

export const QUALIFICATION_CATEGORIES = [
  { value: 'all', label: 'All Qualifications' },
  { value: 'btech', label: 'B.Tech / B.E' },
  { value: 'degree', label: 'Degree (B.Sc / B.Com / BBA / BCA)' },
  { value: 'diploma', label: 'Diploma / Polytechnic' },
  { value: 'pg', label: 'Post Graduate (MBA / MCA / M.Tech)' },
  { value: 'iti', label: 'ITI' },
  { value: 'intermediate', label: 'Intermediate / 10+2' },
  { value: 'other', label: 'Other Qualifications' },
];

/**
 * Categorizes a candidate's degree string into standard qualification buckets.
 */
export const getQualificationBucket = (degreeStr = '') => {
  const d = String(degreeStr || '').toLowerCase().trim();
  if (!d) return 'other';

  if (
    d.includes('b.tech') ||
    d.includes('btech') ||
    d.includes('b.e') ||
    d.includes('be ') ||
    d === 'be' ||
    d.includes('engineering') ||
    d.includes('b.arch')
  ) {
    return 'btech';
  }

  if (d.includes('diploma') || d.includes('polytechnic')) {
    return 'diploma';
  }

  if (
    d.includes('m.tech') ||
    d.includes('mtech') ||
    d.includes('mca') ||
    d.includes('mba') ||
    d.includes('m.sc') ||
    d.includes('msc') ||
    d.includes('m.com') ||
    d.includes('mcom') ||
    d.includes('post graduate') ||
    d.includes('pg ') ||
    d === 'pg'
  ) {
    return 'pg';
  }

  if (
    d.includes('b.sc') ||
    d.includes('bsc') ||
    d.includes('b.com') ||
    d.includes('bcom') ||
    d.includes('bba') ||
    d.includes('bca') ||
    d.includes('degree') ||
    d.includes('graduate') ||
    d.includes('b.a') ||
    d.includes('ba ') ||
    d === 'ba'
  ) {
    return 'degree';
  }

  if (d.includes('iti')) {
    return 'iti';
  }

  if (
    d.includes('intermediate') ||
    d.includes('12th') ||
    d.includes('10th') ||
    d.includes('inter') ||
    d.includes('plus two')
  ) {
    return 'intermediate';
  }

  return 'other';
};

/**
 * Filter applications by status (backward-compatible signature).
 */
export const filterApplicationsByStatus = (applications = [], status = ALL_APPLICATION_STATUSES) => {
  if (!status || status === ALL_APPLICATION_STATUSES) {
    return applications;
  }

  return applications.filter(
    (application) => normalizeApplicationStatus(application.status) === status,
  );
};

/**
 * Filter and sort applications with full multi-facet search criteria.
 */
export const filterApplications = (applications = [], criteria = {}) => {
  const {
    search = '',
    status = ALL_APPLICATION_STATUSES,
    qualification = 'all',
    passoutYear = 'all',
    skill = 'all',
    isStarredOnly = false,
    earlyOnly = false,
    hasResumeOnly = false,
    hasPhoneOnly = false,
    sortBy = 'newest',
  } = criteria;

  // Pre-calculate early applicant set if earlyOnly is requested
  let earlyIds = null;
  if (earlyOnly && applications.length > 0) {
    const sortedByTimeAsc = [...applications].sort((a, b) => {
      const tA = new Date(a.submittedAt || a.createdAt || 0).getTime();
      const tB = new Date(b.submittedAt || b.createdAt || 0).getTime();
      return tA - tB;
    });
    // First 25% or minimum top 5 applicants
    const cutoff = Math.max(1, Math.min(sortedByTimeAsc.length, Math.ceil(sortedByTimeAsc.length * 0.25)));
    earlyIds = new Set(sortedByTimeAsc.slice(0, cutoff).map((app) => app.id));
  }

  const queryTerms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);

  let list = applications.filter((application) => {
    const snap = application.profileSnapshot || {};

    // 1. Status filter
    if (status && status !== ALL_APPLICATION_STATUSES) {
      const s = normalizeApplicationStatus(application.status);
      if (status === 'applied') {
        if (s !== 'applied' && s !== 'external_click') return false;
      } else if (s !== status) {
        return false;
      }
    }

    // 2. Starred / Recommended only
    if (isStarredOnly) {
      const isStarred = Boolean(
        application.isStarred ||
          snap.is_starred ||
          snap.isStarred ||
          (application.isSuitableProfile && Boolean(application.adminNotes))
      );
      if (!isStarred) return false;
    }

    // 3. Early applicants only
    if (earlyOnly && earlyIds && !earlyIds.has(application.id)) {
      return false;
    }

    // 4. Resume only
    if (hasResumeOnly && !application.resumePath) {
      return false;
    }

    // 5. Phone only
    if (hasPhoneOnly && !snap.phone) {
      return false;
    }

    // 6. Qualification filter
    if (qualification && qualification !== 'all') {
      const candidateDegree = snap.degree || '';
      const bucket = getQualificationBucket(candidateDegree);
      const target = qualification.toLowerCase().trim();
      const matchesBucket = bucket === target;
      const matchesRaw = candidateDegree.toLowerCase().includes(target);
      if (!matchesBucket && !matchesRaw) return false;
    }

    // 7. Passout Year filter
    if (passoutYear && passoutYear !== 'all') {
      const candidateYear = String(snap.graduationYear || '').trim();
      if (passoutYear.startsWith('<=')) {
        const threshold = parseInt(passoutYear.replace('<=', ''), 10);
        const yearNum = parseInt(candidateYear, 10);
        if (!yearNum || yearNum > threshold) return false;
      } else if (passoutYear.startsWith('>=')) {
        const threshold = parseInt(passoutYear.replace('>=', ''), 10);
        const yearNum = parseInt(candidateYear, 10);
        if (!yearNum || yearNum < threshold) return false;
      } else if (candidateYear !== String(passoutYear).trim()) {
        return false;
      }
    }

    // 8. Skill filter
    if (skill && skill !== 'all') {
      const targetSkill = skill.toLowerCase().trim();
      const skillsArray = Array.isArray(snap.skills) ? snap.skills : [];
      const hasSkill = skillsArray.some((s) => String(s || '').toLowerCase().includes(targetSkill));
      if (!hasSkill) return false;
    }

    // 9. Free-text search query across multiple fields
    if (queryTerms.length > 0) {
      const name = (snap.fullName || '').toLowerCase();
      const phone = (snap.phone || '').toLowerCase();
      const email = (snap.contactEmail || '').toLowerCase();
      const college = (snap.college || '').toLowerCase();
      const degree = (snap.degree || '').toLowerCase();
      const branch = (snap.branch || '').toLowerCase();
      const gradYear = String(snap.graduationYear || '').toLowerCase();
      const skillsText = Array.isArray(snap.skills) ? snap.skills.join(' ').toLowerCase() : '';
      const adminNotes = (application.adminNotes || snap.admin_notes || '').toLowerCase();
      const coverNote = (application.coverNote || '').toLowerCase();

      const combinedHaystack = `${name} ${phone} ${email} ${college} ${degree} ${branch} ${gradYear} ${skillsText} ${adminNotes} ${coverNote}`;

      const allTermsMatch = queryTerms.every((term) => combinedHaystack.includes(term));
      if (!allTermsMatch) return false;
    }

    return true;
  });

  // Sort
  return [...list].sort((a, b) => {
    const timeA = new Date(a.submittedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.submittedAt || b.createdAt || 0).getTime();

    if (sortBy === 'oldest' || sortBy === 'early_register') {
      // Early register: Earliest submitted/applied first
      return timeA - timeB;
    }

    if (sortBy === 'name_asc') {
      const nameA = (a.profileSnapshot?.fullName || '').toLowerCase();
      const nameB = (b.profileSnapshot?.fullName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    }

    if (sortBy === 'has_resume') {
      const hasA = Boolean(a.resumePath);
      const hasB = Boolean(b.resumePath);
      if (hasA !== hasB) return hasA ? -1 : 1;
      return timeB - timeA;
    }

    // Default newest or starred_first: Starred / Referred candidates ALWAYS appear first, then newest
    const starA = Boolean(
      a.isStarred ||
        a.profileSnapshot?.is_starred ||
        a.profileSnapshot?.isStarred ||
        (a.isSuitableProfile && Boolean(a.adminNotes))
    );
    const starB = Boolean(
      b.isStarred ||
        b.profileSnapshot?.is_starred ||
        b.profileSnapshot?.isStarred ||
        (b.isSuitableProfile && Boolean(b.adminNotes))
    );
    if (starA !== starB) return starA ? -1 : 1;

    return timeB - timeA;
  });
};

/**
 * Extracts available facet options and aggregate counts from an applicant collection.
 */
export const extractApplicationFilterOptions = (applications = []) => {
  const yearsSet = new Set();
  const degreesSet = new Set();
  const skillCountMap = new Map();
  let starredCount = 0;
  let withResumeCount = 0;
  let withPhoneCount = 0;

  for (const app of applications) {
    const snap = app.profileSnapshot || {};

    if (app.isStarred || snap.is_starred || snap.isStarred || (app.isSuitableProfile && app.adminNotes)) {
      starredCount += 1;
    }
    if (app.resumePath) withResumeCount += 1;
    if (snap.phone) withPhoneCount += 1;

    if (snap.graduationYear) {
      const yr = String(snap.graduationYear).trim();
      if (/^\d{4}$/.test(yr)) {
        yearsSet.add(yr);
      }
    }

    if (snap.degree) {
      degreesSet.add(String(snap.degree).trim());
    }

    if (Array.isArray(snap.skills)) {
      for (const skill of snap.skills) {
        const clean = String(skill || '').trim();
        if (clean) {
          const key = clean.toLowerCase();
          const current = skillCountMap.get(key) || { label: clean, count: 0 };
          current.count += 1;
          skillCountMap.set(key, current);
        }
      }
    }
  }

  // Sorted passout years descending
  const sortedYears = [...yearsSet].sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

  // Top skills sorted by frequency
  const topSkills = [...skillCountMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    availableYears: sortedYears,
    availableDegrees: [...degreesSet].sort((a, b) => a.localeCompare(b)),
    topSkills,
    starredCount,
    withResumeCount,
    withPhoneCount,
    totalCount: applications.length,
  };
};
