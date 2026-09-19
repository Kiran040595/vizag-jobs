/**
 * Unit tests for src/lib/jobApplicationCount.js
 * Run with: node tests/job-application-count.test.mjs
 */

import {
  formatApplicantCountLabel,
  formatApplicationCountNoun,
  formatUniqueApplyClickNoun,
  jobApplicationCount,
  jobApplyClickCount,
  normalizeApplicationCount,
  resolveJobApplicationCount,
  resolveOnPlatformApplicationCount,
  shouldShowAdminApplicantCount,
  summarizeApplyClickCounts,
} from '../src/lib/jobApplicationCount.js';
import {
  buildApplyClickVisitorKey,
  isUuid,
} from '../src/lib/applyVisitorKey.js';

const memoryStore = new Map();
globalThis.localStorage = {
  getItem: (key) => (memoryStore.has(key) ? memoryStore.get(key) : null),
  setItem: (key, value) => {
    memoryStore.set(key, String(value));
  },
  removeItem: (key) => {
    memoryStore.delete(key);
  },
};

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
ok(jobApplicationCount({ applicationCount: 4 }) === 4, 'camelCase applications');
ok(jobApplicationCount({ application_count: 7 }) === 7, 'snake_case applications');
ok(jobApplicationCount({ applicationCount: 2, application_count: 9 }) === 2, 'prefers camelCase');
ok(jobApplicationCount({ applyClickCount: 3 }) === 3, 'unique clicks only');
ok(jobApplicationCount({ applicationCount: 2, applyClickCount: 5 }) === 7, 'applications plus unique clicks');
ok(jobApplyClickCount({ apply_click_count: 4 }) === 4, 'snake_case clicks');

console.log('\nresolveJobApplicationCount');
ok(resolveOnPlatformApplicationCount({ id: 'a', applicationCount: 1 }, { a: 5 }) === 5, 'lookup wins for on-platform');
ok(resolveJobApplicationCount({ id: 'a', applicationCount: 1, applyClickCount: 2 }, { a: 5 }) === 7, 'lookup plus clicks');
ok(resolveJobApplicationCount({ id: 'b', application_count: 3 }, {}) === 3, 'falls back to job');

console.log('\nshouldShowAdminApplicantCount');
ok(!shouldShowAdminApplicantCount({ applyMode: 'internal', applicationCount: 4 }, false), 'hidden without admin');
ok(!shouldShowAdminApplicantCount({ applyMode: 'external', applyClickCount: 3 }, false), 'clicks hidden from public');
ok(shouldShowAdminApplicantCount({ applyMode: 'internal', applicationCount: 0 }, true), 'admin sees internal with 0');
ok(shouldShowAdminApplicantCount({ apply_mode: 'internal', applicationCount: 0 }, true), 'admin sees snake_case internal');
ok(shouldShowAdminApplicantCount({ applyMode: 'external', applicationCount: 2 }, true), 'admin sees external applicants');
ok(shouldShowAdminApplicantCount({ applyMode: 'external', applyClickCount: 1 }, true), 'admin sees unique clicks');
ok(!shouldShowAdminApplicantCount({ applyMode: 'external', applicationCount: 0 }, true), 'admin hides empty external');

console.log('\nsummarizeApplyClickCounts');
ok(
  JSON.stringify(
    summarizeApplyClickCounts([
      { apply_click_count: 2 },
      { applyClickCount: 0 },
      { applyClickCount: 4 },
    ]),
  ) === JSON.stringify({ jobCount: 3, uniqueClicks: 6, jobsWithClicks: 2 }),
  'sums unique clicks across imported jobs',
);

console.log('\napply visitor key');
ok(isUuid('550e8400-e29b-41d4-a716-446655440000'), 'valid uuid');
ok(!isUuid('not-a-uuid'), 'rejects junk');
ok(
  buildApplyClickVisitorKey('550e8400-e29b-41d4-a716-446655440000') ===
    'user:550e8400-e29b-41d4-a716-446655440000',
  'logged-in users map to user:<uuid>',
);
ok(buildApplyClickVisitorKey('').startsWith('anon:'), 'anonymous visitors use anon: prefix');
ok(
  buildApplyClickVisitorKey('') === buildApplyClickVisitorKey(''),
  'anonymous key is stable in the same browser',
);

console.log('\nlabels');
ok(formatApplicantCountLabel(1) === '1 applied', 'singular applied');
ok(formatApplicantCountLabel(8) === '8 applied', 'plural applied');
ok(formatApplicationCountNoun(1) === '1 application', 'singular noun');
ok(formatApplicationCountNoun(0) === '0 applications', 'zero noun');
ok(formatUniqueApplyClickNoun(1) === '1 unique apply click', 'singular unique click');
ok(formatUniqueApplyClickNoun(4) === '4 unique apply clicks', 'plural unique clicks');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
