import assert from 'node:assert/strict';
import {
  compareNaukriJobsByExperience,
  naukriExperienceTier,
  prioritizeNaukriJobsByExperience,
} from '../src/lib/naukriExperienceSort.js';

const job = (experience, title = 'Role', posted_at = null) => ({
  experience,
  title,
  posted_at,
});

console.log('naukriExperienceTier');
assert.equal(naukriExperienceTier('Fresher'), 0);
assert.equal(naukriExperienceTier('0-2 years'), 0);
assert.equal(naukriExperienceTier('0 to 1 years'), 0);
assert.equal(naukriExperienceTier('1-3 years'), 1);
assert.equal(naukriExperienceTier('2-5 years'), 1);
assert.equal(naukriExperienceTier('3-5 years'), 2);
assert.equal(naukriExperienceTier('8-12 years'), 3);
assert.equal(naukriExperienceTier('Not specified'), 4);
assert.equal(naukriExperienceTier('Not specified', 'Java Fresher Developer'), 0);

console.log('compareNaukriJobsByExperience');
const mixed = [
  job('5-8 years', 'Senior Dev', '2026-01-01T00:00:00.000Z'),
  job('0-1 years', 'Junior Dev', '2026-01-02T00:00:00.000Z'),
  job('Fresher', 'Trainee', '2026-01-03T00:00:00.000Z'),
  job('3-5 years', 'Mid Dev', '2026-01-04T00:00:00.000Z'),
];
const sorted = [...mixed].sort(compareNaukriJobsByExperience);
assert.deepEqual(
  sorted.map((j) => j.experience),
  ['Fresher', '0-1 years', '3-5 years', '5-8 years'],
  'fresher-first sort order (newer first within tier)',
);

console.log('prioritizeNaukriJobsByExperience — 75% fresher quota');
const pool = [
  job('10 years', 'Lead'),
  job('8 years', 'Architect'),
  job('5 years', 'Senior'),
  job('3 years', 'Mid'),
  job('1 year', 'Junior'),
  job('0 Years', 'Fresher A'),
  job('Fresher', 'Fresher B'),
  job('0-2 years', 'Fresher C'),
  job('2-4 years', 'Associate'),
  job('6 years', 'Staff'),
  job('0-1 years', 'Fresher D'),
  job('7 years', 'Principal'),
];
const capped = prioritizeNaukriJobsByExperience(pool, { maxJobs: 8, fresherRatio: 0.75 });
assert.equal(capped.length, 8);
const fresherCount = capped.filter((j) => naukriExperienceTier(j.experience, j.title) <= 1).length;
assert.equal(fresherCount, 6, '75% of 8 slots reserved for fresher/entry when available');
assert.equal(naukriExperienceTier(capped[0].experience, capped[0].title), 0, 'freshest job is first');
assert.ok(
  !capped.some((j) => j.experience === '10 years'),
  'senior roles trimmed when fresher pool fills quota',
);

console.log('prioritizeNaukriJobsByExperience — backfill when few freshers');
const thinPool = [
  job('5 years', 'Senior'),
  job('8 years', 'Lead'),
  job('0 Years', 'Only Fresher'),
];
const thin = prioritizeNaukriJobsByExperience(thinPool, { maxJobs: 3, fresherRatio: 0.75 });
assert.equal(thin.length, 3);
assert.equal(thin[0].experience, '0 Years');

console.log('naukri-experience-sort.test.mjs: OK');
