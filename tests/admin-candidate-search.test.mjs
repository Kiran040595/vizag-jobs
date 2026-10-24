import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_CANDIDATE_FILTERS,
  TALENT_POOL_OPTIONS,
  candidateMatchesExperience,
  candidateMatchesSearch,
  candidateMatchesTalentPool,
  candidateMissingFacts,
  candidateSkillKey,
  findAdminCandidates,
  formatCandidateListForEmployer,
  readCandidateFilters,
  writeCandidateFilters,
} from '../src/lib/adminCandidateSearch.js';
import { mapStudentProfileRow } from '../src/lib/adminStudentProfile.js';
import { validateStudentProfilePayload } from '../src/lib/studentProfileValidation.js';
import { EMPLOYER_EXPORT_COLUMN_IDS, buildStudentExportRows } from '../src/lib/studentExport.js';

const row = (id, overrides = {}) => mapStudentProfileRow({
  user_id: id, full_name: `Candidate ${id}`, college: 'Test Institute', degree: 'B.Tech',
  branch: 'Computer Science (CSE)', graduation_year: 2026, skills: ['React.js', 'SQL'],
  primary_target_role: 'Frontend Developer', interested_roles: ['Java Backend Developer'],
  role_experience_level: '1_2_years', is_fresher: false, is_active: true,
  current_city: 'Visakhapatnam', current_area: 'Gajuwaka', education_status: 'completed',
  availability: 'immediate', willing_to_relocate: false, preferred_locations: ['Vizag'],
  created_at: '2026-10-20T00:00:00Z', ...overrides,
});
const filters = overrides => ({ ...EMPTY_CANDIDATE_FILTERS, skills: [], degrees: [], ...overrides });
const students = [
  row('react-sql'), row('react', { degree: 'B.E', skills: ['react'], primary_target_role: 'React Developer' }),
  row('java', { degree: 'MCA', skills: ['java', 'sql'], primary_target_role: 'Java Developer' }),
  row('inactive', { is_active: false }),
  row('missing', { skills: [], primary_target_role: '', interested_roles: [], current_city: '', education_status: '', availability: '', is_fresher: null, role_experience_level: null }),
];
const ids = result => result.entries.map(entry => entry.student.userId);

test('combine all skills, alternative qualifications, partial secondary role and current residence', () => {
  const result = findAdminCandidates(students, filters({ skills: ['react', 'sql'], degrees: ['BTech', 'B.E'], roleQuery: 'backend', city: 'Vizag' }));
  assert.deepEqual(ids(result), ['react-sql']);
  assert.ok(result.entries[0].reasons.includes('Skill: React'));
  assert.ok(result.entries[0].reasons.some(reason => reason.includes('Java Backend Developer')));
  assert.ok(result.entries[0].reasons.includes('Qualification: B.Tech'));
});

test('ANY skills differs from ALL and preserves stable deterministic ordering', () => {
  const result = findAdminCandidates(students, filters({ skills: ['react', 'sql'], skillMode: 'any' }));
  assert.equal(result.entries.length, 3);
  assert.equal(result.entries[0].student.userId, 'react-sql');
  assert.deepEqual(ids(findAdminCandidates(students, filters({ skills: ['react', 'sql'] }))), ['react-sql']);
});

test('C, C++, C#, Java and JavaScript are not interchangeable required skills', () => {
  const examples = [row('c', { skills: ['c'] }), row('cpp', { skills: ['c++'] }), row('csharp', { skills: ['c#'] }), row('java', { skills: ['java'] }), row('js', { skills: ['javascript'] })];
  for (const [skill, expected] of [['C', 'c'], ['C++', 'cpp'], ['C#', 'csharp'], ['Java', 'java'], ['JS', 'js']]) assert.deepEqual(ids(findAdminCandidates(examples, filters({ skills: [skill] }))), [expected]);
  assert.equal(candidateSkillKey('Node.js'), 'nodejs');
});

test('search words match across fields; role search does not borrow from unrelated qualifications or skills', () => {
  assert.equal(candidateMatchesSearch(students[0], 'react BTech Vizag'), true);
  assert.equal(candidateMatchesSearch(students[0], 'React "Computer Science"'), true);
  assert.equal(candidateMatchesSearch(students[0], 'react MBA'), false);
  assert.equal(findAdminCandidates(students, filters({ roleQuery: 'Accountant' })).entries.length, 0);
});

test('desired role words must describe one recorded role, not a mixture of different roles', () => {
  const separate = row('different-roles', { primary_target_role: 'Java Frontend Developer', interested_roles: ['Python Backend Developer'] });
  assert.equal(findAdminCandidates([separate], filters({ roleQuery: 'Java Backend' })).entries.length, 0);
  assert.equal(findAdminCandidates([separate], filters({ roleQuery: 'Python Backend' })).entries.length, 1);
  assert.equal(findAdminCandidates([separate], filters({ role: 'Java Frontend Developer', roleQuery: 'Backend' })).entries.length, 0);
});

