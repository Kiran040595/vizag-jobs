import {
  ADMIN_STATUS_OPTIONS,
  formatApplicationStatus,
  normalizeApplicationStatus,
} from './applicationStatus';

export const EMPTY_APPLICATION_FILTERS = {
  search: '',
  status: 'all',
  experience: 'all',
  college: 'all',
  skills: '',
};

export const APPLICATION_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...ADMIN_STATUS_OPTIONS.map((status) => ({
    value: status,
    label: formatApplicationStatus(status),
  })),
  { value: 'withdrawn', label: formatApplicationStatus('withdrawn') },
];

export const APPLICATION_EXPERIENCE_FILTER_OPTIONS = [
  { value: 'all', label: 'All experience' },
  { value: 'fresher', label: 'Fresher' },
  { value: 'experienced', label: 'Experienced' },
];

const snapshotOf = (application) => application?.profileSnapshot || {};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const skillsList = (snapshot) => {
  if (!Array.isArray(snapshot.skills)) {
    return [];
  }
  return snapshot.skills.map((skill) => String(skill || '').trim()).filter(Boolean);
};

export const hasActiveApplicationFilters = (filters = EMPTY_APPLICATION_FILTERS) => {
  const search = normalizeText(filters.search);
  const skills = normalizeText(filters.skills);
  return Boolean(
    search ||
      skills ||
      (filters.status && filters.status !== 'all') ||
      (filters.experience && filters.experience !== 'all') ||
      (filters.college && filters.college !== 'all'),
  );
};

/** Unique college names from the current applicant list, sorted. */
export const collectApplicationColleges = (applications = []) => {
  const colleges = new Set();
  applications.forEach((application) => {
    const college = String(snapshotOf(application).college || '').trim();
    if (college) {
      colleges.add(college);
    }
  });
  return Array.from(colleges).sort((a, b) => a.localeCompare(b));
};

export const filterApplications = (applications = [], filters = EMPTY_APPLICATION_FILTERS) => {
  const search = normalizeText(filters.search);
  const searchDigits = normalizePhone(filters.search);
  const status = filters.status && filters.status !== 'all' ? filters.status : '';
  const experience = filters.experience && filters.experience !== 'all' ? filters.experience : '';
  const college = filters.college && filters.college !== 'all' ? normalizeText(filters.college) : '';
  const skillsQuery = normalizeText(filters.skills);

  return applications.filter((application) => {
    const snapshot = snapshotOf(application);

    if (status && normalizeApplicationStatus(application.status) !== status) {
      return false;
    }

    if (experience === 'fresher' && !snapshot.isFresher) {
      return false;
    }
    if (experience === 'experienced' && snapshot.isFresher) {
      return false;
    }

    if (college && normalizeText(snapshot.college) !== college) {
      return false;
    }

    if (skillsQuery) {
      const skills = skillsList(snapshot).map((skill) => skill.toLowerCase());
      const matchesSkill = skills.some((skill) => skill.includes(skillsQuery));
      if (!matchesSkill) {
        return false;
      }
    }

    if (search) {
      const name = normalizeText(snapshot.fullName);
      const email = normalizeText(snapshot.contactEmail);
      const phone = normalizePhone(snapshot.phone);
      const haystack = `${name} ${email}`;
      const textMatch = haystack.includes(search);
      const phoneMatch = searchDigits.length >= 3 && phone.includes(searchDigits);
      if (!textMatch && !phoneMatch) {
        return false;
      }
    }

    return true;
  });
};
