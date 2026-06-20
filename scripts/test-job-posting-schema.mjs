// Smoke-test the JSON-LD builders with realistic job shapes.
// Run with: node scripts/test-job-posting-schema.mjs

import { buildJobPostingSchema, isJobExpired, mapEmploymentType, buildBaseSalary } from '../src/lib/jobPostingSchema.js';
import { buildBreadcrumbSchema } from '../src/lib/breadcrumbSchema.js';

let passed = 0;
let failed = 0;
const failures = [];

const assert = (label, condition, detail) => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    failures.push({ label, detail });
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
};

const section = (name) => console.log(`\n=== ${name} ===`);

// ---------------------------------------------------------------------------
section('mapEmploymentType()');
assert('full-time', mapEmploymentType('Full-time') === 'FULL_TIME');
assert('full time variant', mapEmploymentType('full time') === 'FULL_TIME');
assert('part-time', mapEmploymentType('Part-time') === 'PART_TIME');
assert('contract', mapEmploymentType('Contractor') === 'CONTRACTOR');
assert('intern', mapEmploymentType('Internship') === 'INTERN');
assert('temp', mapEmploymentType('Temporary') === 'TEMPORARY');
assert('default for empty', mapEmploymentType('') === 'FULL_TIME');
assert('OTHER for unknown', mapEmploymentType('Gig something weird') === 'OTHER');

// ---------------------------------------------------------------------------
section('buildBaseSalary()');
const lpa = buildBaseSalary('5-8 LPA');
assert('LPA range produces YEAR unit', lpa?.value?.unitText === 'YEAR' && lpa.value.minValue === 500000 && lpa.value.maxValue === 800000);
const monthlyK = buildBaseSalary('25k - 35k');
assert('"k" range produces MONTH unit', monthlyK?.value?.unitText === 'MONTH' && monthlyK.value.minValue === 25000 && monthlyK.value.maxValue === 35000);
const single = buildBaseSalary('600000');
assert('plain salary parsed', single?.value?.unitText === 'YEAR' && single.value.value === 600000);
assert('negotiable returns null', buildBaseSalary('Negotiable') === null);
assert('blank returns null', buildBaseSalary('') === null);

// ---------------------------------------------------------------------------
section('buildJobPostingSchema() — Gemini-optimized job (has stored json_ld)');
const geminiJob = {
  id: 'job-1',
  slug: 'software-engineer-vizag-acme',
  title: 'Software Engineer',
  company: 'Acme Corp',
  location: 'Visakhapatnam',
  category: 'IT',
  jobType: 'Full-time',
  workMode: 'On-site',
  experience: '2-3 years',
  isFresher: 'No',
  salary: '6-9 LPA',
  applyLink: 'https://acme.example/apply',
  description: 'We are hiring a Software Engineer in Vizag/Visakhapatnam. Full description here.',
  shortDescription: 'Software Engineer in Vizag.',
  postedAt: '2026-05-20T08:00:00Z',
  expiresAt: '2026-06-20T23:59:00Z',
  companyLogoUrl: 'https://cdn.acme.example/logo.png',
  jsonLd: {
    '@type': 'JobPosting',
    title: 'Software Engineer at Acme Corp (Vizag)',
    description: '<p>Detailed Gemini-rewritten description for SEO.</p>',
    employmentType: 'FULL_TIME',
    datePosted: '2026-05-20',
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Acme Corp',
      sameAs: 'https://acme.example',
      logo: 'https://cdn.acme.example/logo.png',
    },
  },
};

const geminiSchema = buildJobPostingSchema(geminiJob);
assert('returns object', geminiSchema && typeof geminiSchema === 'object');
assert('@context is schema.org', geminiSchema['@context'] === 'https://schema.org/');
assert('@type is JobPosting', geminiSchema['@type'] === 'JobPosting');
assert('preserves Gemini title', geminiSchema.title === 'Software Engineer at Acme Corp (Vizag)');
assert('preserves Gemini description', /SEO/.test(geminiSchema.description));
assert('datePosted is ISO', /^\d{4}-\d{2}-\d{2}T/.test(geminiSchema.datePosted));
assert('validThrough exists', !!geminiSchema.validThrough);
assert('validThrough is ISO', /^\d{4}-\d{2}-\d{2}T/.test(geminiSchema.validThrough));
assert('hiringOrganization preserved', geminiSchema.hiringOrganization?.name === 'Acme Corp');
assert('canonical url set', /\/jobs\/[a-z-]+\/software-engineer-vizag-acme$/.test(geminiSchema.url));
assert('directApply true (has applyLink)', geminiSchema.directApply === true);
assert('jobLocation present', geminiSchema.jobLocation?.['@type'] === 'Place');
assert('addressLocality Visakhapatnam', geminiSchema.jobLocation?.address?.addressLocality === 'Visakhapatnam');
assert('addressCountry IN', geminiSchema.jobLocation?.address?.addressCountry === 'IN');
assert('postalCode present', geminiSchema.jobLocation?.address?.postalCode === '530001');
assert('baseSalary from job salary column', geminiSchema.baseSalary?.currency === 'INR');
assert('identifier present', !!geminiSchema.identifier?.value);