test('manual skills and reviewed-job requirements agree on explicit skill aliases', () => {
  const candidate = row('aliases', { skills: ['React.js', 'Node.js', 'JS'] });
  const reviewed = { id: 'alias-job', requirements_verified: true, required_skills: ['react', 'nodejs', 'javascript'] };
  const result = findAdminCandidates([candidate], filters({ skills: ['react', 'nodejs', 'javascript'], job: 'alias-job' }), reviewed);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].eligibility.status, 'eligible');
});

test('experience buckets match the values registration actually saves and unknown is not experienced', () => {
  for (const value of ['0_6_months', '6_12_months', '1_2_years', '2_4_years', '4_plus_years']) assert.equal(candidateMatchesExperience(row('exp', { role_experience_level: value }), value), true);
  assert.equal(candidateMatchesExperience(students[4], 'experienced'), false);
  assert.equal(candidateMatchesExperience(students[4], 'fresher'), false);
  assert.equal(findAdminCandidates(students, filters({ experience: '1_2_years' })).entries.length, 3);
});

test('missing facts are explicit; preferred location never establishes current residence or joining time', () => {
  assert.ok(candidateMissingFacts(students[4]).includes('Desired role'));
  assert.ok(candidateMissingFacts(students[4]).includes('Experience'));
  assert.equal(findAdminCandidates([students[4]], filters({ availability: 'immediate' })).entries.length, 0);
  const away = row('away', { current_city: 'Hyderabad', preferred_locations: ['Vizag'] });
  assert.equal(findAdminCandidates([away], filters({ city: 'Vizag' })).entries.length, 0);
  assert.equal(findAdminCandidates([away], filters({ preferredLocation: 'Vizag' })).entries.length, 1);
  assert.equal(candidateMatchesSearch(students[0], '2026'), true);
  assert.deepEqual(ids(findAdminCandidates(students, filters({ dataStatus: 'missing' }))), ['missing']);
  assert.deepEqual(ids(findAdminCandidates(students, filters({ dataStatus: 'missing_skills' }))), ['missing']);
  assert.deepEqual(ids(findAdminCandidates(students, filters({ dataStatus: 'missing_qualification' }))), []);
});

test('job checks separate missing evidence from known requirement failures', () => {
  const job = { id: 'job', requirements_verified: true, accepted_degrees: ['B.Tech'], required_skills: ['sql'], required_education_status: 'completed' };
  const examples = [row('yes'), row('unknown', { education_status: null }), row('no', { degree: 'B.Com' })];
  const result = findAdminCandidates(examples, filters({ job: 'job' }), job);
  assert.deepEqual(ids(result), ['yes']);
  assert.deepEqual(result.jobCounts, { eligible: 1, needs_information: 1, ineligible: 1, unverified: 0 });
  assert.deepEqual(ids(findAdminCandidates(examples, filters({ job: 'job', jobStatus: 'needs_information' }), job)), ['unknown']);
  assert.equal(findAdminCandidates(examples, filters({ job: 'unloaded' })).entries.length, 0);
});

test('demographic fields do not affect inclusion, match explanation, or sorting', () => {
  const base = row('person');
  const settings = filters({ skills: ['react'], degrees: ['B.Tech'] });
  const one = findAdminCandidates([{ ...base, gender: 'female' }], settings).entries[0];
  const two = findAdminCandidates([{ ...base, gender: 'male' }], settings).entries[0];
  assert.equal(one.score, two.score);
  assert.deepEqual(one.reasons, two.reasons);
});

test('URL criteria round trip, support old links, and normalize malformed settings', () => {
  const input = filters({ skills: ['react', 'sql'], degrees: ['B.Tech', 'B.E'], city: 'Vizag', experience: '2_4_years', accountStatus: 'all', jobStatus: 'needs_information' });
  assert.deepEqual(readCandidateFilters(writeCandidateFilters(input)), input);
  const legacy = readCandidateFilters(new URLSearchParams('skill=react&degree=B.Tech&batch=2026&exp=1_2_years&q=developer'));
  assert.deepEqual(legacy.skills, ['react']);
  assert.deepEqual(legacy.degrees, ['B.Tech']);
  assert.equal(legacy.experience, '1_2_years');
  assert.equal(readCandidateFilters(new URLSearchParams('skillMode=broken&accountStatus=broken')).skillMode, 'all');
});

