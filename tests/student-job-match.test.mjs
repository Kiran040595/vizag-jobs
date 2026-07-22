import assert from 'node:assert/strict';
import {
  expandLocationTokens,
  mapStudentCategoriesToJobCategories,
  rankJobsForStudent,
  scoreJobForStudent,
} from '../src/lib/studentJobMatch.js';

const profile = {
  skills: ['java', 'react'],
  target_job_categories: ['software_frontend', 'software_backend'],
  primary_target_role: 'Frontend Developer',
  preferred_locations: ['Vizag', 'Remote'],
  is_fresher: true,
};

assert.deepEqual(mapStudentCategoriesToJobCategories(profile.target_job_categories), [
  'IT & Software',
]);

assert.ok(expandLocationTokens(['Vizag']).includes('vizag'));
assert.ok(expandLocationTokens(['Visakhapatnam']).includes('vizag'));

const itJob = {
  id: '1',
  title: 'React Frontend Developer',
  category: 'IT & Software',
  skills: 'React, JavaScript',
  location: 'Visakhapatnam',
  isFresher: 'Yes',
  postedAt: '2026-07-20T10:00:00.000Z',
};

const salesJob = {
  id: '2',
  title: 'Field Sales Executive',
  category: 'Sales & Marketing',
  skills: 'Sales, Communication',
  location: 'Hyderabad',
  isFresher: 'No',
  postedAt: '2026-07-21T10:00:00.000Z',
};

const itScore = scoreJobForStudent(itJob, profile);
assert.ok(itScore.score > 0);
assert.ok(itScore.reasons.includes('Category match'));
assert.ok(itScore.reasons.some((reason) => /skill/i.test(reason)));

const ranked = rankJobsForStudent([salesJob, itJob], profile, 5);
assert.equal(ranked[0].job.id, '1');
assert.ok(ranked[0].score > (ranked[1]?.score || 0));

const noMatch = rankJobsForStudent(
  [
    {
      id: '3',
      title: 'Hotel Receptionist',
      category: 'Hospitality & Retail',
      skills: 'Front office',
      location: 'Mumbai',
      isFresher: 'No',
    },
  ],
  profile,
);
assert.equal(noMatch.length, 0);

console.log('student-job-match.test.mjs: OK');
