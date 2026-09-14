/**
 * Unit tests for src/lib/jobBranchMatch.js
 * Run with: node tests/job-branch-match.test.mjs
 */

import {
  isCivilRelatedJob,
  isEceRelatedJob,
  isElectricalRelatedJob,
  isEngineeringRelatedJob,
  isMechanicalRelatedJob,
} from '../src/lib/jobBranchMatch.js';

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
  title: 'Engineer',
  company: 'Acme',
  category: 'General',
  skills: '',
  shortDescription: '',
  description: '',
  ...overrides,
});

console.log('\nCivil branch');
ok(isCivilRelatedJob(job({ title: 'Civil Engineer - Site' })), 'title civil engineer');
ok(isCivilRelatedJob(job({ category: 'Civil Engineering' })), 'category civil');
ok(!isCivilRelatedJob(job({ title: 'Java Developer' })), 'software is not civil');

console.log('\nMechanical branch');
ok(isMechanicalRelatedJob(job({ title: 'Mechanical Maintenance Engineer' })), 'mechanical title');
ok(isMechanicalRelatedJob(job({ category: 'Manufacturing' })), 'manufacturing category');
ok(!isMechanicalRelatedJob(job({ title: 'Accountant' })), 'accountant is not mechanical');

console.log('\nElectrical branch');
ok(isElectricalRelatedJob(job({ title: 'Electrical Engineer - Power Plant' })), 'electrical title');
ok(isElectricalRelatedJob(job({ category: 'EEE' })), 'eee category');

console.log('\nECE branch');
ok(isEceRelatedJob(job({ title: 'ECE Graduate Engineer Trainee' })), 'ece title');
ok(isEceRelatedJob(job({ skills: 'embedded systems, vlsi' })), 'ece skills');
ok(
  !isEceRelatedJob(
    job({
      title: 'Sales Executive',
      category: 'Sales & Marketing',
      description: 'Excellent communication skills. Recently posted opening.',
    }),
  ),
  'soft-skill communication is not ECE',
);
ok(
  !isEceRelatedJob(
    job({
      title: 'HR Executive',
      category: 'ECE / Electronics',
      description: 'Recruitment and necessary coordination with candidates',
    }),
  ),
  'mislabelled HR job is not ECE',
);
ok(
  isEceRelatedJob(
    job({
      title: 'Graduate Engineer Trainee',
      category: 'ECE / Electronics',
      description: 'Campus hiring for electronics and communication graduates',
    }),
  ),
  'ECE labelled role with evidence stays ECE',
);
ok(
  !isEceRelatedJob(
    job({
      title: 'Graduate Engineer Trainee',
      category: 'ECE / Electronics',
      description: 'Campus hiring for engineering graduates',
    }),
  ),
  'ECE label alone without role evidence is not enough',
);

console.log('\nEngineering umbrella');
ok(isEngineeringRelatedJob(job({ title: 'Civil Site Engineer' })), 'civil under engineering');
ok(isEngineeringRelatedJob(job({ title: 'Instrumentation Engineer' })), 'instrumentation under engineering');
ok(!isEngineeringRelatedJob(job({ title: 'Sales Executive' })), 'sales is not engineering');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
