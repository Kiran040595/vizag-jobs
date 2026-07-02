/**
 * Unit tests for src/lib/jobCategoryTaxonomy.js
 * Run with: node tests/job-category-taxonomy.test.mjs
 */

import {
  classifyJobRecord,
  inferIsFresherFromJob,
  inferJobCategoryFromSignals,
  jobMatchesCategoryFilter,
  normalizeJobCategory,
} from '../src/lib/jobCategoryTaxonomy.js';

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

console.log('\nnormalizeJobCategory');
ok(normalizeJobCategory('civil engineering') === 'Civil Engineering', 'civil alias');
ok(normalizeJobCategory('IT & Software') === 'IT & Software', 'exact IT');
ok(normalizeJobCategory('random sector') === null, 'unknown returns null');

console.log('\ninferJobCategoryFromSignals');
ok(
  inferJobCategoryFromSignals({ title: 'Civil Site Engineer', category: 'General' }) === 'Civil Engineering',
  'civil from title',
);
ok(
  inferJobCategoryFromSignals({ title: 'Java Developer', skills: 'spring boot' }) === 'IT & Software',
  'IT from title/skills',
);
ok(
  inferJobCategoryFromSignals({ title: 'Telecaller', category: 'General' }) === 'BPO / Customer Support',
  'BPO from title',
);

console.log('\ninferIsFresherFromJob');
ok(inferIsFresherFromJob({ experience: '0-2 years', title: 'Graduate Engineer' }), '0-2 years');
ok(!inferIsFresherFromJob({ experience: '5-8 years', title: 'Senior Engineer' }), 'senior not fresher');
ok(
  inferIsFresherFromJob({
    eligibility: ['B.Tech 2025 passout', 'Fresh graduates welcome'],
    experience: 'Not specified',
  }),
  'eligibility passout',
);

console.log('\nclassifyJobRecord');
{
  const out = classifyJobRecord({
    title: 'Mechanical Maintenance Engineer',
    category: 'Oil and Gas',
    experience: '2-4 years',
  });
  ok(out.category === 'Mechanical Engineering', 'classify mechanical');
  ok(out.is_fresher === false, 'experienced mechanical');
}

console.log('\njobMatchesCategoryFilter');
ok(jobMatchesCategoryFilter({ title: 'Accountant', category: 'Banking & Finance' }, 'banking'), 'banking filter');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
