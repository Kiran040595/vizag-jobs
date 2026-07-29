import assert from 'node:assert/strict';
import {
  expandLocationTokens,
  rankJobsForStudent,
  scoreJobForStudent,
} from '../src/lib/studentJobMatch.js';
import {
  buildLiveRoleOptions,
  resolveTargetJobCategoryToken,
  slugifyRoleText,
} from '../src/lib/studentCareerPreferences.js';

const profile = {
  skills: ['java', 'react'],
  target_job_categories: ['react_frontend_developer', 'java_backend_developer'],
  primary_target_role: 'React Frontend Developer',
  preferred_locations: ['Vizag', 'Remote'],
  is_fresher: true,
};

assert.equal(slugifyRoleText('React Frontend Developer'), 'react_frontend_developer');
assert.ok(expandLocationTokens(['Vizag']).includes('vizag'));
assert.ok(expandLocationTokens(['Visakhapatnam']).includes('vizag'));

const itJob = {
  id: '1',
  title: 'React Frontend Developer',
  role: 'React Frontend Developer',
  category: 'IT & Software',
  skills: 'React, JavaScript',
  location: 'Visakhapatnam',
  isFresher: 'Yes',
  postedAt: '2026-07-20T10:00:00.000Z',
};

const salesJob = {
  id: '2',
  title: 'Field Sales Executive',
  role: 'Field Sales Executive',
  category: 'Sales & Marketing',
  skills: 'Sales, Communication',
  location: 'Hyderabad',
  isFresher: 'No',
  postedAt: '2026-07-21T10:00:00.000Z',
};

const itScore = scoreJobForStudent(itJob, profile);
assert.ok(itScore.score > 0);
assert.ok(itScore.reasons.includes('Primary role match'));
assert.ok(itScore.reasons.some((reason) => /skill/i.test(reason)));

const ranked = rankJobsForStudent([salesJob, itJob], profile, 5);
assert.equal(ranked[0].job.id, '1');
assert.ok(ranked[0].score > (ranked[1]?.score || 0));

const secondaryOnly = scoreJobForStudent(
  {
    id: '4',
    title: 'Java Developer',
    role: 'Java Backend Developer',
    category: 'IT & Software',
    skills: 'Java',
    location: 'Vizag',
    isFresher: 'Yes',
  },
  {
    ...profile,
    primary_target_role: 'Something Else',
    target_job_categories: ['java_backend_developer'],
  },
);
assert.ok(secondaryOnly.reasons.includes('Target role match'));

const titleFallback = scoreJobForStudent(
  {
    id: '5',
    title: 'Senior React Frontend Engineer',
    role: '',
    category: 'IT & Software',
    skills: 'React',
    location: 'Vizag',
    isFresher: 'Yes',
  },
  {
    skills: ['react'],
    target_job_categories: [],
    primary_target_role: 'React Frontend',
    preferred_locations: ['Vizag'],
    is_fresher: true,
  },
);
assert.ok(titleFallback.reasons.includes('Role match') || titleFallback.score > 0);

const noMatch = rankJobsForStudent(
  [
    {
      id: '3',
      title: 'Hotel Receptionist',
      role: 'Hotel Receptionist',
      category: 'Hospitality & Retail',
      skills: 'Front office',
      location: 'Mumbai',
      isFresher: 'No',
    },
  ],
  profile,
);
assert.equal(noMatch.length, 0);

const liveOptions = buildLiveRoleOptions(
  [
    { role: 'Java Developer', usageCount: 5 },
    { role: 'Telecaller', usageCount: 3 },
    { role: 'Java Developer', usageCount: 1 },
  ],
  10,
);
assert.equal(liveOptions.length, 2);
assert.equal(liveOptions[0].value, 'java_developer');
assert.equal(
  resolveTargetJobCategoryToken('Java Developer', liveOptions),
  'java_developer',
);
assert.equal(
  resolveTargetJobCategoryToken('Custom Hotel Role', liveOptions),
  'custom_hotel_role',
);

console.log('student-job-match.test.mjs: OK');
