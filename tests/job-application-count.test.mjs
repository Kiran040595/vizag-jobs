/**
 * Unit tests for src/lib/jobApplicationCount.js
 * Run with: node tests/job-application-count.test.mjs
 */

import {
  formatApplicantCountLabel,
  formatApplicationCountNoun,
  jobApplicationCount,
  normalizeApplicationCount,
  resolveJobApplicationCount,
  shouldShowPublicApplicantCount,
} from '../src/lib/jobApplicationCount.js';

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

console.log('\nnormalizeApplicationCount');
ok(normalizeApplicationCount(undefined) === 0, 'undefined is 0');
ok(normalizeApplicationCount(null) === 0, 'null is 0');
ok(normalizeApplicationCount(-2) === 0, 'negative is 0');
ok(normalizeApplicationCount(3.9) === 3, 'floors decimals');
ok(normalizeApplicationCount('12') === 12, 'numeric string');

console.log('\njobApplicationCount');
ok(jobApplicationCount({ applicationCount: 4 }) === 4, 'camelCase');
ok(jobApplicationCount({ application_count: 7 }) === 7, 'snake_case');
ok(jobApplicationCount({ applicationCount: 2, application_count: 9 }) === 2, 'prefers camelCase');

console.log('\nresolveJobApplicationCount');
ok(resolveJobApplicationCount({ id: 'a', applicationCount: 1 }, { a: 5 }) === 5, 'lookup wins');
ok(resolveJobApplicationCount({ id: 'b', application_count: 3 }, {}) === 3, 'falls back to job');

console.log('\nshouldShowPublicApplicantCount');
ok(shouldShowPublicApplicantCount({ applyMode: 'internal', applicationCount: 0 }), 'internal with 0');
ok(shouldShowPublicApplicantCount({ apply_mode: 'internal', applicationCount: 0 }), 'snake_case internal');
ok(shouldShowPublicApplicantCount({ applyMode: 'external', applicationCount: 2 }), 'external with applicants');
ok(!shouldShowPublicApplicantCount({ applyMode: 'external', applicationCount: 0 }), 'hide empty external');

console.log('\nlabels');
ok(formatApplicantCountLabel(1) === '1 applied', 'singular applied');
ok(formatApplicantCountLabel(8) === '8 applied', 'plural applied');
ok(formatApplicationCountNoun(1) === '1 application', 'singular noun');
ok(formatApplicationCountNoun(0) === '0 applications', 'zero noun');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
