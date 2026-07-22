import {
  formatAvailabilityLabel,
  formatJobCategoryLabel,
  formatRoleExperienceLabel,
} from './studentCareerPreferences.js';
import { toAbsoluteUrl } from './site.js';

const GROUP_ORDER = ['Contact', 'Education', 'Career preference', 'Profile'];

const formatSalaryRange = (student) => {
  if (student.expectedSalaryMin && student.expectedSalaryMax) {
    return `₹${student.expectedSalaryMin} - ₹${student.expectedSalaryMax}`;
  }
  if (student.expectedSalaryMin) {
    return `From ₹${student.expectedSalaryMin}`;
  }
  if (student.expectedSalaryMax) {
    return `Up to ₹${student.expectedSalaryMax}`;
  }
  return '';
};

/** Fields admins can include when sharing a student card with a company. */
export const STUDENT_SHARE_FIELDS = [
  {
    id: 'fullName',
    label: 'Full name',
    group: 'Contact',
    defaultSelected: true,
    getValue: (student) => student.fullName || '',
  },
  {
    id: 'contactEmail',
    label: 'Email',
    group: 'Contact',
    defaultSelected: true,
    getValue: (student) => student.contactEmail || '',
  },
  {
    id: 'phone',
    label: 'Phone',
    group: 'Contact',
    defaultSelected: true,
    getValue: (student) => student.phone || '',
  },
  {
    id: 'college',
    label: 'College',
    group: 'Education',
    defaultSelected: true,
    getValue: (student) => student.college || '',
  },
  {
    id: 'degree',
    label: 'Degree',
    group: 'Education',
    defaultSelected: true,
    getValue: (student) => student.degree || '',
  },
  {
    id: 'branch',
    label: 'Branch / stream',
    group: 'Education',
    defaultSelected: true,
    getValue: (student) => student.branch || '',
  },
  {
    id: 'graduationYear',
    label: 'Graduation year',
    group: 'Education',
    defaultSelected: true,
    getValue: (student) =>
      student.graduationYear == null ? '' : String(student.graduationYear),
  },
  {
    id: 'isFresher',
    label: 'Fresher',
    group: 'Education',
    defaultSelected: false,
    getValue: (student) => (student.isFresher ? 'Yes' : 'No'),
  },
  {
    id: 'targetJobCategories',
    label: 'Target job categories',
    group: 'Career preference',
    defaultSelected: true,
    getValue: (student) => {
      if (student.targetJobCategoryLabels?.length) {
        return student.targetJobCategoryLabels.join(', ');
      }
      const categories = student.targetJobCategories || [];
      return categories.map(formatJobCategoryLabel).filter(Boolean).join(', ');
    },
  },
  {
    id: 'primaryTargetRole',
    label: 'Target role',
    group: 'Career preference',
    defaultSelected: true,
    getValue: (student) => student.primaryTargetRole || '',
  },
  {
    id: 'roleExperienceLevel',
    label: 'Role experience',
    group: 'Career preference',
    defaultSelected: true,
    getValue: (student) =>
      student.roleExperienceLabel ||
      formatRoleExperienceLabel(student.roleExperienceLevel) ||
      '',
  },
  {
    id: 'availability',
    label: 'Availability',
    group: 'Career preference',
    defaultSelected: false,
    getValue: (student) =>
      student.availabilityLabel || formatAvailabilityLabel(student.availability) || '',
  },
  {
    id: 'preferredLocations',
    label: 'Preferred locations',
    group: 'Career preference',
    defaultSelected: false,
    getValue: (student) =>
      Array.isArray(student.preferredLocations)
        ? student.preferredLocations.join(', ')
        : '',
  },
  {
    id: 'expectedSalary',
    label: 'Expected salary',
    group: 'Career preference',
    defaultSelected: false,
    getValue: (student) => formatSalaryRange(student),
  },
  {
    id: 'skills',
    label: 'Skills',
    group: 'Profile',
    defaultSelected: true,
    getValue: (student) => {
      if (student.skillLabels?.length) {
        return student.skillLabels.join(', ');
      }
      return Array.isArray(student.skills) ? student.skills.join(', ') : '';
    },
  },
  {
    id: 'certifications',
    label: 'Certifications',
    group: 'Profile',
    defaultSelected: false,
    getValue: (student) =>
      student.certificationsText ||
      (Array.isArray(student.certifications) ? student.certifications.join('; ') : ''),
  },
];

const FIELD_BY_ID = new Map(STUDENT_SHARE_FIELDS.map((field) => [field.id, field]));

export const getDefaultStudentShareFieldIds = () =>
  STUDENT_SHARE_FIELDS.filter((field) => field.defaultSelected).map((field) => field.id);

export const getStudentShareFieldGroups = () => {
  const groups = new Map();
  for (const field of STUDENT_SHARE_FIELDS) {
    if (!groups.has(field.group)) {
      groups.set(field.group, []);
    }
    groups.get(field.group).push(field);
  }
  return GROUP_ORDER.map((group) => ({
    group,
    fields: groups.get(group) || [],
  })).filter((entry) => entry.fields.length > 0);
};

export const resolveStudentShareFields = (fieldIds = []) => {
  const selected = new Set(fieldIds);
  const fields = STUDENT_SHARE_FIELDS.filter((field) => selected.has(field.id));
  if (fields.length === 0) {
    throw new Error('Select at least one field to share.');
  }
  return fields;
};

/** Display-ready snapshot stored with the share link. */
export const buildStudentShareCardSnapshot = (student, fieldIds = []) => {
  const fields = resolveStudentShareFields(fieldIds);
  const cardFields = fields
    .map((field) => {
      const value = String(field.getValue(student) || '').trim();
      if (!value) {
        return null;
      }
      return {
        id: field.id,
        label: field.label,
        group: field.group,
        value,
      };
    })
    .filter(Boolean);

  if (cardFields.length === 0) {
    throw new Error('Selected fields have no values to share for this student.');
  }

  const nameField = cardFields.find((field) => field.id === 'fullName');
  const title = nameField?.value || 'Candidate profile';

  return {
    title,
    fields: cardFields,
  };
};

export const getStudentSharePath = (token) => {
  const normalized = String(token || '').trim();
  if (!normalized) {
    return '';
  }
  return `/s/${encodeURIComponent(normalized)}`;
};

export const getStudentShareUrl = (token) => {
  const path = getStudentSharePath(token);
  return path ? toAbsoluteUrl(path) : '';
};

export const isStudentShareToken = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim(),
  );

export const getShareFieldLabel = (fieldId) => FIELD_BY_ID.get(fieldId)?.label || fieldId;
