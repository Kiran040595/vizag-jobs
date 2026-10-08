import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateJobEligibility, normalizeCandidateDetails, normalizeJobRequirements } from '../src/lib/candidateEligibility.js';
import { rankJobsForStudent } from '../src/lib/studentJobMatch.js';
import { mapStudentProfileRow } from '../src/lib/adminStudentProfile.js';
import { STUDENT_EXPORT_COLUMNS } from '../src/lib/studentExport.js';
import { validateStudentProfilePayload } from '../src/lib/studentProfileValidation.js';

const student = { degree: 'Diploma', branch: 'Mechanical Engineering', education_status: 'completed', current_city: 'Visakhapatnam', current_area: 'Gajuwaka', willing_to_relocate: false, skills: ['autocad'], is_fresher: true, primary_target_role: 'Mechanical Technician', interested_roles: ['QA Inspector'], preferred_locations: ['Vizag'] };
const job = { id: 'mechanical', title: 'Mechanical Technician', role: 'Mechanical Technician', requirements_verified: true, accepted_degrees: ['Diploma'], accepted_branches: ['Mechanical Engineering'], required_education_status: 'completed', required_skills: ['AutoCAD'], required_experience: 'fresher', required_candidate_locations: ['Vizag'] };

test('mandatory requirements combine with AND; accepted alternatives combine with OR', () => {
  assert.equal(evaluateJobEligibility(job, student).status, 'eligible');
  assert.equal(evaluateJobEligibility(job, { ...student, degree: 'B.Tech' }).status, 'ineligible');
  assert.equal(evaluateJobEligibility({ ...job, accepted_degrees: ['Diploma', 'B.Tech'] }, { ...student, degree: 'B.Tech' }).status, 'eligible');
  for (const patch of [{ branch: 'Civil Engineering' }, { education_status: 'studying' }, { skills: ['java'] }, { is_fresher: false }]) assert.equal(evaluateJobEligibility(job, { ...student, ...patch }).status, 'ineligible');
});
test('missing facts stay unknown and legacy jobs stay unverified', () => {
  assert.equal(evaluateJobEligibility(job, {}).status, 'needs_information');
  assert.equal(evaluateJobEligibility({}, student).status, 'unverified');
  assert.equal(evaluateJobEligibility({ requirements_verified: true }, {}).status, 'eligible');
  assert.equal(evaluateJobEligibility(job, { ...student, education_status: null }).status, 'needs_information');
});
test('current residence, locality, and relocation are distinct from preferred job locations', () => {
  assert.equal(evaluateJobEligibility({ ...job, required_candidate_locations: ['Gajuwaka'] }, student).status, 'eligible');
  const away = { ...student, current_city: 'Hyderabad', current_area: '', preferred_locations: ['Vizag'], willing_to_relocate: true };
  assert.equal(evaluateJobEligibility(job, away).status, 'ineligible');
  assert.equal(evaluateJobEligibility({ ...job, accepts_relocation: true }, away).status, 'eligible');
  assert.equal(evaluateJobEligibility({ ...job, accepts_relocation: true }, { ...away, willing_to_relocate: null }).status, 'needs_information');
  assert.equal(evaluateJobEligibility({ ...job, required_candidate_locations: ['Viz'] }, student).status, 'ineligible');
});
test('recommendations omit known ineligible jobs but retain unknown eligibility', () => {
  const bad = { ...job, id: 'bad', accepted_degrees: ['B.Tech'] };
  const unknown = { ...job, id: 'unknown', required_education_status: 'studying' };
  const ranked = rankJobsForStudent([bad, unknown, job], { ...student, education_status: null });
  assert.deepEqual(new Set(ranked.map(r => r.job.id)), new Set(['unknown', 'mechanical']));
  assert.ok(ranked.every(r => r.eligibility.status === 'needs_information'));
  assert.equal(rankJobsForStudent([{ title: 'QA Inspector', role: 'QA Inspector' }], student)[0].job.title, 'QA Inspector');
});
test('mapped admin candidates use the same eligibility evaluator', () => {
  const mapped = mapStudentProfileRow({ ...student, user_id: 'student-1' });
  assert.equal(evaluateJobEligibility(job, mapped).status, 'eligible');
  assert.equal(rankJobsForStudent([job], mapped)[0].eligibility.status, 'eligible');
});
test('gender never changes eligibility and is not exported', () => {
  assert.deepEqual(evaluateJobEligibility(job, { ...student, gender: 'female' }), evaluateJobEligibility(job, { ...student, gender: 'male' }));
  assert.ok(!STUDENT_EXPORT_COLUMNS.some(c => /gender/i.test(c.id)));
});
test('candidate and requirement normalization rejects invalid values and preserves tri-state relocation', () => {
  assert.equal(normalizeCandidateDetails().willing_to_relocate, null);
  assert.equal(normalizeCandidateDetails({ willing_to_relocate: false }).willing_to_relocate, false);
  assert.deepEqual(normalizeCandidateDetails({ interested_roles: 'Developer\nTester\nDeveloper' }).interested_roles, ['Developer', 'Tester']);
  assert.throws(() => normalizeCandidateDetails({ willing_to_relocate: 'false' }));
  assert.throws(() => normalizeCandidateDetails({ gender: 'invalid' }));
  assert.throws(() => normalizeCandidateDetails({ education_status: 'unknown' }));
  assert.throws(() => normalizeJobRequirements({ accepted_degrees: ['Invalid'] }));
  assert.throws(() => normalizeJobRequirements({ required_experience: 'senior' }));
});
test('registration saves new columns; blank certifications and legacy missing fields stay valid', () => {
  const full = { ...student, full_name: 'Test Candidate', college: 'Test Institute', graduation_year: 2026, phone: '9876543210', certifications: '', target_job_categories: ['mechanical_production'], role_experience_level: 'fresher', availability: 'immediate' };
  const validated = validateStudentProfilePayload(full);
  assert.equal(validated.current_city, 'Visakhapatnam');
  assert.equal(validated.education_status, 'completed');
  assert.deepEqual(validated.certifications, []);
  const { current_city, education_status, willing_to_relocate, interested_roles, ...legacy } = full;
  void current_city; void education_status; void willing_to_relocate; void interested_roles;
  assert.equal(validateStudentProfilePayload(legacy).education_status, null);
});
import { getEmptyJobForm, serializeJobForm, deserializeJobForForm, formatJobsToSqlInsert, parseSqlInsertToRecord } from '../src/services/adminJobs.js';

