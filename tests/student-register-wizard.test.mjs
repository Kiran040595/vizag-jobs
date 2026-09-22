import assert from 'node:assert/strict';
import { validateStudentProfilePayload } from '../src/lib/studentProfileValidation.js';
import { isValidStudentPhone, normalizeStudentPhone } from '../src/lib/studentPhoneAuth.js';
import {
  STUDENT_AVAILABILITY_OPTIONS,
  STUDENT_JOB_CATEGORY_OPTIONS,
  STUDENT_PREFERRED_LOCATION_OPTIONS,
  STUDENT_ROLE_EXPERIENCE_OPTIONS,
  resolveTargetJobCategoryToken,
} from '../src/lib/studentCareerPreferences.js';
import {
  STUDENT_BRANCH_OPTIONS,
  STUDENT_DEGREE_OPTIONS,
  STUDENT_GRADUATION_YEAR_OPTIONS,
  formatSkillLabel,
  isAllowedDegree,
  isAllowedGraduationYear,
  resolveSkillToken,
} from '../src/lib/studentProfileOptions.js';
import {
  POPULAR_CERTIFICATIONS,
  POPULAR_VIZAG_ROLES,
  filterSuggestions,
} from '../src/lib/studentRegistrationSuggestions.js';

console.log('Testing Student Registration Wizard Logic...');

// Step 1: Phone formatting & validation
assert.equal(isValidStudentPhone('9876543210'), true);
assert.equal(isValidStudentPhone('5876543210'), false); // Starts with 5
assert.equal(isValidStudentPhone('12345'), false); // Too short
assert.equal(normalizeStudentPhone('9876543210'), '+919876543210');
assert.equal(normalizeStudentPhone('+91 98765 43210'), '+919876543210');
assert.equal(normalizeStudentPhone('09876543210'), '+919876543210');

// Step 2: ITI Degree & Branch Options
assert.ok(STUDENT_DEGREE_OPTIONS.includes('ITI'), 'ITI should be in degree options');
assert.ok(isAllowedDegree('ITI'), 'ITI should be an allowed degree');
assert.ok(STUDENT_BRANCH_OPTIONS.includes('ITI Trade / Technical'), 'ITI Trade should be in branch options');

// Step 2: Graduation Years (2010 to 2030)
assert.equal(STUDENT_GRADUATION_YEAR_OPTIONS[0], '2030');
assert.equal(STUDENT_GRADUATION_YEAR_OPTIONS[STUDENT_GRADUATION_YEAR_OPTIONS.length - 1], '2010');
assert.equal(STUDENT_GRADUATION_YEAR_OPTIONS.length, 21, 'Should include 21 years from 2010 to 2030');
assert.ok(isAllowedGraduationYear('2010'), '2010 should be allowed');
assert.ok(isAllowedGraduationYear('2030'), '2030 should be allowed');
assert.ok(isAllowedGraduationYear('2026'), '2026 should be allowed');
assert.ok(!isAllowedGraduationYear('2005'), '2005 should not be allowed');

// Autocomplete filter matching
const testSkills = ['Python', 'PHP', 'Photoshop', 'PostgreSQL', 'React', 'Java'];
const pyMatches = filterSuggestions('py', testSkills);
assert.ok(pyMatches.includes('Python'));
assert.ok(!pyMatches.includes('React'));

const roleMatches = filterSuggestions('Dev', POPULAR_VIZAG_ROLES);
assert.ok(roleMatches.some((r) => r.includes('Developer') || r.includes('DevOps')));

const certMatches = filterSuggestions('AWS', POPULAR_CERTIFICATIONS);
assert.ok(certMatches.some((c) => c.includes('AWS')));

// Token resolution for custom inputs
assert.equal(resolveSkillToken('React'), 'react');
assert.equal(resolveSkillToken('React JS'), 'react js');
assert.equal(resolveSkillToken('python'), 'python');
assert.equal(formatSkillLabel('java'), 'Java');
assert.equal(resolveTargetJobCategoryToken('Software Full Stack', STUDENT_JOB_CATEGORY_OPTIONS), 'software_full_stack');

// Test that an ITI student profile with 2018 graduation year passes validation
const itiPayload = {
  full_name: 'K. Rajesh',
  college: 'Government ITI Visakhapatnam',
  degree: 'ITI',
  branch: 'ITI Trade / Technical',
  graduation_year: '2018',
  contact_email: 'rajesh.iti@example.com',
  phone: '9848099887',
  skills: ['electrical maintenance', 'two wheeler riding'],
  certifications: 'National Trade Certificate (NTC)',
  is_fresher: false,
  target_job_categories: ['electrical_electronics', 'mechanical_production'],
  primary_target_role: 'Electrical Maintenance Technician',
  role_experience_level: '2_4_years',
  preferred_locations: ['Visakhapatnam', 'Gajuwaka'],
  availability: 'immediate',
};

const validatedIti = validateStudentProfilePayload(itiPayload);
assert.equal(validatedIti.degree, 'ITI');
assert.equal(validatedIti.branch, 'ITI Trade / Technical');
assert.equal(validatedIti.graduation_year, 2018);
assert.equal(validatedIti.target_job_categories.length, 2);

// Test wizard default payload satisfies validateStudentProfilePayload
const wizardFilledPayload = {
  full_name: 'Harish Varma',
  college: 'Gayatri Vidya Parishad (GVP)',
  degree: 'B.Tech',
  branch: 'Computer Science (CSE)',
  graduation_year: '2026',
  contact_email: 'harish@example.com',
  phone: '9876543210',
  skills: ['java', 'python', 'sql'],
  certifications: 'None', // Defaulted or blank fallback
  is_fresher: true,
  target_job_categories: ['software_backend'],
  primary_target_role: 'Java Developer',
  role_experience_level: 'fresher',
  preferred_locations: ['Visakhapatnam'],
  availability: 'immediate',
};

const validated = validateStudentProfilePayload(wizardFilledPayload);
assert.equal(validated.full_name, 'Harish Varma');
assert.equal(validated.college, 'Gayatri Vidya Parishad (GVP)');
assert.equal(validated.phone, '+919876543210');
assert.equal(validated.is_fresher, true);
assert.equal(validated.certifications[0], 'None');
assert.deepEqual(validated.preferred_locations, ['Visakhapatnam']);
assert.equal(validated.availability, 'immediate');

// Test experienced switch
const experiencedPayload = {
  ...wizardFilledPayload,
  is_fresher: false,
  role_experience_level: '1_2_years',
  certifications: 'AWS Solutions Architect, Oracle Java SE',
};
const validatedExp = validateStudentProfilePayload(experiencedPayload);
assert.equal(validatedExp.is_fresher, false);
assert.equal(validatedExp.role_experience_level, '1_2_years');
assert.equal(validatedExp.certifications.length, 2);

console.log('student-register-wizard.test.mjs: OK');
