/**
 * Unit tests for src/lib/jobItMatch.js
 * Run with: node tests/job-it-match.test.mjs
 */

import { isItRelatedJob } from '../src/lib/jobItMatch.js';

let pass = 0;
let fail = 0;

const ok = (cond, label) => {
  if (cond) {
    pass += 1;
    console.log(`  OK    ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}`);
  }
};

const job = (overrides = {}) => ({
  title: 'Role',
  category: 'General',
  skills: '',
  shortDescription: '',
  description: '',
  ...overrides,
});

console.log('\nisItRelatedJob');
ok(isItRelatedJob(job({ title: 'Java Developer', category: 'IT & Software' })), 'canonical IT category');
ok(isItRelatedJob(job({ title: 'React Developer', category: 'IT' })), 'short IT category');
ok(isItRelatedJob(job({ title: 'Python Developer', category: 'General', skills: 'django' })), 'developer title');
ok(!isItRelatedJob(job({ title: 'Hotel Front Office Executive', category: 'Hospitality & Retail' })), 'hospitality');
ok(
  !isItRelatedJob(job({ title: 'Digital Marketing Executive', category: 'Sales & Marketing', skills: 'seo' })),
  'digital marketing is not IT via substring git',
);
ok(!isItRelatedJob(job({ title: 'Staff Nurse', category: 'Healthcare', shortDescription: 'Hospital duty' })), 'nurse');
ok(!isItRelatedJob(job({ title: 'HR Executive', category: 'HR & Admin', shortDescription: 'Recruitment' })), 'HR');
ok(!isItRelatedJob(job({ title: 'Waiter', category: 'Hospitality' })), 'waiter');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
