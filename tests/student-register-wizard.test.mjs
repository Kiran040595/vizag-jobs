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
  DEGREE_BRANCH_MAP,
  getBranchesForDegree,
  getSyncedBranchForDegree,
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

// Step 2: Degree-to-Branch Synchronization Tests
for (const deg of STUDENT_DEGREE_OPTIONS) {
  assert.ok(DEGREE_BRANCH_MAP[deg], `DEGREE_BRANCH_MAP must define branches for degree: ${deg}`);
  const branches = getBranchesForDegree(deg);
  assert.ok(Array.isArray(branches) && branches.length > 0, `Degree ${deg} must have at least one branch option`);
  for (const b of branches) {
    assert.ok(STUDENT_BRANCH_OPTIONS.includes(b), `Branch "${b}" under degree "${deg}" must be a canonical branch in STUDENT_BRANCH_OPTIONS`);
  }
}

// B.Com specific branches
const bcomBranches = getBranchesForDegree('B.Com');
assert.ok(bcomBranches.includes('Commerce'), 'B.Com must include Commerce');
assert.ok(bcomBranches.includes('Accounting & Finance'), 'B.Com must include Accounting & Finance');
assert.ok(bcomBranches.includes('Computer Science (CSE)'), 'B.Com must include Computer Science (CSE)');
assert.ok(bcomBranches.includes('Business Administration'), 'B.Com must include Business Administration');
assert.ok(!bcomBranches.includes('Mechanical Engineering'), 'B.Com must not include Mechanical Engineering');
assert.ok(!bcomBranches.includes('Civil Engineering'), 'B.Com must not include Civil Engineering');

// B.Tech specific branches
const btechBranches = getBranchesForDegree('B.Tech');
assert.ok(btechBranches.includes('Mechanical Engineering'), 'B.Tech must include Mechanical Engineering');
assert.ok(!btechBranches.includes('Accounting & Finance'), 'B.Tech must not include Accounting & Finance');

// ITI & 10th Pass single branch options
assert.deepEqual(getBranchesForDegree('ITI'), ['ITI Trade / Technical']);
assert.deepEqual(getBranchesForDegree('10th Pass'), ['Not Applicable']);

// Dynamic branch syncing behavior
// 1. Incompatible branch is reset to empty string
assert.equal(getSyncedBranchForDegree('B.Com', 'Mechanical Engineering'), '', 'Switching to B.Com from Mechanical Engineering must reset branch');
// 2. Compatible branch is preserved
assert.equal(getSyncedBranchForDegree('B.Com', 'Commerce'), 'Commerce', 'Switching to B.Com with Commerce must preserve Commerce');
assert.equal(getSyncedBranchForDegree('BCA', 'Computer Science (CSE)'), 'Computer Science (CSE)', 'Switching to BCA with CSE must preserve CSE');
// 3. Single option degree auto-populates
assert.equal(getSyncedBranchForDegree('ITI', ''), 'ITI Trade / Technical', 'Selecting ITI must auto-populate ITI Trade / Technical');
assert.equal(getSyncedBranchForDegree('ITI', 'Mechanical Engineering'), 'ITI Trade / Technical', 'Switching to ITI must set ITI Trade / Technical');
// 4. 10th Pass auto-populates Not Applicable
assert.equal(getSyncedBranchForDegree('10th Pass', ''), 'Not Applicable', '10th Pass must set Not Applicable');
assert.equal(getSyncedBranchForDegree('10th Pass', 'Commerce'), 'Not Applicable', 'Switching to 10th Pass must set Not Applicable');
// 5. 12th Pass defaults to Not Applicable but preserves valid stream
assert.equal(getSyncedBranchForDegree('12th Pass', ''), 'Not Applicable', '12th Pass defaults to Not Applicable');
assert.equal(getSyncedBranchForDegree('12th Pass', 'Commerce'), 'Commerce', '12th Pass preserves Commerce');
assert.equal(getSyncedBranchForDegree('12th Pass', 'Mechanical Engineering'), 'Not Applicable', '12th Pass resets invalid branch to Not Applicable');
// 6. Empty degree returns empty string
assert.equal(getSyncedBranchForDegree('', 'Commerce'), '', 'Empty degree resets branch to empty');

console.log('student-register-wizard.test.mjs: OK');