// ---------------------------------------------------------------------------
section('buildJobPostingSchema() — Employer job (no jsonLd, fallback path)');
const employerJob = {
  id: 'job-2',
  slug: 'mechanical-engineer-vizag',
  title: 'Mechanical Engineer',
  company: 'Vizag Heavy Industries',
  location: 'Visakhapatnam',
  category: 'Manufacturing',
  jobType: 'Full-time',
  workMode: 'On-site',
  experience: '3+ years',
  isFresher: 'No',
  salary: '4.5-7 LPA',
  applyLink: 'mailto:hr@vhi.example',
  description: 'Looking for a mechanical engineer with experience in heavy machinery.',
  shortDescription: 'Mechanical engineer role.',
  postedAt: '2026-05-22T10:00:00Z',
};

const employerSchema = buildJobPostingSchema(employerJob);
assert('fallback returns object', !!employerSchema);
assert('fallback @type', employerSchema['@type'] === 'JobPosting');
assert('fallback title from columns', employerSchema.title === 'Mechanical Engineer');
assert('fallback description as HTML', /^<p>/.test(employerSchema.description));
assert('fallback employmentType from jobType', employerSchema.employmentType === 'FULL_TIME');
assert('fallback validThrough = postedAt + 30 days', new Date(employerSchema.validThrough) > new Date(employerJob.postedAt));
assert('fallback baseSalary parsed', employerSchema.baseSalary?.currency === 'INR');
assert('fallback hiringOrganization name', employerSchema.hiringOrganization?.name === 'Vizag Heavy Industries');
assert('fallback identifier value', employerSchema.identifier?.value === 'mechanical-engineer-vizag');

// ---------------------------------------------------------------------------
section('buildJobPostingSchema() — Remote/WFH job');
const remoteJob = {
  ...employerJob,
  slug: 'remote-developer',
  title: 'Remote React Developer',
  workMode: 'Remote',
  description: 'Build React apps from anywhere.',
};
const remoteSchema = buildJobPostingSchema(remoteJob);
assert('remote sets jobLocationType=TELECOMMUTE', remoteSchema.jobLocationType === 'TELECOMMUTE');
assert('remote sets applicantLocationRequirements', remoteSchema.applicantLocationRequirements?.name === 'India');

// ---------------------------------------------------------------------------
section('buildJobPostingSchema() — invalid input');
assert('null job returns null', buildJobPostingSchema(null) === null);
assert('empty object returns null', buildJobPostingSchema({}) === null);
const minimalJob = buildJobPostingSchema({ title: 'X' });
assert('minimal job auto-fills fallback description', minimalJob !== null && minimalJob.description.length >= 50);

// ---------------------------------------------------------------------------
section('isJobExpired()');
assert('not expired without expiresAt', isJobExpired({ slug: 'x' }) === false);
assert('not expired in future', isJobExpired({ expiresAt: '2099-01-01T00:00:00Z' }) === false);
assert('expired in past', isJobExpired({ expiresAt: '2020-01-01T00:00:00Z' }) === true);

// ---------------------------------------------------------------------------
section('buildBreadcrumbSchema()');
const breadcrumb = buildBreadcrumbSchema(geminiJob);
assert('returns object', !!breadcrumb);
assert('@type BreadcrumbList', breadcrumb['@type'] === 'BreadcrumbList');
assert('has 4 items', breadcrumb.itemListElement?.length === 4);
assert('first item is Home', breadcrumb.itemListElement[0].name === 'Home');
assert('last item is job title', breadcrumb.itemListElement[3].name === 'Software Engineer');
assert('positions are 1..4', breadcrumb.itemListElement.every((it, i) => it.position === i + 1));
assert('all items have absolute URLs', breadcrumb.itemListElement.every((it) => /^https:\/\//.test(it.item)));
assert('null job returns null', buildBreadcrumbSchema(null) === null);

// ---------------------------------------------------------------------------
console.log('\n=== Summary ===');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f.label}${f.detail ? `: ${f.detail}` : ''}`);
  }
  process.exit(1);
}
process.exit(0);
