import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterApplications,
  extractApplicationFilterOptions,
  getQualificationBucket,
  QUALIFICATION_CATEGORIES,
} from '../src/lib/applicationFilters.js';

const mockApplicants = [
  {
    id: 'app-1',
    status: 'applied',
    isStarred: false,
    submittedAt: '2026-10-24T10:00:00Z',
    profileSnapshot: {
      fullName: 'Chidapana Manikanta',
      phone: '9876543210',
      contactEmail: 'manikanta@example.com',
      degree: 'Diploma',
      branch: 'Electrical & Electronics (EEE)',
      college: 'M.R.A.G.R govt polytechnic',
      graduationYear: 2013,
      skills: ['GIS', 'AutoCAD', 'Surveying'],
    },
    resumePath: 'resumes/manikanta.pdf',
    adminNotes: '',
  },
  {
    id: 'app-2',
    status: 'screened',
    isStarred: true,
    submittedAt: '2026-10-24T12:00:00Z',
    profileSnapshot: {
      fullName: 'Lakshmi Priya',
      phone: '9876500001',
      contactEmail: 'lakshmi@example.com',
      degree: 'B.Tech',
      branch: 'Computer Science (CSE)',
      college: 'Andhra University',
      graduationYear: 2024,
      skills: ['Python', 'React', 'SQL'],
    },
    resumePath: 'resumes/lakshmi.pdf',
    adminNotes: 'Referred by admin - top performer in coding round',
  },
  {
    id: 'app-3',
    status: 'applied',
    isStarred: false,
    submittedAt: '2026-10-24T08:00:00Z', // Earliest applicant
    profileSnapshot: {
      fullName: 'Ravi Kumar',
      phone: '9876500002',
      contactEmail: 'ravi@example.com',
      degree: 'B.Sc Computer Science',
      branch: 'Computers',
      college: 'Gayatri Vidya Parishad',
      graduationYear: 2023,
      skills: ['Excel', 'Sales', 'Telecalling'],
    },
    resumePath: '',
    adminNotes: '',
  },
  {
    id: 'app-4',
    status: 'interview_scheduled',
    isStarred: true,
    submittedAt: '2026-10-24T15:00:00Z',
    profileSnapshot: {
      fullName: 'Ananya Sharma',
      phone: '9876500003',
      contactEmail: 'ananya@example.com',
      degree: 'MBA',
      branch: 'Human Resources',
      college: 'GITAM University',
      graduationYear: 2022,
      skills: ['Recruitment', 'Communication', 'HR Operations'],
    },
    resumePath: 'resumes/ananya.pdf',
    adminNotes: 'Strong communication skills',
  },
];

test('getQualificationBucket classifies degrees accurately', () => {
  assert.equal(getQualificationBucket('B.Tech Mechanical'), 'btech');
  assert.equal(getQualificationBucket('Diploma in EEE'), 'diploma');
  assert.equal(getQualificationBucket('Polytechnic Civil'), 'diploma');
  assert.equal(getQualificationBucket('B.Sc Computer Science'), 'degree');
  assert.equal(getQualificationBucket('B.Com Computers'), 'degree');
  assert.equal(getQualificationBucket('BBA'), 'degree');
  assert.equal(getQualificationBucket('MBA HR'), 'pg');
  assert.equal(getQualificationBucket('MCA'), 'pg');
  assert.equal(getQualificationBucket('M.Tech Embedded'), 'pg');
  assert.equal(getQualificationBucket('ITI Electrician'), 'iti');
  assert.equal(getQualificationBucket('Intermediate CEC'), 'intermediate');
});

test('filterApplications searches by candidate name', () => {
  const result = filterApplications(mockApplicants, { search: 'manikanta' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'app-1');
});

test('filterApplications searches by skills', () => {
  const result = filterApplications(mockApplicants, { search: 'GIS' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'app-1');

  const pythonResult = filterApplications(mockApplicants, { skill: 'Python' });
  assert.equal(pythonResult.length, 1);
  assert.equal(pythonResult[0].id, 'app-2');
});

test('filterApplications filters by passout year', () => {
  const result2013 = filterApplications(mockApplicants, { passoutYear: '2013' });
  assert.equal(result2013.length, 1);
  assert.equal(result2013[0].id, 'app-1');

  const result2024 = filterApplications(mockApplicants, { passoutYear: '2024' });
  assert.equal(result2024.length, 1);
  assert.equal(result2024[0].id, 'app-2');
});

test('filterApplications filters by qualification category', () => {
  const diplomaResult = filterApplications(mockApplicants, { qualification: 'diploma' });
  assert.equal(diplomaResult.length, 1);
  assert.equal(diplomaResult[0].id, 'app-1');

  const btechResult = filterApplications(mockApplicants, { qualification: 'btech' });
  assert.equal(btechResult.length, 1);
  assert.equal(btechResult[0].id, 'app-2');

  const degreeResult = filterApplications(mockApplicants, { qualification: 'degree' });
  assert.equal(degreeResult.length, 1);
  assert.equal(degreeResult[0].id, 'app-3');

  const pgResult = filterApplications(mockApplicants, { qualification: 'pg' });
  assert.equal(pgResult.length, 1);
  assert.equal(pgResult[0].id, 'app-4');
});

test('filterApplications filters by starred / referred candidate', () => {
  const starredResult = filterApplications(mockApplicants, { isStarredOnly: true });
  assert.equal(starredResult.length, 2);
  assert.ok(starredResult.some((a) => a.id === 'app-2'));
  assert.ok(starredResult.some((a) => a.id === 'app-4'));
});

test('filterApplications sorts by early register (oldest first)', () => {
  const sorted = filterApplications(mockApplicants, { sortBy: 'oldest' });
  // app-3 was submitted at 08:00, app-1 at 10:00, app-2 at 12:00, app-4 at 15:00
  assert.equal(sorted[0].id, 'app-3');
  assert.equal(sorted[1].id, 'app-1');
  assert.equal(sorted[2].id, 'app-2');
  assert.equal(sorted[3].id, 'app-4');
});

test('filterApplications sorts by starred first', () => {
  const sorted = filterApplications(mockApplicants, { sortBy: 'starred_first' });
  assert.ok(sorted[0].isStarred);
  assert.ok(sorted[1].isStarred);
  assert.ok(!sorted[2].isStarred);
  assert.ok(!sorted[3].isStarred);
});

test('extractApplicationFilterOptions extracts facets and counts', () => {
  const facets = extractApplicationFilterOptions(mockApplicants);
  assert.equal(facets.totalCount, 4);
  assert.equal(facets.starredCount, 2);
  assert.equal(facets.withResumeCount, 3);
  assert.equal(facets.withPhoneCount, 4);
  assert.deepEqual(facets.availableYears, ['2024', '2023', '2022', '2013']);
  assert.ok(facets.topSkills.length > 0);
  assert.ok(facets.topSkills.some((s) => s.label.toLowerCase() === 'gis'));
});
