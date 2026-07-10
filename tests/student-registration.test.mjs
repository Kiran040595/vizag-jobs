import assert from 'node:assert/strict';
import {
  JOB_ARCHIVE_AFTER_DAYS,
  JOB_PURGE_ARCHIVED_AFTER_DAYS,
} from '../src/lib/jobRetention.js';
import { mapStudentProfileRow, studentSearchBlob } from '../src/lib/adminStudentProfile.js';

assert.equal(JOB_ARCHIVE_AFTER_DAYS, 90);
assert.equal(JOB_PURGE_ARCHIVED_AFTER_DAYS, 180);

const row = {
  user_id: '22222222-2222-2222-2222-222222222222',
  full_name: 'Priya Sharma',
  college: 'Andhra University',
  degree: 'B.Tech',
  branch: 'CSE',
  graduation_year: 2026,
  contact_email: 'priya@example.com',
  phone: '+91 90000 11111',
  skills: ['Java', 'Python'],
  is_fresher: true,
  is_active: true,
  created_at: '2026-07-10T08:00:00.000Z',
  updated_at: '2026-07-10T08:00:00.000Z',
};

const mapped = mapStudentProfileRow(row);
assert.equal(mapped.fullName, 'Priya Sharma');
assert.equal(mapped.college, 'Andhra University');
assert.equal(mapped.profileComplete, true);
assert.equal(mapped.isFresher, true);

const incomplete = mapStudentProfileRow({ ...row, full_name: 'Your name', college: '' });
assert.equal(incomplete.profileComplete, false);

assert.ok(studentSearchBlob(mapped).includes('andhra university'));

console.log('student-registration.test.mjs: OK');
