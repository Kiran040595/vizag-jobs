/** Canonical degree options for student profiles (stored as shown). */
export const STUDENT_DEGREE_OPTIONS = [
  '10th Pass',
  '12th Pass',
  'ITI',
  'Diploma',
  'B.Tech',
  'B.E',
  'B.Sc',
  'B.Com',
  'BBA',
  'BCA',
  'MCA',
  'M.Tech',
  'MBA',
  'Other',
];

/** Branch / stream options aligned with Vizag campus hiring. */
export const STUDENT_BRANCH_OPTIONS = [
  'Computer Science (CSE)',
  'Information Technology (IT)',
  'Electronics & Communication (ECE)',
  'Electrical & Electronics (EEE)',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Automobile Engineering',
  'ITI Trade / Technical',
  'Commerce',
  'Accounting & Finance',
  'Business Administration',
  'Science (General)',
  'Arts / Humanities',
  'Not Applicable',
];

/** Mapping of degrees to relevant branches/streams/trades. */
export const DEGREE_BRANCH_MAP = {
  '10th Pass': ['Not Applicable'],
  '12th Pass': ['Not Applicable', 'Science (General)', 'Commerce', 'Arts / Humanities'],
  'ITI': ['ITI Trade / Technical'],
  'Diploma': [
    'Mechanical Engineering',
    'Electrical & Electronics (EEE)',
    'Civil Engineering',
    'Computer Science (CSE)',
    'Information Technology (IT)',
    'Electronics & Communication (ECE)',
    'Automobile Engineering',
    'Chemical Engineering',
    'ITI Trade / Technical',
  ],
  'B.Tech': [
    'Computer Science (CSE)',
    'Information Technology (IT)',
    'Electronics & Communication (ECE)',
    'Electrical & Electronics (EEE)',
    'Mechanical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Automobile Engineering',
  ],
  'B.E': [
    'Computer Science (CSE)',
    'Information Technology (IT)',
    'Electronics & Communication (ECE)',
    'Electrical & Electronics (EEE)',
    'Mechanical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Automobile Engineering',
  ],
  'B.Sc': [
    'Science (General)',
    'Computer Science (CSE)',
    'Information Technology (IT)',
  ],
  'B.Com': [
    'Commerce',
    'Accounting & Finance',
    'Computer Science (CSE)',
    'Business Administration',
  ],
  'BBA': [
    'Business Administration',
    'Commerce',
    'Accounting & Finance',
  ],
  'BCA': [
    'Computer Science (CSE)',
    'Information Technology (IT)',
  ],
  'MCA': [
    'Computer Science (CSE)',
    'Information Technology (IT)',
  ],
  'M.Tech': [
    'Computer Science (CSE)',
    'Information Technology (IT)',
    'Electronics & Communication (ECE)',
    'Electrical & Electronics (EEE)',
    'Mechanical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Automobile Engineering',
  ],
  'MBA': [
    'Business Administration',
    'Accounting & Finance',
    'Commerce',
  ],
  'Other': STUDENT_BRANCH_OPTIONS,
};

/**
 * Returns the relevant branches for a selected degree qualification.
 * If degree is not provided or not in map, defaults to all canonical branch options.
 */
export const getBranchesForDegree = (degree) => {
  const trimmed = String(degree || '').trim();
  if (!trimmed || !DEGREE_BRANCH_MAP[trimmed]) {
    return STUDENT_BRANCH_OPTIONS;
  }
  return DEGREE_BRANCH_MAP[trimmed];
};

/**
 * Synchronizes the branch value when degree changes:
 * - '10th Pass' -> 'Not Applicable'
 * - Single-option degree like 'ITI' -> 'ITI Trade / Technical'
 * - '12th Pass' -> preserves valid stream or defaults to 'Not Applicable'
 * - Incompatible branch with new degree -> resets to ''
 * - Compatible branch with new degree -> preserved
 */
export const getSyncedBranchForDegree = (newDegree, currentBranch) => {
  const trimmedDegree = String(newDegree || '').trim();
  const trimmedBranch = String(currentBranch || '').trim();

  if (!trimmedDegree) {
    return '';
  }

  if (trimmedDegree === '10th Pass') {
    return 'Not Applicable';
  }

  const validBranches = getBranchesForDegree(trimmedDegree);

  // If only one branch option exists (e.g. ITI -> 'ITI Trade / Technical')
  if (validBranches.length === 1) {
    return validBranches[0];
  }

  // If 12th Pass, keep valid stream or default to 'Not Applicable'
  if (trimmedDegree === '12th Pass') {
    if (trimmedBranch && validBranches.includes(trimmedBranch)) {
      return trimmedBranch;
    }
    return 'Not Applicable';
  }

  // If the current branch is valid for the new degree, keep it
  if (trimmedBranch && validBranches.includes(trimmedBranch)) {
    return trimmedBranch;
  }

  // Reset to empty string so candidate is prompted to pick a valid branch for that degree
  return '';
};

/** Graduation years for dropdown (expanded 2010 to 2030). */
export const buildGraduationYearOptions = () => {
  const years = [];
  for (let year = 2030; year >= 2010; year -= 1) {
    years.push(String(year));
  }
  return years;
};

