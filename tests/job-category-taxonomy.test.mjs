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
ok(normalizeJobCategory('IT') === 'IT & Software', 'short IT label');
ok(normalizeJobCategory('hr') === 'HR & Admin', 'HR id/alias');
ok(normalizeJobCategory('Hospitality') === 'Hospitality & Retail', 'hospitality alias');
ok(normalizeJobCategory('Waiter') === null, 'waiter is not IT via substring "it"');
ok(normalizeJobCategory('credit') === null, 'credit is not IT via substring "it"');
ok(normalizeJobCategory('necessary') === null, 'necessary is not ECE via substring "ece"');
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
ok(jobMatchesCategoryFilter({ title: 'Java Developer', category: 'IT & Software' }, 'it'), 'IT canonical category');
ok(jobMatchesCategoryFilter({ title: 'React Developer', category: 'IT' }, 'it'), 'IT short category label');
ok(
  !jobMatchesCategoryFilter(
    { title: 'Hotel Front Office Executive', category: 'Hospitality & Retail', shortDescription: 'Great opportunity' },
    'it',
  ),
  'hospitality job is not IT',
);
ok(
  !jobMatchesCategoryFilter(
    { title: 'Staff Nurse', category: 'Healthcare', shortDescription: 'Hospital duty' },
    'it',
  ),
  'nurse is not IT via "hospital" containing "it"',
);
ok(
  !jobMatchesCategoryFilter({ title: 'HR Executive', category: 'HR & Admin', shortDescription: 'Recruitment' }, 'it'),
  'HR job is not IT via "recruitment" containing "it"',
);
ok(
  !jobMatchesCategoryFilter(
    { title: 'Digital Marketing Executive', category: 'Sales & Marketing', skills: 'seo, ads' },
    'it',
  ),
  'digital marketing is not IT',
);
ok(
  jobMatchesCategoryFilter({ title: 'Python Developer', category: 'General', skills: 'django' }, 'it'),
  'uncategorized developer still matches IT',
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
