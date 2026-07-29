import assert from 'node:assert/strict';
import {
  JOB_ARCHIVE_AFTER_DAYS,
  JOB_PURGE_ARCHIVED_AFTER_DAYS,
} from '../src/lib/jobRetention.js';
import { mapStudentProfileRow, studentSearchBlob } from '../src/lib/adminStudentProfile.js';
import { validateStudentProfilePayload } from '../src/lib/studentProfileValidation.js';
import {
  buildLiveRoleOptions,
  resolveTargetJobCategoryToken,
} from '../src/lib/studentCareerPreferences.js';

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
  target_job_categories: ['software_frontend', 'software_backend'],
  primary_target_role: 'Frontend Developer',
  role_experience_level: 'fresher',
  preferred_locations: ['Vizag', 'Remote'],
  availability: 'immediate',
  expected_salary_min: 15000,
  expected_salary_max: 25000,
  is_active: true,
  consent_terms_at: '2026-07-10T08:00:00.000Z',
  consent_share_with_employers_at: '2026-07-10T08:00:00.000Z',
  consent_accurate_info_at: '2026-07-10T08:00:00.000Z',
  consent_age_18_at: '2026-07-10T08:00:00.000Z',
  created_at: '2026-07-10T08:00:00.000Z',
  updated_at: '2026-07-10T08:00:00.000Z',
};

const mapped = mapStudentProfileRow(completeRow);
assert.equal(mapped.fullName, 'Priya Sharma');
assert.equal(mapped.college, 'Andhra University');
assert.equal(mapped.profileComplete, true);
assert.equal(mapped.isFresher, true);
assert.equal(mapped.skillLabels.join(', '), 'Java, React');
assert.equal(mapped.targetJobCategoryLabels.join(', '), 'Software Frontend, Software Backend');
assert.equal(mapped.primaryTargetRole, 'Frontend Developer');
assert.equal(mapped.roleExperienceLabel, 'Fresher');
assert.equal(mapped.availabilityLabel, 'Immediate');

const incomplete = mapStudentProfileRow({
  ...completeRow,
  full_name: 'Your name',
  college: '',
  certifications: [],
  skills: [],
  target_job_categories: [],
  primary_target_role: '',
  preferred_locations: [],
});
assert.equal(incomplete.profileComplete, false);

const missingLocation = mapStudentProfileRow({
  ...completeRow,
  preferred_locations: [],
});
assert.equal(missingLocation.profileComplete, false);

assert.ok(studentSearchBlob(mapped).includes('andhra university'));
assert.ok(studentSearchBlob(mapped).includes('java full stack'));
assert.ok(studentSearchBlob(mapped).includes('software frontend'));
assert.ok(studentSearchBlob(mapped).includes('frontend developer'));

const validated = validateStudentProfilePayload({
  full_name: 'Priya Sharma',
  college: 'Andhra University',
  degree: 'B.Tech',
  branch: 'Computer Science (CSE)',
  graduation_year: '2026',
  phone: '9876543210',
  skills: ['java', 'react'],
  certifications: 'Java Full Stack (Udemy)',
  is_fresher: true,
  contact_email: 'priya@example.com',
  target_job_categories: ['software_frontend', 'software_backend'],
  primary_target_role: 'Frontend Developer',
  role_experience_level: 'fresher',
  preferred_locations: ['Vizag', 'Remote'],
  availability: 'immediate',
  expected_salary_min: '15000',
  expected_salary_max: '25000',
});

assert.equal(validated.full_name, 'Priya Sharma');
assert.deepEqual(validated.skills, ['java', 'react']);
assert.equal(validated.availability, 'immediate');
assert.equal(validated.graduation_year, 2026);

const withCustom = validateStudentProfilePayload({
  full_name: 'Priya Sharma',
  college: 'Andhra University',
  degree: 'B.Tech',
  branch: 'Computer Science (CSE)',
  graduation_year: '2026',
  phone: '9876543210',
  skills: ['java', 'Power BI'],
  certifications: 'None',
  is_fresher: true,
  contact_email: 'priya@example.com',
  target_job_categories: ['software_frontend', 'Hotel Management'],
  primary_target_role: 'Frontend Developer',
  role_experience_level: 'fresher',
  preferred_locations: ['Vizag'],
  availability: 'immediate',
});
assert.ok(withCustom.skills.includes('power bi'));
assert.ok(withCustom.target_job_categories.includes('hotel_management'));

const liveOptions = buildLiveRoleOptions([{ role: 'Site Engineer', usageCount: 4 }], 10);
assert.equal(resolveTargetJobCategoryToken('Site Engineer', liveOptions), 'site_engineer');
assert.equal(resolveTargetJobCategoryToken('Custom Warehouse Role', liveOptions), 'custom_warehouse_role');

assert.throws(
  () =>
    validateStudentProfilePayload({
      full_name: 'Priya Sharma',
      college: 'Andhra University',
      degree: 'B.Tech',
      branch: 'Computer Science (CSE)',
      graduation_year: '2026',
      phone: '9876543210',
      skills: ['java'],
      certifications: 'None',
      is_fresher: true,
      target_job_categories: ['software_frontend'],
      primary_target_role: 'Frontend Developer',
      role_experience_level: 'fresher',
      preferred_locations: [],
      availability: 'immediate',
    }),
  /preferred work location/i,
);

console.log('student-registration.test.mjs: OK');
