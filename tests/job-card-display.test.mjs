/**
 * Run with: node tests/job-card-display.test.mjs
 */

import { PUBLIC_JOB_DISPLAY } from '../src/lib/jobDisplayLabels.js';
import {
  buildCardHighlightItems,
  cardSalary,
  cardWorkMode,
  hasProperSalaryInfo,
} from '../src/lib/jobCardDisplay.js';

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

ok(cardWorkMode(PUBLIC_JOB_DISPLAY.workMode) === null, 'skip vague work arrangement fallback');
ok(cardWorkMode('Work arrangement discussed during interview') === null, 'skip discussed work phrase');
ok(cardWorkMode('Remote') === 'Remote', 'keep real work mode');
ok(cardWorkMode('At interview') === null, 'skip at interview work mode');

ok(cardSalary(PUBLIC_JOB_DISPLAY.salary) === null, 'skip salary discussed fallback');
ok(cardSalary('Competitive salary') === null, 'skip non-numeric salary');
ok(cardSalary('15-20 LPA') === '15-20 LPA', 'keep LPA salary');
ok(hasProperSalaryInfo('₹25,000 - ₹35,000') === true, 'detect INR range salary');

const highlights = buildCardHighlightItems({
  category: 'IT & Software',
  jobType: 'Full-time',
  experience: 'Experience criteria discussed during interview',
  isFresher: 'Yes',
  salary: PUBLIC_JOB_DISPLAY.salary,
  workMode: PUBLIC_JOB_DISPLAY.workMode,
});

ok(
  !highlights.some((item) => item.key === 'workMode'),
  'buildCardHighlightItems omits vague work mode',
);
ok(
  !highlights.some((item) => item.key === 'salary'),
  'buildCardHighlightItems omits vague salary',
);
ok(
  !highlights.some((item) => item.key === 'experience'),
  'buildCardHighlightItems omits vague experience',
);
ok(highlights.some((item) => item.key === 'category'), 'buildCardHighlightItems keeps category');

const withSalary = buildCardHighlightItems({
  salary: '6-8 LPA',
  workMode: 'Hybrid',
});
ok(withSalary.some((item) => item.key === 'salary' && item.value === '6-8 LPA'), 'shows proper salary');
ok(withSalary.some((item) => item.key === 'workMode' && item.value === 'Hybrid'), 'shows proper work mode');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
