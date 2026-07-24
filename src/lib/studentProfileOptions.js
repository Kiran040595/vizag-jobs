/** Canonical degree options for student profiles (stored as shown). */
export const STUDENT_DEGREE_OPTIONS = [
  '10th Pass',
  '12th Pass',
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
  'Commerce',
  'Accounting & Finance',
  'Business Administration',
  'Science (General)',
  'Arts / Humanities',
  'Not Applicable',
];

/** Graduation years for dropdown (recent past + near future). */
export const buildGraduationYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear + 3; year >= currentYear - 8; year -= 1) {
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
