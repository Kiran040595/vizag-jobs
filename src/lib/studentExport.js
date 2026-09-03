import { normalizeWhatsAppDigits } from './whatsappContact.js';

/** @typedef {{ id: string, label: string, group: string, defaultSelected?: boolean, getValue: (student: object) => string }} StudentExportColumn */

const TEXT_COLUMN_IDS = new Set(['phone', 'whatsapp']);

const formatRegisteredAt = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

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

/** Columns admins can include when downloading student registrations. */
export const STUDENT_EXPORT_COLUMNS = /** @type {StudentExportColumn[]} */ ([
  {
    id: 'fullName',
    label: 'Name',
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
    label: 'Phone number',
    group: 'Contact',
    defaultSelected: true,
    getValue: (student) => student.phone || '',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp number',
    group: 'Contact',
    defaultSelected: true,
    getValue: (student) => {
      const digits = normalizeWhatsAppDigits(student.phone);
      return digits ? `+${digits}` : '';
    },
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
    label: 'Branch / Stream',
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
    defaultSelected: true,
    getValue: (student) => (student.isFresher ? 'Yes' : 'No'),
  },
  {
    id: 'targetJobCategories',
    label: 'Target roles / categories',
    group: 'Career preference',
    defaultSelected: true,
    getValue: (student) => (student.targetJobCategoryLabels || []).join('; '),
  },
  {
    id: 'primaryTargetRole',
    label: 'Primary target role',
    group: 'Career preference',
    defaultSelected: true,
    getValue: (student) => student.primaryTargetRole || '',
  },
  {
    id: 'roleExperience',
    label: 'Role experience',
    group: 'Career preference',
    defaultSelected: true,
    getValue: (student) => student.roleExperienceLabel || '',
  },
  {
    id: 'availability',
    label: 'Availability',
    group: 'Career preference',
    defaultSelected: true,
    getValue: (student) => student.availabilityLabel || '',
  },
  {
    id: 'preferredLocations',
    label: 'Preferred locations',
    group: 'Career preference',
    defaultSelected: true,
    getValue: (student) => (student.preferredLocations || []).join('; '),
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
    getValue: (student) =>
      (student.skillLabels?.length ? student.skillLabels : student.skills || []).join('; '),
  },
  {
    id: 'certifications',
    label: 'Certifications',
    group: 'Profile',
    defaultSelected: false,
    getValue: (student) => student.certificationsText || '',
  },
  {
    id: 'isActive',
    label: 'Account status',
    group: 'Profile',
    defaultSelected: true,
    getValue: (student) => (student.isActive ? 'Active' : 'Deactivated'),
  },
  {
    id: 'profileComplete',
    label: 'Profile complete',
    group: 'Profile',
    defaultSelected: false,
    getValue: (student) => (student.profileComplete ? 'Yes' : 'No'),
  },
  {
    id: 'registeredAt',
    label: 'Registered on',
    group: 'Profile',
    defaultSelected: true,
    getValue: (student) => formatRegisteredAt(student.createdAt),
  },
]);

export const getDefaultStudentExportColumnIds = () =>
  STUDENT_EXPORT_COLUMNS.filter((column) => column.defaultSelected).map((column) => column.id);

export const resolveStudentExportColumns = (columnIds = []) => {
  const selected = new Set(columnIds);
  const columns = STUDENT_EXPORT_COLUMNS.filter((column) => selected.has(column.id));
  if (columns.length === 0) {
    throw new Error('Select at least one column to download.');
  }
  return columns;
};

export const buildStudentExportRows = (students, columnIds) => {
  const columns = resolveStudentExportColumns(columnIds);
  const headers = columns.map((column) => column.label);
  const rows = (students || []).map((student) => columns.map((column) => column.getValue(student)));
  return { headers, rows, columns };
};

const applyTextColumnFormats = (XLSX, worksheet, columns, rowCount) => {
  const textColumnIndexes = columns
    .map((column, index) => (TEXT_COLUMN_IDS.has(column.id) ? index : -1))
    .filter((index) => index >= 0);

  for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
    for (const columnIndex of textColumnIndexes) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[cellRef];
      if (!cell) {
        continue;
      }
      cell.t = 's';
      cell.v = String(cell.v ?? '');
      cell.z = '@';
    }
  }
};

export const buildStudentWorkbook = (students, columnIds, XLSX) => {
  const { headers, rows, columns } = buildStudentExportRows(students, columnIds);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyTextColumnFormats(XLSX, worksheet, columns, rows.length);

  worksheet['!cols'] = columns.map((column, columnIndex) => ({
    wch: Math.min(
      48,
      Math.max(column.label.length, ...rows.map((row) => String(row[columnIndex] || '').length)),
    ),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  return workbook;
};

export const buildStudentExportFilename = (scopeLabel = 'all-students', extension = 'xlsx') => {
  const slug = String(scopeLabel || 'all-students')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const stamp = new Date().toISOString().slice(0, 10);
  return `students-${slug || 'all'}-${stamp}.${extension}`;
};

export const downloadStudentExcel = async (students, columnIds, scopeLabel = 'all-students') => {
  if (!Array.isArray(students) || students.length === 0) {
    throw new Error('No students to download for this selection.');
  }
  const XLSX = await import('xlsx');
  const workbook = buildStudentWorkbook(students, columnIds, XLSX);
  XLSX.writeFile(workbook, buildStudentExportFilename(scopeLabel, 'xlsx'));
};