test('structured job requirements survive editing and SQL export/import', () => {
  const values = { ...getEmptyJobForm(), ...job, slug: 'diploma-job', company: 'Test Company', category: 'Manufacturing', job_type: 'Full Time', required_skills: 'AutoCAD\nCommunication', preferred_skills: 'MS Excel', accepts_relocation: true };
  const serialized = serializeJobForm(values);
  assert.deepEqual(serialized.required_skills, ['autocad', 'communication']);
  assert.deepEqual(serialized.preferred_skills, ['ms excel']);
  assert.equal(serialized.requirements_verified, true);
  const edited = serializeJobForm(deserializeJobForForm(serialized));
  assert.deepEqual(normalizeJobRequirements(edited), normalizeJobRequirements(serialized));
  const imported = serializeJobForm(parseSqlInsertToRecord(formatJobsToSqlInsert(serialized)));
  assert.deepEqual(normalizeJobRequirements(imported), normalizeJobRequirements(serialized));
  assert.equal(getEmptyJobForm().requirements_verified, false);
});

test('legacy SQL export supplies valid non-null defaults for new database columns', () => {
  const parsed = parseSqlInsertToRecord(formatJobsToSqlInsert({ slug: 'old-job', title: 'Old job', company: 'Test', category: 'Other', job_type: 'Full Time' }));
  assert.deepEqual(parsed.accepted_degrees, []);
  assert.deepEqual(parsed.accepted_branches, []);
  assert.deepEqual(parsed.required_skills, []);
  assert.deepEqual(parsed.preferred_skills, []);
  assert.deepEqual(parsed.required_candidate_locations, []);
  assert.equal(parsed.accepts_relocation, false);
  assert.equal(parsed.requirements_verified, false);
});
import { matchesCandidateFilters } from '../src/lib/candidateEligibility.js';

test('admin filters combine current city aliases, locality, education, relocation, and optional gender', () => {
  const candidate = { currentCity: 'Visakhapatnam', currentArea: 'Gajuwaka', educationStatus: 'completed', willingToRelocate: false, gender: 'female' };
  assert.equal(matchesCandidateFilters(candidate, { currentCity: 'Vizag', currentArea: 'gaju', educationStatus: 'completed', willingToRelocate: 'false', gender: 'female' }), true);
  assert.equal(matchesCandidateFilters(candidate, { willingToRelocate: 'true' }), false);
  assert.equal(matchesCandidateFilters({ willingToRelocate: null }, { willingToRelocate: 'false' }), false);
  assert.equal(matchesCandidateFilters(candidate, { educationStatus: 'studying' }), false);
  const visibleGroups = new Set(['Contact', 'Education', 'Career preference', 'Profile']);
  assert.ok(STUDENT_EXPORT_COLUMNS.every(column => visibleGroups.has(column.group)));
});

test('mandatory skills retain C/R and reject invalid input instead of silently dropping restrictions', () => {
  assert.deepEqual(normalizeJobRequirements({ required_skills: 'C\nR' }).required_skills, ['c', 'r']);
  assert.throws(() => normalizeJobRequirements({ required_skills: 'x'.repeat(49) }));
});
