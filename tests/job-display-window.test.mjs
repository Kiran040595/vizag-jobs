/**
 * Run with: node tests/job-display-window.test.mjs
 */

import {
  DIRECT_JOB_DISPLAY_MAX_AGE_DAYS,
  JOB_DISPLAY_MAX_AGE_DAYS,
  filterProcessedJobsForPublicDisplay,
  getMinPostedAtIsoForPublicDisplay,
  isJobWithinPublicDisplayWindow,
  isPostedAtWithinPublicDisplayWindow,
} from '../src/lib/jobDisplayWindow.js';

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

ok(JOB_DISPLAY_MAX_AGE_DAYS === 30, 'public display window is 30 days');
ok(DIRECT_JOB_DISPLAY_MAX_AGE_DAYS === 180, 'direct jobs display window is 180 days');

const minIso = getMinPostedAtIsoForPublicDisplay();
const minMs = new Date(minIso).getTime();
const expectedMs = Date.now() - JOB_DISPLAY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
ok(Math.abs(minMs - expectedMs) < 5000, 'min posted_at is roughly 30 days ago');

const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
const old40d = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
const old60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
const old200d = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();

ok(isPostedAtWithinPublicDisplayWindow(recent), 'recent job is visible');
ok(!isPostedAtWithinPublicDisplayWindow(old40d), '40-day-old job is hidden by default posted_at window');

// isJobWithinPublicDisplayWindow with direct vs external
const direct60dJob = {
  id: 'd1',
  createdBy: 'emp-123',
  postedAt: old60d,
};
const external60dJob = {
  id: 'agg1',
  source: 'naukri.com',
  sourceUrl: 'https://naukri.com/1',
  postedAt: old60d,
};
const expiredDirectJob = {
  id: 'd-exp',
  createdBy: 'emp-123',
  postedAt: recent,
  expiresAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
};

ok(isJobWithinPublicDisplayWindow(direct60dJob), '60-day-old direct company job is visible');
ok(!isJobWithinPublicDisplayWindow(external60dJob), '60-day-old external job is hidden');
ok(!isJobWithinPublicDisplayWindow(expiredDirectJob), 'expired direct job is hidden');

const filtered = filterProcessedJobsForPublicDisplay([direct60dJob, external60dJob, expiredDirectJob]);
ok(filtered.length === 1 && filtered[0].id === 'd1', 'filterProcessedJobsForPublicDisplay keeps active direct jobs');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
