import assert from 'node:assert/strict';
import {
  JOB_ARCHIVE_AFTER_DAYS,
  JOB_PURGE_ARCHIVED_AFTER_DAYS,
} from '../src/lib/jobRetention.js';
import { mapStudentProfileRow, studentSearchBlob } from '../src/lib/adminStudentProfile.js';

assert.equal(JOB_ARCHIVE_AFTER_DAYS, 90);
assert.equal(JOB_PURGE_ARCHIVED_AFTER_DAYS, 180);

const completeRow = {
  user_id: '22222222-2222-2222-2222-222222222222',
  full_name: 'Priya Sharma',
  college: 'Andhra University',
  degree: 'B.Tech',
  branch: 'Computer Science (CSE)',
  graduation_year: 2026,
  contact_email: 'priya@example.com',
  phone: '+919876543210',
  skills: ['java', 'react'],
  certifications: ['Java Full Stack (Udemy)'],
  is_fresher: true,
  is_active: true,
  created_at: '2026-07-10T08:00:00.000Z',
  updated_at: '2026-07-10T08:00:00.000Z',
};

const mapped = mapStudentProfileRow(completeRow);
assert.equal(mapped.fullName, 'Priya Sharma');
assert.equal(mapped.college, 'Andhra University');
assert.equal(mapped.profileComplete, true);
assert.equal(mapped.isFresher, true);
assert.equal(mapped.skillLabels.join(', '), 'Java, React');

const incomplete = mapStudentProfileRow({
  ...completeRow,
  full_name: 'Your name',
  college: '',
  certifications: [],
  skills: [],
});
assert.equal(incomplete.profileComplete, false);

assert.ok(studentSearchBlob(mapped).includes('andhra university'));
assert.ok(studentSearchBlob(mapped).includes('java full stack'));

console.log('student-registration.test.mjs: OK');
