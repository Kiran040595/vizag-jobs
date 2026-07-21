import { formatApplicationStatus } from './applicationStatus.js';
import { toAbsoluteUrl } from './site.js';
import {
  formatAvailabilityLabel,
  formatJobCategoryLabel,
  formatRoleExperienceLabel,
} from './studentCareerPreferences.js';
import { normalizeWhatsAppDigits } from './whatsappContact.js';

/** Stable public link companies can open from a shared Excel sheet. */
export const getApplicationResumeShareUrl = (application) => {
  const token = String(application?.resumeShareToken || '').trim();
  const hasResume = Boolean(String(application?.resumePath || '').trim());
  if (!token || !hasResume) {
    return '';
  }
  return toAbsoluteUrl(`/r/${token}`);
};

/** @typedef {{ id: string, label: string, group: string, defaultSelected?: boolean, getValue: (application: object) => string }} ApplicationExportColumn */

const snapshot = (application) => application?.profileSnapshot || {};

const TEXT_COLUMN_IDS = new Set(['phone', 'whatsapp']);

const formatAppliedAt = (value) => {
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

/** Columns admins can include when downloading applicant details. */
export const APPLICATION_EXPORT_COLUMNS = /** @type {ApplicationExportColumn[]} */ ([
  {
    id: 'fullName',
    label: 'Name',
    group: 'Contact',
    defaultSelected: true,
    getValue: (app) => snapshot(app).fullName || '',
  },
  {
    id: 'contactEmail',
    label: 'Email',
    group: 'Contact',
    defaultSelected: true,
    getValue: (app) => snapshot(app).contactEmail || '',
  },
  {
    id: 'phone',
    label: 'Phone number',
    group: 'Contact',
    defaultSelected: true,
    getValue: (app) => snapshot(app).phone || '',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp number',
    group: 'Contact',
    defaultSelected: true,
    getValue: (app) => {
      const digits = normalizeWhatsAppDigits(snapshot(app).phone);
      return digits ? `+${digits}` : '';
    },
  },
  {
    id: 'college',
    label: 'College',
    group: 'Education',
    defaultSelected: true,
    getValue: (app) => snapshot(app).college || '',
  },
  {
    id: 'degree',
    label: 'Qualification / Degree',
    group: 'Education',
    defaultSelected: true,
    getValue: (app) => snapshot(app).degree || '',
  },
  {
    id: 'branch',
    label: 'Branch / Stream',
    group: 'Education',
    defaultSelected: true,
    getValue: (app) => snapshot(app).branch || '',
  },
  {
    id: 'graduationYear',
    label: 'Graduation year',
    group: 'Education',
    defaultSelected: true,
    getValue: (app) => {
      const year = snapshot(app).graduationYear;
      return year == null ? '' : String(year);
    },
  },
  {
    id: 'isFresher',
    label: 'Fresher',
    group: 'Education',
    defaultSelected: false,
    getValue: (app) => (snapshot(app).isFresher ? 'Yes' : 'No'),
  },
  {
    id: 'targetJobCategories',
    label: 'Target job categories',
    group: 'Career preference',
    defaultSelected: true,
    getValue: (app) => {
      const categories = snapshot(app).targetJobCategories;
      return Array.isArray(categories) ? categories.map(formatJobCategoryLabel).join('; ') : '';
    },
  },
  {
    id: 'primaryTargetRole',
    label: 'Primary target role',
    group: 'Career preference',
    defaultSelected: true,
    getValue: (app) => snapshot(app).primaryTargetRole || '',
  },
  {
    id: 'roleExperienceLevel',
    label: 'Role experience',
    group: 'Career preference',
    defaultSelected: true,
    getValue: (app) => formatRoleExperienceLabel(snapshot(app).roleExperienceLevel),
  },
  {
    id: 'availability',
    label: 'Availability',
    group: 'Career preference',
    defaultSelected: false,
    getValue: (app) => formatAvailabilityLabel(snapshot(app).availability),
  },
  {
    id: 'preferredLocations',
    label: 'Preferred locations',
    group: 'Career preference',
    defaultSelected: false,
    getValue: (app) => {
      const locations = snapshot(app).preferredLocations;
      return Array.isArray(locations) ? locations.join('; ') : '';
    },
  },
  {
    id: 'expectedSalary',
    label: 'Expected salary / month',
    group: 'Career preference',
    defaultSelected: false,
    getValue: (app) => {
      const min = snapshot(app).expectedSalaryMin;
      const max = snapshot(app).expectedSalaryMax;
      if (min && max) return `${min} - ${max}`;
      if (min) return `From ${min}`;
      if (max) return `Up to ${max}`;
      return '';
    },
  },
  {
    id: 'skills',
    label: 'Skills',
    group: 'Profile',
    defaultSelected: false,
    getValue: (app) => {
      const skills = snapshot(app).skills;
      return Array.isArray(skills) ? skills.join('; ') : '';
    },
  },
  {
    id: 'certifications',
    label: 'Certifications',
    group: 'Profile',
    defaultSelected: false,
    getValue: (app) => {
      const certs = snapshot(app).certifications;
      return Array.isArray(certs) ? certs.join('; ') : '';
    },
  },
  {
    id: 'coverNote',
    label: 'Cover note',
    group: 'Application',
    defaultSelected: false,
    getValue: (app) => app.coverNote || '',
  },
  {
    id: 'resumeLink',
    label: 'Resume link',
    group: 'Application',
    defaultSelected: true,
    getValue: (app) => getApplicationResumeShareUrl(app),
  },
  {
    id: 'status',
    label: 'Application status',
    group: 'Application',
    defaultSelected: true,
    getValue: (app) => formatApplicationStatus(app.status),
  },
  {
    id: 'submittedAt',
    label: 'Applied on',
    group: 'Application',
    defaultSelected: true,
    getValue: (app) => formatAppliedAt(app.submittedAt),
  },
]);

export const getDefaultExportColumnIds = () =>
  APPLICATION_EXPORT_COLUMNS.filter((column) => column.defaultSelected).map((column) => column.id);

export const resolveExportColumns = (columnIds = []) => {
  const selected = new Set(columnIds);
  const columns = APPLICATION_EXPORT_COLUMNS.filter((column) => selected.has(column.id));
  if (columns.length === 0) {
    throw new Error('Select at least one column to download.');
  }
  return columns;
};

export const buildApplicationExportRows = (applications, columnIds) => {
  const columns = resolveExportColumns(columnIds);
  const headers = columns.map((column) => column.label);
  const rows = (applications || []).map((application) =>
    columns.map((column) => column.getValue(application)),
  );
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

/** Turn resume URLs into real Excel hyperlinks that open in the browser on click. */
const applyResumeHyperlinks = (XLSX, worksheet, columns, rowCount) => {
  const resumeColumnIndexes = columns
    .map((column, index) => (column.id === 'resumeLink' ? index : -1))
    .filter((index) => index >= 0);

  if (resumeColumnIndexes.length === 0 || rowCount < 1) {
    return;
  }

  for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
    for (const columnIndex of resumeColumnIndexes) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[cellRef];
      const url = String(cell?.v || '').trim();
      if (!cell || !/^https?:\/\//i.test(url)) {
        continue;
      }

      // Friendly clickable link that opens the system browser from Excel.
      const label = 'Open resume';
      const safeUrl = url.replace(/"/g, '');
      cell.t = 's';
      cell.v = label;
      cell.f = `HYPERLINK("${safeUrl}","${label}")`;
      cell.l = { Target: safeUrl, Tooltip: 'Open resume in browser' };
    }
  }
};

/** Build a real .xlsx workbook that Excel, Google Sheets, and LibreOffice can open. */
export const buildApplicationWorkbook = (applications, columnIds, XLSX) => {
  const { headers, rows, columns } = buildApplicationExportRows(applications, columnIds);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyTextColumnFormats(XLSX, worksheet, columns, rows.length);
  applyResumeHyperlinks(XLSX, worksheet, columns, rows.length);

  worksheet['!cols'] = columns.map((column, columnIndex) => {
    if (column.id === 'resumeLink') {
      return { wch: 16 };
    }
    return {
      wch: Math.min(
        48,
        Math.max(column.label.length, ...rows.map((row) => String(row[columnIndex] || '').length)),
      ),
    };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Applicants');
  return workbook;
};

export const buildApplicationExportFilename = (job, extension = 'xlsx') => {
  const slug = String(job?.slug || job?.title || 'job')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${slug || 'job'}-applicants-${stamp}.${extension}`;
};

export const downloadApplicationExcel = async (applications, columnIds, job) => {
  const XLSX = await import('xlsx');
  const workbook = buildApplicationWorkbook(applications, columnIds, XLSX);
  XLSX.writeFile(workbook, buildApplicationExportFilename(job, 'xlsx'));
};

export const summarizeApplicationStatuses = (applications = []) =>
  applications.reduce((counts, application) => {
    const status = application.status || 'applied';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
