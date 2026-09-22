/**
 * Unit tests for apply-click Excel profile export helpers.
 * Run with: node tests/apply-click-export.test.mjs
 */

import assert from 'node:assert/strict';
import {
  buildApplyClickExportApplication,
  mergeApplicationsWithApplyClicks,
  profileToExportSnapshot,
} from '../src/lib/applyClickExport.js';
import {
  APPLICATION_EXPORT_COLUMNS,
  buildApplicationExportRows,
  buildApplicationWorkbook,
  getDefaultExportColumnIds,
} from '../src/lib/applicationExport.js';
import { formatApplicationStatus } from '../src/lib/applicationStatus.js';
import * as XLSX from 'xlsx';

assert.equal(formatApplicationStatus('external_click'), 'External Apply Click');

const profileRow = {
  user_id: 'student-1',
  full_name: 'Ananya Rao',
  contact_email: 'ananya@example.com',
  phone: '9876543210',
  college: 'Andhra University',
  degree: 'B.Tech',
  branch: 'Computer Science (CSE)',
  graduation_year: 2026,
  is_fresher: true,
  skills: ['react', 'javascript'],
  certifications: ['AWS Cloud Practitioner'],
  target_job_categories: ['software_frontend'],
  primary_target_role: 'Frontend Developer',
  role_experience_level: 'fresher',
  availability: 'immediate',
  preferred_locations: ['Vizag'],
  expected_salary_min: 20000,
  expected_salary_max: 30000,
};

const snapshot = profileToExportSnapshot(profileRow);
assert.equal(snapshot.fullName, 'Ananya Rao');
assert.equal(snapshot.contactEmail, 'ananya@example.com');
assert.equal(snapshot.primaryTargetRole, 'Frontend Developer');
assert.deepEqual(snapshot.skills, ['react', 'javascript']);

const registeredClick = buildApplyClickExportApplication(
  {
    id: 'click-1',
    user_id: 'student-1',
    created_at: '2026-09-20T08:00:00.000Z',
  },
  profileRow,
);
assert.equal(registeredClick.status, 'external_click');
assert.equal(registeredClick.profileSnapshot.fullName, 'Ananya Rao');
assert.equal(registeredClick.profileSnapshot.phone, '9876543210');
assert.match(registeredClick.coverNote, /Clicked Apply/);

const anonymousClick = buildApplyClickExportApplication(
  { id: 'click-2', user_id: null, created_at: '2026-09-21T08:00:00.000Z' },
  null,
);
assert.equal(anonymousClick.profileSnapshot.fullName, 'External Visitor');
assert.match(anonymousClick.coverNote, /Anonymous/);

const applications = [
  {
    id: 'app-1',
    studentUserId: 'student-1',
    status: 'applied',
    submittedAt: '2026-09-19T08:00:00.000Z',
    profileSnapshot: { fullName: 'Ananya Rao', contactEmail: 'ananya@example.com' },
  },
];
const clicks = [
  { id: 'click-1', user_id: 'student-1', created_at: '2026-09-20T08:00:00.000Z' },
  { id: 'click-3', user_id: 'student-2', created_at: '2026-09-21T08:00:00.000Z' },
  { id: 'click-2', user_id: null, created_at: '2026-09-21T09:00:00.000Z' },
];
const profileMap = new Map([
  ['student-1', profileRow],
  [
    'student-2',
    {
      user_id: 'student-2',
      full_name: 'Ravi Kumar',
      contact_email: 'ravi@example.com',
      phone: '9123456789',
      college: 'GITAM',
      degree: 'Diploma',
      branch: 'Mechanical Engineering',
      graduation_year: 2025,
      skills: ['autocad'],
      certifications: [],
      target_job_categories: ['mechanical_production'],
      primary_target_role: 'Mechanical Technician',
      role_experience_level: '1_2_years',
    },
  ],
]);

const merged = mergeApplicationsWithApplyClicks(applications, clicks, profileMap);
assert.equal(merged.length, 3);
assert.equal(merged[0].id, 'app-1');
assert.equal(merged[1].profileSnapshot.fullName, 'Ravi Kumar');
assert.equal(merged[2].profileSnapshot.fullName, 'External Visitor');
assert.ok(!merged.some((row) => row.id === 'click-1'));

const columnIds = getDefaultExportColumnIds();
assert.ok(columnIds.includes('fullName'));
assert.ok(columnIds.includes('phone'));
assert.ok(APPLICATION_EXPORT_COLUMNS.some((column) => column.group === 'Career preference'));

const { headers, rows } = buildApplicationExportRows(merged, [
  'fullName',
  'contactEmail',
  'phone',
  'college',
  'primaryTargetRole',
  'status',
]);
assert.deepEqual(headers, [
  'Name',
  'Email',
  'Phone number',
  'College',
  'Primary target role',
  'Application status',
]);
assert.equal(rows[1][0], 'Ravi Kumar');
assert.equal(rows[1][1], 'ravi@example.com');
assert.equal(rows[1][3], 'GITAM');
assert.equal(rows[1][4], 'Mechanical Technician');
assert.equal(rows[1][5], 'External Apply Click');

const workbook = buildApplicationWorkbook(merged, ['fullName', 'status', 'college'], XLSX);
const sheet = workbook.Sheets.Applicants;
const exported = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
assert.deepEqual(exported[0], ['Name', 'College', 'Application status']);
assert.equal(exported[2][0], 'Ravi Kumar');
assert.equal(exported[2][1], 'GITAM');
assert.equal(exported[2][2], 'External Apply Click');
assert.equal(exported[3][0], 'External Visitor');

console.log('apply-click-export.test.mjs: OK');
