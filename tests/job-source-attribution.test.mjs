/**
 * Run with: node tests/job-source-attribution.test.mjs
 */

import { resolveJobSourceAttribution } from '../src/lib/jobSourceAttribution.js';

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

const eq = (actual, expected, label) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  ok(a === e, `${label} (got ${a}, expected ${e})`);
};

eq(
  resolveJobSourceAttribution({
    source: 'naukri.com',
    sourceUrl: 'https://www.naukri.com/job-listings-example',
  }),
  { label: 'Naukri', href: 'https://www.naukri.com/job-listings-example' },
  'naukri source with URL',
);

eq(
  resolveJobSourceAttribution({
    source: 'linkedin.com',
    sourceUrl: 'https://www.linkedin.com/jobs/view/123',
  }),
  { label: 'LinkedIn', href: 'https://www.linkedin.com/jobs/view/123' },
  'linkedin source with URL',
);

eq(
  resolveJobSourceAttribution({
    source: '',
    sourceUrl: 'https://www.indeed.com/viewjob?jk=abc',
  }),
  { label: 'Indeed', href: 'https://www.indeed.com/viewjob?jk=abc' },
  'infer label from source URL hostname',
);

eq(
  resolveJobSourceAttribution({
    source: 'Employer Portal',
    sourceUrl: '',
    applyLink: '',
  }),
  null,
  'employer portal submissions are hidden',
);

eq(
  resolveJobSourceAttribution({
    source: '',
    sourceUrl: '',
    applyLink: '',
  }),
  null,
  'empty source data is hidden',
);

eq(
  resolveJobSourceAttribution({
    source: 'Naukri',
    sourceUrl: '',
    applyLink: 'https://www.naukri.com/job-listings-fallback',
  }),
  { label: 'Naukri', href: null },
  'source name without URL stays text-only',
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
