/**
 * Run with: node tests/job-display-labels.test.mjs
 */

import {
  PUBLIC_JOB_DISPLAY,
  displayCompanyName,
  displayExperience,
  displayFresher,
  displayJobCategory,
  displayJobType,
  displayPostedAt,
  displaySalary,
  displayWorkMode,
  isPlaceholderJobValue,
  sanitizeJobSeoRecord,
} from '../src/lib/jobDisplayLabels.js';

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

ok(isPlaceholderJobValue(''), 'empty is placeholder');
ok(isPlaceholderJobValue('N/A'), 'N/A is placeholder');
ok(isPlaceholderJobValue('Unknown'), 'Unknown is placeholder');
ok(isPlaceholderJobValue('Not specified'), 'Not specified is placeholder');
ok(!isPlaceholderJobValue('5-8 years'), 'experience range is real');
ok(!isPlaceholderJobValue('Sales & Marketing'), 'category is real');

ok(
  displayCompanyName('') === PUBLIC_JOB_DISPLAY.company,
  'company fallback'
);
ok(displaySalary('N/A') === PUBLIC_JOB_DISPLAY.salary, 'salary fallback');
ok(displayWorkMode(null) === null, 'work mode placeholder returns null');
ok(displayWorkMode(PUBLIC_JOB_DISPLAY.workMode) === null, 'work mode fallback text returns null');
ok(displayWorkMode('Hybrid') === 'Hybrid', 'work mode passthrough');
ok(displayJobType('Full-time') === 'Full-time', 'job type passthrough');
ok(isPlaceholderJobValue('Experience criteria discussed during interview'), 'generic experience phrase is placeholder');
ok(displayExperience('Not specified') === null, 'experience placeholder returns null');
ok(displayExperience('5-8 years') === '5-8 years', 'experience passthrough');
ok(displayJobCategory('IT & Software') === 'IT & Software', 'category passthrough');
ok(displayFresher('No') === PUBLIC_JOB_DISPLAY.fresherNo, 'fresher no');
ok(displayFresher('Yes') === PUBLIC_JOB_DISPLAY.fresherYes, 'fresher yes');
ok(displayPostedAt(null, null) === PUBLIC_JOB_DISPLAY.postedAt, 'posted at fallback');
ok(displayPostedAt('2026-06-01', '15 hours ago') === '15 hours ago', 'relative posted at');

const sanitized = sanitizeJobSeoRecord({
  company: 'Unknown',
  salary: 'N/A',
  experience: 'Not specified',
  work_mode: '',
  json_ld: { hiringOrganization: { name: 'Unknown' } },
});
ok(sanitized.company === PUBLIC_JOB_DISPLAY.company, 'sanitize company');
ok(sanitized.salary === PUBLIC_JOB_DISPLAY.salary, 'sanitize salary');
ok(sanitized.experience === '', 'sanitize experience clears placeholder');
ok(sanitized.work_mode === PUBLIC_JOB_DISPLAY.workMode, 'sanitize work mode keeps SEO fallback');
ok(sanitized.json_ld.hiringOrganization.name === PUBLIC_JOB_DISPLAY.company, 'sanitize json_ld org');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