test('exports use exactly the matching candidate list, including secondary-role matches', () => {
  const result = findAdminCandidates(students, filters({ degrees: ['BTech', 'BE'], roleQuery: 'backend' }));
  const exported = buildStudentExportRows(result.entries.map(entry => entry.student), ['fullName']);
  assert.equal(exported.rows.length, 2);
});

test('new registrations require recruiting facts while legacy profile edits remain valid', () => {
  const profile = { full_name: 'Test Candidate', college: 'Test Institute', degree: 'B.Tech', branch: 'Computer Science (CSE)', graduation_year: 2026, phone: '9000000000', skills: ['react'], is_fresher: true, target_job_categories: ['software_frontend'], primary_target_role: 'Frontend Developer', role_experience_level: 'fresher', availability: 'immediate', preferred_locations: ['Vizag'] };
  assert.doesNotThrow(() => validateStudentProfilePayload(profile));
  assert.throws(() => validateStudentProfilePayload(profile, { requireMatchingDetails: true }), /current city/);
  assert.throws(() => validateStudentProfilePayload({ ...profile, current_city: 'Vizag' }, { requireMatchingDetails: true }), /currently studying/);
  assert.equal(validateStudentProfilePayload({ ...profile, current_city: 'Vizag', education_status: 'completed' }, { requireMatchingDetails: true }).education_status, 'completed');
});

test('search query matches fresher keyword and batch year; preferredLocation filters candidate work preferences', () => {
  const fresherCandidate = row('fresher-batch', { is_fresher: true, role_experience_level: null, graduation_year: 2025, preferred_locations: ['Visakhapatnam'] });
  assert.equal(candidateMatchesSearch(fresherCandidate, 'fresher'), true);
  assert.equal(candidateMatchesSearch(fresherCandidate, '2025'), true);
  assert.equal(candidateMatchesSearch(fresherCandidate, 'batch 2025'), true);
  const result = findAdminCandidates([fresherCandidate], filters({ preferredLocation: 'Visakhapatnam' }));
  assert.equal(result.entries.length, 1);
  assert.ok(result.entries[0].reasons.some(r => r.includes('Preferred work location')));
});

test('college filtering matches specific institution or university accurately', () => {
  const gitam = row('gitam', { college: 'GITAM University' });
  const au = row('au', { college: 'Andhra University' });
  const anits = row('anits', { college: 'ANITS' });
  const pool = [gitam, au, anits];

  const gitamResult = findAdminCandidates(pool, filters({ college: 'GITAM' }));
  assert.deepEqual(ids(gitamResult), ['gitam']);
  assert.ok(gitamResult.entries[0].reasons.some(r => r.includes('College: GITAM University')));

  const auResult = findAdminCandidates(pool, filters({ college: 'Andhra University' }));
  assert.deepEqual(ids(auResult), ['au']);
});

test('resume filter separates candidates with and without attached resume CV', () => {
  const withResume = row('with-cv', { resume_path: 'user-1/resume.pdf' });
  const withoutResume = row('no-cv', { resume_path: null });
  const pool = [withResume, withoutResume];

  assert.equal(withResume.hasResume, true);
  assert.equal(withoutResume.hasResume, false);

  const yesResult = findAdminCandidates(pool, filters({ hasResume: 'yes' }));
  assert.deepEqual(ids(yesResult), ['with-cv']);
  assert.ok(yesResult.entries[0].reasons.some(r => r.includes('Resume attached')));

  const noResult = findAdminCandidates(pool, filters({ hasResume: 'no' }));
  assert.deepEqual(ids(noResult), ['no-cv']);

  const allResult = findAdminCandidates(pool, filters({ hasResume: 'all' }));
  assert.equal(allResult.entries.length, 2);
});

test('formatCandidateListForEmployer generates professional text summary for company sharing', () => {
  const cand = row('shareable', {
    full_name: 'Sai Krishna',
    phone: '9876543210',
    primary_target_role: 'Full Stack Developer',
    degree: 'B.Tech',
    branch: 'Computer Science (CSE)',
    graduation_year: 2026,
    college: 'GITAM University',
    skills: ['react', 'nodejs', 'sql'],
    resume_path: 'sai/resume.pdf',
    current_city: 'Visakhapatnam',
  });

  const formatted = formatCandidateListForEmployer([cand], 'React Candidates for Acme Corp');
  assert.ok(formatted.includes('React Candidates for Acme Corp'));
  assert.ok(formatted.includes('Sai Krishna'));
  assert.ok(formatted.includes('Full Stack Developer'));
  assert.ok(formatted.includes('B.Tech · Computer Science (CSE) · Batch 2026'));
  assert.ok(formatted.includes('GITAM University'));
  assert.ok(formatted.includes('React, Node.js, SQL'));
  assert.ok(formatted.includes('📄 Resume: Available'));
  assert.ok(formatted.includes('https://wa.me/919876543210'));
});

