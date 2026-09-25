import assert from 'node:assert/strict';
import {
  APPLICATION_EXPORT_COLUMNS,
  buildApplicationExportFilename,
  buildApplicationExportRows,
  buildApplicationWorkbook,
  getDefaultExportColumnIds,
  resolveExportColumns,
  summarizeApplicationStatuses,
} from '../src/lib/applicationExport.js';
import * as XLSX from 'xlsx';

const sample = [
  {
    status: 'processing',
    coverNote: 'Interested in Vizag role',
    submittedAt: '2026-07-14T10:00:00.000Z',
    profileSnapshot: {
      fullName: 'Priya Sharma',
      contactEmail: 'priya@example.com',
      phone: '+919876543210',
      college: 'Andhra University',
      degree: 'B.Tech',
      branch: 'Computer Science (CSE)',
      graduationYear: 2026,
      isFresher: true,
      skills: ['java', 'react'],
      certifications: ['AWS Cloud Practitioner'],
    },
  },
  {
    status: 'applied',
    coverNote: '',
    submittedAt: '2026-07-15T08:00:00.000Z',
    profileSnapshot: {
      fullName: 'Ravi Kumar',
      contactEmail: 'ravi@example.com',
      phone: '9876501234',
      college: 'GITAM',
      degree: 'Diploma',
      branch: 'Mechanical Engineering',
      graduationYear: 2025,
      isFresher: false,
      skills: [],
      certifications: [],
    },
  },
];

assert.ok(APPLICATION_EXPORT_COLUMNS.length >= 10);
assert.ok(getDefaultExportColumnIds().includes('fullName'));
assert.ok(getDefaultExportColumnIds().includes('contactEmail'));
assert.ok(getDefaultExportColumnIds().includes('phone'));

const { headers, rows } = buildApplicationExportRows(sample, [
  'fullName',
  'contactEmail',
  'phone',
  'whatsapp',
  'degree',
]);
assert.deepEqual(headers, ['Name', 'Email', 'Phone number', 'WhatsApp number', 'Qualification / Degree']);
assert.equal(rows[0][0], 'Priya Sharma');
assert.equal(rows[0][1], 'priya@example.com');
assert.equal(rows[0][3], '+919876543210');
assert.equal(rows[0][4], 'B.Tech');
assert.equal(rows[1][3], '+919876501234');

assert.throws(() => resolveExportColumns([]), /at least one column/i);

const workbook = buildApplicationWorkbook(sample, ['fullName', 'phone'], XLSX);
const sheet = workbook.Sheets.Applicants;
const exported = XLSX.utils.sheet_to_json(sheet, { header: 1 });
assert.equal(exported[0][0], 'Name');
assert.equal(exported[0][1], 'Phone number');
assert.equal(exported[1][0], 'Priya Sharma');
assert.equal(exported[1][1], '+919876543210');

const filename = buildApplicationExportFilename({ slug: 'Junior React Developer', title: 'Junior React' }, 'xlsx');
assert.match(filename, /^junior-react-developer-applicants-\d{4}-\d{2}-\d{2}\.xlsx$/);

const counts = summarizeApplicationStatuses(sample);
assert.equal(counts.processing, 1);
assert.equal(counts.applied, 1);

console.log('application-export.test.mjs: OK');
