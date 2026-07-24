/**
 * Unit tests for src/lib/jobCategoryTaxonomy.js
 * Run with: node tests/job-category-taxonomy.test.mjs
 */

import {
  classifyJobRecord,
  containsToken,
  hasEceRoleEvidence,
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

console.log('\ncontainsToken');
ok(containsToken('ece graduate', 'ece'), 'whole-word ece');
ok(!containsToken('recently posted', 'ece'), 'ece not inside recently');
ok(!containsToken('necessary skills', 'ece'), 'ece not inside necessary');
ok(!containsToken('hotel reception', 'ece'), 'ece not inside reception');
ok(containsToken('electronics engineer', 'electronics engineer'), 'phrase match');

console.log('\nnormalizeJobCategory');
ok(normalizeJobCategory('civil engineering') === 'Civil Engineering', 'civil alias');
ok(normalizeJobCategory('IT & Software') === 'IT & Software', 'exact IT');
ok(normalizeJobCategory('electronics and communication') === 'ECE / Electronics', 'ece phrase');
ok(normalizeJobCategory('corporate communication') !== 'ECE / Electronics', 'soft-skill communication is not ECE');
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
ok(
  inferJobCategoryFromSignals({
    title: 'Software Developer',
    description: 'Recently posted role for Java developer',
    category: 'General',
  }) === 'IT & Software',
  'recently must not force ECE',
);
ok(
  inferJobCategoryFromSignals({
    title: 'Customer Support Executive',
    description: 'Must have necessary communication skills',
    category: 'General',
  }) === 'BPO / Customer Support',
  'communication skills must not force ECE',
);
ok(
  inferJobCategoryFromSignals({
    title: 'Embedded Systems Engineer',
    skills: 'vlsi, fpga',
    category: 'General',
  }) === 'ECE / Electronics',
  'real ECE from skills',
);

console.log('\nhasEceRoleEvidence');
ok(
  hasEceRoleEvidence({ title: 'ECE Graduate Engineer Trainee' }),
  'ece in title counts',
);
ok(
  !hasEceRoleEvidence({
    title: 'Sales Executive',
    description: 'Good communication skills required. Recently posted.',
  }),
  'soft skills are not ECE evidence',
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
{
  const out = classifyJobRecord({
    title: 'Sales Executive',
    category: 'ECE / Electronics',
    description: 'Field sales with strong communication skills. Recently opened.',
    experience: '1-3 years',
  });
  ok(out.category === 'Sales & Marketing', 'reclassify mislabelled ECE sales job');
}
{
  const out = classifyJobRecord({
    title: 'Electronics and Communication Engineer',
    category: 'ECE / Electronics',
    experience: '0-1 years',
  });
  ok(out.category === 'ECE / Electronics', 'keep real ECE job');
}

console.log('\njobMatchesCategoryFilter');
ok(jobMatchesCategoryFilter({ title: 'Accountant', category: 'Banking & Finance' }, 'banking'), 'banking filter');
ok(
  !jobMatchesCategoryFilter(
    {
      title: 'Sales Executive',
      category: 'Sales & Marketing',
      description: 'Good communication skills required',
    },
    'ece',
  ),
  'sales with communication skills is not ECE filter',
);
ok(
  !jobMatchesCategoryFilter(
    {
      title: 'Accountant',
      category: 'Banking & Finance',
      description: 'Tally GST experience recently preferred',
    },
    'ece',
  ),
  'recently does not match ECE filter',
);
ok(
  jobMatchesCategoryFilter(
    {
      title: 'ECE Graduate Engineer',
      category: 'ECE / Electronics',
      skills: 'embedded systems',
    },
    'ece',
  ),
  'real ECE matches filter',
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