export const STUDENT_GRADUATION_YEAR_OPTIONS = buildGraduationYearOptions();

/**
 * Skills stored lowercase in DB for matching; labels shown Title Case in UI.
 * @type {{ value: string, label: string, group: string }[]}
 */
export const STUDENT_SKILL_OPTIONS = [
  { value: 'c', label: 'C', group: 'IT & Software' },
  { value: 'r', label: 'R', group: 'IT & Software' },
  { value: 'java', label: 'Java', group: 'IT & Software' },
  { value: 'python', label: 'Python', group: 'IT & Software' },
  { value: 'javascript', label: 'JavaScript', group: 'IT & Software' },
  { value: 'react', label: 'React', group: 'IT & Software' },
  { value: 'nodejs', label: 'Node.js', group: 'IT & Software' },
  { value: 'sql', label: 'SQL', group: 'IT & Software' },
  { value: 'html css', label: 'HTML & CSS', group: 'IT & Software' },
  { value: 'angular', label: 'Angular', group: 'IT & Software' },
  { value: 'spring boot', label: 'Spring Boot', group: 'IT & Software' },
  { value: 'dotnet', label: '.NET', group: 'IT & Software' },
  { value: 'php', label: 'PHP', group: 'IT & Software' },
  { value: 'android', label: 'Android', group: 'IT & Software' },
  { value: 'flutter', label: 'Flutter', group: 'IT & Software' },
  { value: 'data analysis', label: 'Data Analysis', group: 'IT & Software' },
  { value: 'manual testing', label: 'Manual Testing', group: 'IT & Software' },
  { value: 'automation testing', label: 'Automation Testing', group: 'IT & Software' },
  { value: 'ms excel', label: 'MS Excel', group: 'Office & Business' },
  { value: 'ms office', label: 'MS Office', group: 'Office & Business' },
  { value: 'tally', label: 'Tally', group: 'Office & Business' },
  { value: 'digital marketing', label: 'Digital Marketing', group: 'Office & Business' },
  { value: 'sales', label: 'Sales', group: 'Office & Business' },
  { value: 'customer support', label: 'Customer Support', group: 'Office & Business' },
  { value: 'communication', label: 'Communication', group: 'Soft Skills' },
  { value: 'teamwork', label: 'Teamwork', group: 'Soft Skills' },
  { value: 'problem solving', label: 'Problem Solving', group: 'Soft Skills' },
  { value: 'driving', label: 'Driving', group: 'Field & Logistics' },
  { value: 'two wheeler riding', label: 'Two-wheeler Riding', group: 'Field & Logistics' },
  { value: 'warehouse operations', label: 'Warehouse Operations', group: 'Field & Logistics' },
  { value: 'delivery operations', label: 'Delivery Operations', group: 'Field & Logistics' },
  { value: 'teaching', label: 'Teaching', group: 'Teaching & Education' },
  { value: 'classroom management', label: 'Classroom Management', group: 'Teaching & Education' },
  { value: 'lesson planning', label: 'Lesson Planning', group: 'Teaching & Education' },
  { value: 'curriculum development', label: 'Curriculum Development', group: 'Teaching & Education' },
  { value: 'student mentoring', label: 'Student Mentoring', group: 'Teaching & Education' },
  { value: 'online tutoring', label: 'Online Tutoring', group: 'Teaching & Education' },
];

const SKILL_LABEL_BY_VALUE = new Map(STUDENT_SKILL_OPTIONS.map((item) => [item.value, item.label]));

export const normalizeSkillValue = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const titleCaseSkill = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const formatSkillLabel = (value) => {
  const normalized = normalizeSkillValue(value);
  return SKILL_LABEL_BY_VALUE.get(normalized) || titleCaseSkill(normalized) || value;
};

/** Resolve preset or custom skill token from chip value or typed text. */
export const resolveSkillToken = (raw) => {
  const text = String(raw || '').trim();
  if (!text) {
    return '';
  }

  const normalized = normalizeSkillValue(text);
  const known = STUDENT_SKILL_OPTIONS.find(
    (item) =>
      item.value === normalized || item.label.toLowerCase() === text.toLowerCase(),
  );
  if (known) {
    return known.value;
  }

  if (normalized.length < 2 || normalized.length > 48) {
    return '';
  }
  return normalized;
};

export const parseSkillSelection = (values) => {
  const list = Array.isArray(values) ? values : [];
  return [...new Set(list.map(resolveSkillToken).filter(Boolean))].slice(0, 16);
};

export const groupSkillOptions = () => {
  const groups = new Map();
  for (const option of STUDENT_SKILL_OPTIONS) {
    if (!groups.has(option.group)) {
      groups.set(option.group, []);
    }
    groups.get(option.group).push(option);
  }
  return [...groups.entries()];
};

export const isAllowedDegree = (value) => STUDENT_DEGREE_OPTIONS.includes(String(value || '').trim());

export const isAllowedBranch = (value) => STUDENT_BRANCH_OPTIONS.includes(String(value || '').trim());

export const isAllowedGraduationYear = (value) =>
  STUDENT_GRADUATION_YEAR_OPTIONS.includes(String(value || '').trim());
