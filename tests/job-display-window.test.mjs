/**
 * Run with: node tests/job-display-window.test.mjs
 */

import {
  JOB_DISPLAY_MAX_AGE_DAYS,
  getMinPostedAtIsoForPublicDisplay,
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

const minIso = getMinPostedAtIsoForPublicDisplay();
const minMs = new Date(minIso).getTime();
const expectedMs = Date.now() - JOB_DISPLAY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
ok(Math.abs(minMs - expectedMs) < 5000, 'min posted_at is roughly 30 days ago');

const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
ok(isPostedAtWithinPublicDisplayWindow(recent), 'recent job is visible');
ok(!isPostedAtWithinPublicDisplayWindow(old), '40-day-old job is hidden');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
