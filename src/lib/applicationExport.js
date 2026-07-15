import { normalizeWhatsAppDigits } from './whatsappContact.js';

/** @typedef {{ id: string, label: string, group: string, defaultSelected?: boolean, getValue: (application: object) => string }} ApplicationExportColumn */

const snapshot = (application) => application?.profileSnapshot || {};

import { formatApplicationStatus } from './applicationStatus.js';

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

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** SpreadsheetML workbook Excel opens as a real .xls sheet (phones stay text). */
export const buildApplicationExcelXml = (applications, columnIds) => {
  const { headers, rows } = buildApplicationExportRows(applications, columnIds);
  const headerRow = `<Row>${headers
    .map((header) => `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`)
    .join('')}</Row>`;
  const bodyRows = rows
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`)
          .join('')}</Row>`,
    )
    .join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Applicants">
  <Table>
   ${headerRow}
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;
};

export const buildApplicationExportFilename = (job, extension = 'xls') => {
  const slug = String(job?.slug || job?.title || 'job')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${slug || 'job'}-applicants-${stamp}.${extension}`;
};

export const downloadApplicationExcel = (applications, columnIds, job) => {
  const xml = buildApplicationExcelXml(applications, columnIds);
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = buildApplicationExportFilename(job, 'xls');
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const summarizeApplicationStatuses = (applications = []) =>
  applications.reduce((counts, application) => {
    const status = application.status || 'applied';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
