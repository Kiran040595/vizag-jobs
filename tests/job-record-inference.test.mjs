/**
 * Unit tests for src/lib/jobRecordInference.js
 * Run with: node tests/job-record-inference.test.mjs
 */

import {
  inferCompanyFromJob,
  inferExperienceFromJob,
  isUsableCompanyName,
  resolveJobExperienceForDisplay,
} from '../src/lib/jobRecordInference.js';

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

console.log('\ncompany inference');
ok(isUsableCompanyName('Acme Tech'), 'valid company');
ok(!isUsableCompanyName('Naukri'), 'reject naukri');
ok(
  inferCompanyFromJob({
    company: 'Unknown',
    description: '[Posted by Shvintech India](https://example.com)\nRole: Developer',
  }) === 'Shvintech India',
  'posted by from description',
);

console.log('\nexperience inference');
ok(
  inferExperienceFromJob({
    title: 'Java Developer',
    description: 'Minimum 3 years experience in Java required.',
    experience: 'Not specified',
  }) === '3+ years',
  'min years from description',
);
ok(
  inferExperienceFromJob({
    title: 'Graduate Engineer Trainee',
    eligibility: ['B.Tech 2025 passout', 'Fresh graduates'],
    experience: 'Not specified',
  }) === 'Fresher',
  'fresher from eligibility',
);
ok(
  inferExperienceFromJob({
    title: 'Site Engineer',
    experience: '2 - 5 Years',
  }) === '2-5 years',
  'normalize experience range',
);
ok(
  resolveJobExperienceForDisplay({
    title: 'Java Developer',
    description: 'Minimum 3 years experience in Java required.',
    experience: 'Not specified',
  }) === '3+ years',
  'resolve experience from description',
);
ok(
  resolveJobExperienceForDisplay({
    title: 'Generic role',
    description: 'Apply with resume.',
    experience: 'Not specified',
  }) === null,
  'hide experience when unknown',
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