test('EMPLOYER_EXPORT_COLUMN_IDS provides company-ready fields and excludes admin-only columns', () => {
  assert.ok(EMPLOYER_EXPORT_COLUMN_IDS.includes('fullName'));
  assert.ok(EMPLOYER_EXPORT_COLUMN_IDS.includes('phone'));
  assert.ok(EMPLOYER_EXPORT_COLUMN_IDS.includes('whatsappLink'));
  assert.ok(EMPLOYER_EXPORT_COLUMN_IDS.includes('primaryTargetRole'));
  assert.ok(EMPLOYER_EXPORT_COLUMN_IDS.includes('degree'));
  assert.ok(EMPLOYER_EXPORT_COLUMN_IDS.includes('college'));
  assert.ok(EMPLOYER_EXPORT_COLUMN_IDS.includes('resume'));
  assert.ok(!EMPLOYER_EXPORT_COLUMN_IDS.includes('userId'));
  assert.ok(!EMPLOYER_EXPORT_COLUMN_IDS.includes('isActive'));
});

test('candidateMatchesTalentPool correctly matches delivery, telecaller and teacher pools', () => {
  const deliveryBoy = row('delivery-1', {
    primary_target_role: 'Delivery Boy / Delivery Executive',
    target_job_categories: ['delivery_logistics'],
    skills: ['two wheeler riding', 'driving license'],
  });
  const telecaller = row('telecaller-1', {
    primary_target_role: 'Telecaller / BPO Executive',
    target_job_categories: ['telecaller_bpo'],
    skills: ['telugu fluency', 'voice process'],
  });
  const teacher = row('teacher-1', {
    primary_target_role: 'School Teacher',
    target_job_categories: ['teaching_education'],
    skills: ['classroom management'],
  });
  const softwareDev = row('dev-1', {
    primary_target_role: 'React Developer',
    target_job_categories: ['software_frontend'],
    skills: ['react', 'sql'],
  });

  // Delivery
  assert.equal(candidateMatchesTalentPool(deliveryBoy, 'delivery'), true);
  assert.equal(candidateMatchesTalentPool(telecaller, 'delivery'), false);
  assert.equal(candidateMatchesTalentPool(softwareDev, 'delivery'), false);

  // Telecaller
  assert.equal(candidateMatchesTalentPool(telecaller, 'telecaller'), true);
  assert.equal(candidateMatchesTalentPool(deliveryBoy, 'telecaller'), false);
  assert.equal(candidateMatchesTalentPool(softwareDev, 'telecaller'), false);

  // Teacher
  assert.equal(candidateMatchesTalentPool(teacher, 'teacher'), true);
  assert.equal(candidateMatchesTalentPool(deliveryBoy, 'teacher'), false);

  // Empty or invalid pool matches all
  assert.equal(candidateMatchesTalentPool(softwareDev, ''), true);
  assert.equal(candidateMatchesTalentPool(softwareDev, null), true);
});

test('findAdminCandidates with talentPool isolates candidates and explains reasons', () => {
  const deliveryBoy = row('rider-1', {
    primary_target_role: 'Bike Delivery Partner',
    skills: ['driving license', 'route navigation'],
  });
  const coder = row('coder-1', {
    primary_target_role: 'Java Developer',
    skills: ['java', 'spring'],
  });

  const poolResult = findAdminCandidates([deliveryBoy, coder], filters({ talentPool: 'delivery' }));
  assert.equal(poolResult.entries.length, 1);
  assert.equal(poolResult.entries[0].student.userId, 'rider-1');
  assert.ok(poolResult.entries[0].reasons.some((r) => r.includes('Talent Pool: 🛵 Delivery Boys & Executives')));
});

test('formatCandidateListForEmployer includes vehicle & license line when delivery assets present', () => {
  const deliveryCand = row('rider-detail', {
    full_name: 'Kamesh V',
    phone: '9988776655',
    primary_target_role: 'Delivery Boy / Delivery Executive',
    skills: ['two wheeler riding', 'driving license', 'food delivery'],
    current_city: 'Visakhapatnam',
    current_area: 'NAD Junction',
  });

  const formatted = formatCandidateListForEmployer([deliveryCand], 'Delivery Boys for Swiggy');
  assert.ok(formatted.includes('Vehicle & License:'));
  assert.ok(formatted.includes('🛵 Has Two-Wheeler / Bike'));
  assert.ok(formatted.includes('🪪 Has Driving License'));
  assert.ok(formatted.includes('Kamesh V'));
  assert.ok(formatted.includes('NAD Junction'));
});
