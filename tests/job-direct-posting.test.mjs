/**
 * Unit tests for src/lib/jobDirectPosting.js
 *
 * Run with: node tests/job-direct-posting.test.mjs
 */

import {
  countDirectJobs,
  getDirectPostingBadge,
  isDirectPosting,
  isEmployerPosting,
  isExternalAggregatorJob,
  isInternalApplyPosting,
} from '../src/lib/jobDirectPosting.js';

let pass = 0;
let fail = 0;
const trail = [];

const ok = (cond, label) => {
  if (cond) {
    pass += 1;
    trail.push(`  OK    ${label}`);
  } else {
    fail += 1;
    trail.push(`  FAIL  ${label}`);
  }
};

const eq = (a, b, label) =>
  ok(
    JSON.stringify(a) === JSON.stringify(b),
    `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`,
  );

const section = (name) => trail.push(`\n${name}\n${'-'.repeat(name.length)}`);

section('isExternalAggregatorJob');
ok(
  isExternalAggregatorJob({
    source: 'Naukri.com',
    sourceUrl: 'https://www.naukri.com/job-listings-123',
  }),
  'identifies Naukri as aggregator',
);
ok(
  isExternalAggregatorJob({
    source: 'LinkedIn',
    sourceUrl: 'https://www.linkedin.com/jobs/view/12345',
  }),
  'identifies LinkedIn as aggregator',
);
ok(
  isExternalAggregatorJob({
    source: 'Indeed',
    sourceUrl: 'https://in.indeed.com/viewjob?jk=abc',
  }),
  'identifies Indeed as aggregator',
);
ok(
  isExternalAggregatorJob({
    source: 'Glassdoor',
    applyLink: 'https://www.glassdoor.co.in/job-listing/123',
  }),
  'identifies Glassdoor as aggregator',
);
ok(
  !isExternalAggregatorJob({
    source: 'Admin Post',
    sourceUrl: null,
    applyLink: 'https://company.com/careers/apply',
  }),
  'manual admin post is not aggregator',
);
ok(
  !isExternalAggregatorJob({
    source: '',
    createdBy: 'emp-123',
  }),
  'employer job is not aggregator',
);

section('isEmployerPosting');
ok(
  isEmployerPosting({ createdBy: 'emp-uuid-123' }),
  'job with createdBy is employer posting',
);
ok(
  isEmployerPosting({ created_by: 'emp-uuid-456' }),
  'job with created_by snake_case is employer posting',
);
ok(
  !isEmployerPosting({ createdBy: null, created_by: null }),
  'job without createdBy is not employer posting',
);

section('isInternalApplyPosting');
ok(
  isInternalApplyPosting({ applyMode: 'internal' }),
  'job with applyMode=internal',
);
ok(
  isInternalApplyPosting({ apply_mode: 'internal' }),
  'job with apply_mode=internal',
);
ok(
  !isInternalApplyPosting({ applyMode: 'external' }),
  'job with applyMode=external is not internal apply',
);

section('isDirectPosting');
ok(
  isDirectPosting({
    title: 'Frontend Developer',
    company: 'Vizag Tech Corp',
    createdBy: 'employer-uuid-1',
    applyMode: 'internal',
  }),
  'employer job with internal apply is direct',
);
ok(
  isDirectPosting({
    title: 'HR Manager',
    company: 'Beach City Logistics',
    createdBy: 'employer-uuid-2',
    applyMode: 'external',
    applyLink: 'https://beachcitylogistics.com/jobs/12',
  }),
  'employer job with company apply link is direct',
);
ok(
  isDirectPosting({
    title: 'Civil Engineer Walk-in',
    company: 'Coastal Infra',
    source: 'Admin Post',
    applyMode: 'internal',
  }),
  'admin post is direct',
);
ok(
  !isDirectPosting({
    title: 'Software Engineer',
    company: 'TCS',
    source: 'Naukri.com',
    sourceUrl: 'https://www.naukri.com/job-listings-tcs',
    applyLink: 'https://www.naukri.com/apply',
  }),
  'Naukri job is NOT direct',
);
ok(
  !isDirectPosting({
    title: 'React Dev',
    company: 'Infosys',
    source: 'LinkedIn',
    sourceUrl: 'https://www.linkedin.com/jobs/view/999',
  }),
  'LinkedIn job is NOT direct',
);

section('getDirectPostingBadge');
eq(
  getDirectPostingBadge({ createdBy: 'emp-1' }),
  { label: 'Direct Employer', icon: '🏢', tone: 'emerald' },
  'employer posting gets Direct Employer badge',
);
eq(
  getDirectPostingBadge({ applyMode: 'internal' }),
  { label: 'Easy Apply on Vizag Jobs', icon: '⚡', tone: 'cyan' },
  'internal apply gets Easy Apply on Vizag Jobs badge',
);
eq(
  getDirectPostingBadge({ source: 'Admin Post' }),
  { label: 'Verified Direct', icon: '🛡️', tone: 'indigo' },
  'admin verified post gets Verified Direct badge',
);
eq(
  getDirectPostingBadge({ source: 'naukri.com', sourceUrl: 'https://naukri.com/x' }),
  null,
  'aggregator job gets null badge',
);

section('countDirectJobs');
const testJobs = [
  { id: '1', createdBy: 'emp-1' },
  { id: '2', source: 'naukri.com', sourceUrl: 'https://naukri.com/1' },
  { id: '3', source: 'linkedin.com', sourceUrl: 'https://linkedin.com/jobs/view/2' },
  { id: '4', source: 'Admin Post' },
];
eq(countDirectJobs(testJobs), 2, 'correctly counts 2 direct jobs out of 4');
eq(countDirectJobs([]), 0, 'empty list counts 0');

console.log(trail.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
