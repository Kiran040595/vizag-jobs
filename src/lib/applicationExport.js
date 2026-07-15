import { formatApplicationStatus } from './applicationStatus.js';
import { normalizeWhatsAppDigits } from './whatsappContact.js';

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

/** Build a real .xlsx workbook that Excel, Google Sheets, and LibreOffice can open. */
export const buildApplicationWorkbook = (applications, columnIds, XLSX) => {
  const { headers, rows, columns } = buildApplicationExportRows(applications, columnIds);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyTextColumnFormats(XLSX, worksheet, columns, rows.length);

  worksheet['!cols'] = columns.map((column, columnIndex) => ({
    wch: Math.min(
      48,
      Math.max(column.label.length, ...rows.map((row) => String(row[columnIndex] || '').length)),
    ),
  }));

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
