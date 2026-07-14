// End-to-end synthetic pipeline test:
//   Stage 1: Scraped LinkedIn job (raw)
//   Stage 2: Make SEO via Gemini (simulated payload matching gemini-seo-prompt.ts schema)
//   Stage 3: extractSeoExtrasFromPayload + applySeoPayload (mirrors edge fn)
//   Stage 4: Publish path (sanitizeExternalJobForInsert + serializeJobForm)
//   Stage 5: DB round-trip (JSON serialize/deserialize)
//   Stage 6: processJobData (front-end fetch)
//   Stage 7: buildJobPostingSchema (final render)
//   Stage 8: validateJobPostingSchema (Google rules)

import { buildJobPostingSchema, isJobExpired } from '../src/lib/jobPostingSchema.js';
import { buildBreadcrumbSchema } from '../src/lib/breadcrumbSchema.js';
import {
  validateJobPostingSchema,
  printValidationReport,
} from './google-jobposting-validator.mjs';

let totalPass = 0;
let totalFail = 0;
const failedAssertions = [];

const assert = (label, condition, detail) => {
  if (condition) {
    totalPass += 1;
    console.log(`    PASS  ${label}`);
  } else {
    totalFail += 1;
    failedAssertions.push({ label, detail });
    console.log(`    FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
};

const section = (name) => console.log(`\n--- ${name} ---`);

// ============================================================================
// MIRRORS of edge function logic (from supabase/functions/fetch-external-jobs/)
// ============================================================================

// extractSeoExtrasFromPayload (gemini-seo-prompt.ts lines 179-203)
const extractSeoExtras = (payload) => {
  let json_ld = null;
  if (payload.json_ld && typeof payload.json_ld === 'object' && !Array.isArray(payload.json_ld)) {
    json_ld = payload.json_ld;
  }
  const hashtags = Array.isArray(payload.hashtags)
    ? payload.hashtags.map((t) => String(t ?? '').trim()).filter(Boolean).slice(0, 20)
    : [];
  const keyword_density = Array.isArray(payload.keyword_density)
    ? payload.keyword_density
        .map((row) => ({
          keyword: String(row?.keyword ?? '').trim(),
          count: Math.max(0, Number(row?.count) || 0),
        }))
        .filter((row) => row.keyword.length > 0)
        .slice(0, 15)
    : [];
  return { json_ld, hashtags, keyword_density };
};

// applySeoPayload (mirrors index.ts ~2871-2912)
const applySeoPayload = (record, payload) => ({
  ...record,
  title: payload.title || record.title,
  slug: payload.slug || record.slug,
  short_description: payload.short_description || record.short_description,
  description: payload.description || record.description,
  responsibilities: payload.responsibilities || record.responsibilities,
  eligibility: payload.eligibility || record.eligibility,
  skills: payload.skills || record.skills,
  category: payload.category || record.category,
  job_type: payload.job_type || record.job_type,
  work_mode: payload.work_mode ?? record.work_mode,
});

// ============================================================================
// MIRRORS of admin publish path (src/services/adminJobs.js)
// ============================================================================

const normalizeText = (value) => String(value || '').trim();
const normalizeOptionalText = (value) => normalizeText(value) || null;
const toIsoString = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const toBoolean = (value) =>
  typeof value === 'boolean'
    ? value
    : ['true', 't', '1', 'yes'].includes(String(value || '').trim().toLowerCase());
const normalizeLineItems = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : String(value || '')
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);

const OPTIONAL_TEXT_FIELDS = [
  'salary',
  'apply_link',
  'short_description',
  'description',
  'warning',
  'expires_at',
  'source_name',
  'source_url',
  'company_logo_url',
  'work_mode',
];
const MULTILINE_FIELDS = ['responsibilities', 'eligibility', 'skills'];
const REQUIRED_DEFAULTS = { location: 'Visakhapatnam', experience: 'Not specified' };
const INVALID_APPLY_TOKENS = /^(null|undefined|none|n\/a|na)$/i;

const sanitizeExternalJobForInsert = (values) => {
  const title = normalizeText(values?.title) || 'Job opening';
  const company = normalizeText(values?.company) || 'Unknown';
  let slug = normalizeText(values?.slug) || `${title}-${company}`.toLowerCase().replace(/\s+/g, '-');
  let applyLink = normalizeText(values?.apply_link);
  if (!applyLink || INVALID_APPLY_TOKENS.test(applyLink)) {
    applyLink = normalizeText(values?.source_url) || '';
  }

  const incomingSeoMeta =
    values?.seo_meta && typeof values.seo_meta === 'object' ? values.seo_meta : null;
  const incomingJsonLd =
    values?.json_ld && typeof values.json_ld === 'object'
      ? values.json_ld
      : incomingSeoMeta?.json_ld && typeof incomingSeoMeta.json_ld === 'object'
        ? incomingSeoMeta.json_ld
        : null;

  const {
    seo_source_context: _a,
    seo_optimized: _b,
    seo_custom_instructions: _c,
    seo_meta: _d,
    seo_show_preview: _e,
    linkedin_post_text: _f,
    needs_review: _g,
    is_likely_hiring_post: _h,
    source_kind: _i,
    linkedin_post_preset: _j,
    linkedin_post_preset_label: _k,
    ...rest
  } = values ?? {};
  void [_a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k];

  return {
    ...rest,
    title,
    company,
    slug,
    apply_link: applyLink || null,
    location: normalizeText(values?.location) || REQUIRED_DEFAULTS.location,
    category: normalizeText(values?.category) || 'General',
    job_type: normalizeText(values?.job_type) || 'Full-time',
    experience: normalizeText(values?.experience) || REQUIRED_DEFAULTS.experience,
    warning:
      normalizeText(values?.warning) ||
      'Verify job details on the employer site before sharing personal documents or payments. Never pay a fee to apply.',
    json_ld: incomingJsonLd,
    seo_meta: incomingSeoMeta,
  };
};

const serializeJobForm = (values, statusOverride) => {
  const payload = {
    slug: normalizeText(values.slug),
    title: normalizeText(values.title),
    company: normalizeText(values.company),
    location: normalizeText(values.location) || REQUIRED_DEFAULTS.location,
    category: normalizeText(values.category),
    job_type: normalizeText(values.job_type),
    work_mode: normalizeOptionalText(values.work_mode),
    experience: normalizeText(values.experience) || REQUIRED_DEFAULTS.experience,
    is_fresher: toBoolean(values.is_fresher),
    posted_at: toIsoString(values.posted_at) || new Date().toISOString(),
    expires_at: toIsoString(values.expires_at),
    status: statusOverride || values.status || 'draft',
    is_featured: toBoolean(values.is_featured),
  };

  OPTIONAL_TEXT_FIELDS.forEach((field) => {
    if (!(field in payload)) {
      payload[field] = normalizeOptionalText(values[field]);
    }
  });
  MULTILINE_FIELDS.forEach((field) => {
    payload[field] = normalizeLineItems(values[field]);
  });

  if (values.json_ld && typeof values.json_ld === 'object' && !Array.isArray(values.json_ld)) {
    payload.json_ld = values.json_ld;
  }
  if (values.seo_meta && typeof values.seo_meta === 'object' && !Array.isArray(values.seo_meta)) {
    payload.seo_meta = values.seo_meta;
  }

  return payload;
};

// ============================================================================
// MIRROR of front-end processJobData (src/services/jobs.js)
// ============================================================================

const joinList = (value) =>
  Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value || '');
const normalizeFresherValue = (v) => (v ? 'Yes' : 'No');

const processJobData = (job, index = 0) => {
  const category = String(job.category || '');
  const jobType = String(job.job_type || '');
  const isFresher = normalizeFresherValue(job.is_fresher);
  const fresherTag = isFresher === 'Yes' ? 'Fresher' : 'Experienced';

  return {
    id: job.id || `supabase-job-${index + 1}`,
    slug: String(job.slug || ''),
    title: String(job.title || ''),
    company: String(job.company || ''),
    location: String(job.location || 'Visakhapatnam'),
    category,
    jobType,
    workMode: String(job.work_mode || ''),
    experience: String(job.experience || 'Not specified'),
    isFresher,
    salary: String(job.salary || ''),
    applyLink: String(job.apply_link || ''),
    description: String(job.description || ''),
    shortDescription: String(job.short_description || ''),
    responsibilities: joinList(job.responsibilities),
    eligibility: joinList(job.eligibility),
    warning: String(job.warning || ''),
    postedAt: String(job.posted_at || ''),
    status: String(job.status || ''),
    source: String(job.source_name || ''),
    sourceUrl: String(job.source_url || ''),
    skills: joinList(job.skills),
    companyLogo: String(job.company_logo_url || ''),
    companyLogoUrl: String(job.company_logo_url || ''),
    jsonLd:
      job.json_ld && typeof job.json_ld === 'object' && !Array.isArray(job.json_ld)
        ? job.json_ld
        : null,
    expiresAt: String(job.expires_at || ''),
    tags: [category, jobType, fresherTag].filter(Boolean),
  };
};

// ============================================================================
// FIXTURE 1: Realistic scraped LinkedIn job
// ============================================================================

const scrapedJob = {
  slug: '',
  title: 'software engineer',
  company: 'Acme Tech Pvt Ltd',
  location: 'Visakhapatnam, Andhra Pradesh',
  category: '',
  job_type: 'Full-time',
  work_mode: 'On-site',
  experience: '2-4 years',
  is_fresher: false,
  salary: '6-9 LPA',
  apply_link: 'https://acme.example/apply/123',
  short_description: '',
  description: 'We are hiring software engineers in Vizag.',
  responsibilities: [],
  eligibility: [],
  warning: '',
  posted_at: new Date().toISOString(),
  expires_at: null,
  source_name: 'LinkedIn',
  source_url: 'https://linkedin.com/jobs/view/123',
  skills: ['JavaScript', 'React'],
  company_logo_url: 'https://cdn.acme.example/logo.png',
  status: 'draft',
  is_featured: false,
};

// ============================================================================
// FIXTURE 2: Simulated Gemini response (matches gemini-seo-prompt.ts schema)
// ============================================================================

const geminiResponse = {
  title: 'Software Engineer — Acme Tech (Vizag)',
  slug: 'software-engineer-acme-tech-vizag',
  short_description:
    'Apply for Software Engineer jobs in Visakhapatnam at Acme Tech. 2-4 years experience, B.Tech qualification, 6-9 LPA salary. Apply online today on Vizag Jobs.',
  description:
    '# Software Engineer — Acme Tech (Vizag)\n\n## About the Role\nAcme Tech is hiring a Software Engineer in Visakhapatnam (Vizag). Join our growing IT team in Andhra Pradesh.\n\n## Skills Required\n- JavaScript, React, Node.js\n- 2-4 years engineering experience\n\n## Key Responsibilities\n- Build production-grade React applications\n- Collaborate with backend teams in Vizag\n\n## Who Can Apply\n- B.Tech / B.E in CSE/ECE\n- 2-4 years software development experience\n\n## How to Apply\nClick Apply Now to submit your resume.\n\n## FAQs\n**Q: Are these jobs in Vizag or Visakhapatnam?**\nA: Both - Vizag and Visakhapatnam refer to the same city in Andhra Pradesh.\n\n**Q: What is the salary for Software Engineer jobs in Vizag?**\nA: 6-9 LPA based on experience.\n\n**Q: Are fresher candidates considered?**\nA: This role requires 2-4 years experience. See [Fresher Jobs in Vizag](/fresher-jobs-in-vizag) for entry-level openings.\n\n**Q: Is this a remote role?**\nA: No, this is on-site in Visakhapatnam.',
  responsibilities: [
    'Build production-grade React applications',
    'Collaborate with backend teams in Vizag',
  ],
  eligibility: ['B.Tech / B.E in CSE/ECE', '2-4 years software development experience'],
  skills: ['JavaScript', 'React', 'Node.js'],
  category: 'IT',
  job_type: 'Full-time',
  work_mode: 'On-site',
  json_ld: {
    '@type': 'JobPosting',
    title: 'Software Engineer at Acme Tech (Vizag)',
    description:
      '<p>Acme Tech is hiring a Software Engineer in Visakhapatnam (Vizag). 2-4 years experience required. Apply via Vizag Jobs today.</p>',
    datePosted: scrapedJob.posted_at,
    employmentType: 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Acme Tech Pvt Ltd',
      sameAs: 'https://acme.example',
      logo: 'https://cdn.acme.example/logo.png',
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Visakhapatnam',
        addressRegion: 'Andhra Pradesh',
        addressCountry: 'IN',
      },
    },
    identifier: {
      '@type': 'PropertyValue',
      name: 'Acme Tech Pvt Ltd',
      value: 'software-engineer-acme-tech-vizag',
    },
  },
  hashtags: [
    '#VizagJobs',
    '#VisakhapatnamJobs',
    '#ITJobs',
    '#SoftwareEngineer',
    '#JavaScript',
    '#React',
    '#BTechJobs',
    '#AndhraPradeshJobs',
    '#TechCareers',
    '#JobsInVizag',
    '#HiringNow',
    '#FullStack',
    '#NodeJS',
    '#EngineeringJobs',
    '#CSE',
  ],
  keyword_density: [
    { keyword: 'Vizag', count: 6 },
    { keyword: 'Visakhapatnam', count: 5 },
    { keyword: 'Software Engineer', count: 4 },
  ],
};

// ============================================================================
// SCENARIO A: Gemini-optimized external job (full pipeline)
// ============================================================================

console.log('\n=== SCENARIO A: External job, Gemini optimized, published ===');

section('Stage 1: scrape (raw record)');
assert('raw title is lowercase placeholder', scrapedJob.title === 'software engineer');
assert('raw description is short', scrapedJob.description.length < 100);

section('Stage 2-3: Make SEO (extractSeoExtras + applySeoPayload)');
const extras = extractSeoExtras(geminiResponse);
const seoApplied = applySeoPayload(scrapedJob, geminiResponse);
const seoMeta = {
  gemini_model: 'gemini-2.5-pro',
  runtime_ms: 4200,
  json_ld: extras.json_ld,
  hashtags: extras.hashtags,
  keyword_density: extras.keyword_density,
};
const adminReviewJob = { ...seoApplied, seo_optimized: true, seo_meta: seoMeta };
assert('Gemini SEO applied: title rewritten', adminReviewJob.title.includes('Acme Tech'));
assert('Gemini SEO applied: slug rewritten', adminReviewJob.slug.includes('vizag'));
assert(
  'Gemini SEO applied: description rewritten with H1',
  adminReviewJob.description.startsWith('# '),
);
assert('extractSeoExtras: json_ld preserved', extras.json_ld?.['@type'] === 'JobPosting');
assert('extractSeoExtras: 15 hashtags', extras.hashtags.length === 15);
assert('extractSeoExtras: keyword_density populated', extras.keyword_density.length === 3);
assert('Admin review: seo_meta exposes json_ld', adminReviewJob.seo_meta.json_ld != null);

section('Stage 4: Publish (sanitize + serialize)');
const sanitized = sanitizeExternalJobForInsert(adminReviewJob);
const dbRow = serializeJobForm(sanitized, 'published');
assert('publish: json_ld preserved on payload', dbRow.json_ld != null);
assert('publish: json_ld has @type JobPosting', dbRow.json_ld['@type'] === 'JobPosting');
assert('publish: seo_meta preserved', dbRow.seo_meta != null);
assert('publish: seo_meta.hashtags preserved', Array.isArray(dbRow.seo_meta.hashtags));
assert('publish: status overridden to published', dbRow.status === 'published');
assert('publish: title is Gemini SEO title', dbRow.title.includes('Software Engineer'));
assert('publish: title is not a keyword-hub listing', !/jobs?\s+in\s+visakhapatnam/i.test(dbRow.title));
assert('publish: SEO admin fields stripped (seo_optimized)', !('seo_optimized' in dbRow));
assert(
  'publish: SEO admin fields stripped (seo_show_preview)',
  !('seo_show_preview' in dbRow),
);
assert('publish: skills serialized as array', Array.isArray(dbRow.skills));
assert(
  'publish: responsibilities serialized as array',
  Array.isArray(dbRow.responsibilities),
);
assert('publish: posted_at is ISO', /^\d{4}-\d{2}-\d{2}T/.test(dbRow.posted_at));
assert(
  'publish: required cols present',
  dbRow.title && dbRow.company && dbRow.slug && dbRow.category && dbRow.job_type,
);

section('Stage 5: DB round-trip (JSON serialize/deserialize, simulating Supabase)');
const dbStored = JSON.parse(JSON.stringify(dbRow));
dbStored.id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
dbStored.created_at = new Date().toISOString();
dbStored.updated_at = new Date().toISOString();
assert('DB row JSON serializable', dbStored.json_ld['@type'] === 'JobPosting');
assert('DB row preserves seo_meta on round-trip', dbStored.seo_meta != null);

section('Stage 6: Fetch (processJobData maps DB to public job)');
const publicJob = processJobData(dbStored, 0);
assert('processJobData: jsonLd exposed', publicJob.jsonLd?.['@type'] === 'JobPosting');
assert('processJobData: jsonLd is the SAME content as DB', publicJob.jsonLd.title === dbStored.json_ld.title);
assert('processJobData: expiresAt exposed', 'expiresAt' in publicJob);
assert('processJobData: companyLogoUrl exposed', publicJob.companyLogoUrl === dbStored.company_logo_url);
assert('processJobData: title kept', publicJob.title === dbStored.title);

section('Stage 7: Render (buildJobPostingSchema + buildBreadcrumbSchema)');
const finalSchema = buildJobPostingSchema(publicJob, { siteUrl: 'https://jobsinvizag.in' });
const breadcrumb = buildBreadcrumbSchema(publicJob, { siteUrl: 'https://jobsinvizag.in' });
assert('finalSchema: returns object', !!finalSchema);
assert('finalSchema: prefers stored json_ld title', finalSchema.title === dbStored.json_ld.title);
assert('finalSchema: enriches with canonical url', /\/jobs\/[a-z-]+\/.+/.test(finalSchema.url));
assert(
  'finalSchema: enriches with directApply (because applyLink set)',
  finalSchema.directApply === true,
);
assert('finalSchema: validThrough auto-filled (no expiresAt)', !!finalSchema.validThrough);
assert('breadcrumb: 4 levels', breadcrumb.itemListElement.length === 4);

section('Stage 8: Validate against Google JobPosting spec');
const validationA = validateJobPostingSchema(finalSchema);
printValidationReport('Scenario A — External Gemini-optimized job', validationA);
assert('Scenario A: Google validation PASS', validationA.valid);

// ============================================================================
// SCENARIO B: Employer job (no Gemini, fallback builder)
// ============================================================================

console.log('\n\n=== SCENARIO B: Employer-posted job (no Gemini), fallback path ===');

const employerForm = {
  slug: 'mechanical-engineer-vizag-vhi',
  title: 'Mechanical Engineer',
  company: 'Vizag Heavy Industries',
  location: 'Visakhapatnam',
  category: 'Manufacturing',
  job_type: 'Full-time',
  work_mode: 'On-site',
  experience: '3+ years',
  is_fresher: false,
  salary: '4.5-7 LPA',
  apply_link: 'https://vhi.example/careers/me-001',
  short_description: 'Mechanical engineer for heavy machinery design.',
  description:
    'Vizag Heavy Industries is hiring a Mechanical Engineer. You will design and maintain heavy machinery used in pipeline operations across Andhra Pradesh. Apply now for this opportunity in Visakhapatnam.',
  responsibilities: 'Design heavy machinery\nLead maintenance\nMentor juniors',
  eligibility: 'B.Tech Mechanical\n3+ years experience',
  skills: 'AutoCAD\nSolidWorks\nPiping design',
  posted_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
  source_name: 'Employer Portal',
  source_url: '',
  company_logo_url: 'https://cdn.vhi.example/logo.png',
  status: 'pending',
  is_featured: false,
};

section('Publish (no Gemini json_ld)');
const sanitizedB = sanitizeExternalJobForInsert(employerForm);
const dbRowB = serializeJobForm(sanitizedB, 'published');
assert('publish B: json_ld is null (no Gemini)', dbRowB.json_ld == null);
assert('publish B: status overridden published', dbRowB.status === 'published');
assert('publish B: expires_at preserved', !!dbRowB.expires_at);

section('Fetch + Render (fallback builder kicks in)');
const dbStoredB = JSON.parse(JSON.stringify(dbRowB));
dbStoredB.id = 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee';
const publicJobB = processJobData(dbStoredB, 1);
const schemaB = buildJobPostingSchema(publicJobB, { siteUrl: 'https://jobsinvizag.in' });
const breadcrumbB = buildBreadcrumbSchema(publicJobB, { siteUrl: 'https://jobsinvizag.in' });
assert('fallback B: schema built from columns', !!schemaB);
assert('fallback B: title from column', schemaB.title === 'Mechanical Engineer');
assert('fallback B: description is HTML', /^<p>/.test(schemaB.description));
assert('fallback B: employmentType from job_type', schemaB.employmentType === 'FULL_TIME');
assert(
  'fallback B: validThrough from expires_at',
  new Date(schemaB.validThrough).getTime() ===
    new Date(dbStoredB.expires_at).getTime(),
);
assert('fallback B: baseSalary parsed from "4.5-7 LPA"', schemaB.baseSalary?.currency === 'INR');
assert(
  'fallback B: baseSalary range correct',
  schemaB.baseSalary?.value?.minValue === 450000 &&
    schemaB.baseSalary?.value?.maxValue === 700000,
);
assert(
  'fallback B: hiringOrganization.logo absolute URL',
  /^https?:\/\//.test(schemaB.hiringOrganization?.logo || ''),
);
assert('fallback B: breadcrumb built', !!breadcrumbB);

section('Validate against Google JobPosting spec');
const validationB = validateJobPostingSchema(schemaB);
printValidationReport('Scenario B — Employer fallback job', validationB);
assert('Scenario B: Google validation PASS', validationB.valid);

// ============================================================================
// SCENARIO C: Expired job (should noindex, schema still valid but flagged)
// ============================================================================

console.log('\n\n=== SCENARIO C: Expired job (validThrough in past) ===');

const expiredJob = {
  ...employerForm,
  slug: 'expired-job-test',
  posted_at: '2025-01-01T00:00:00.000Z',
  expires_at: '2025-02-01T00:00:00.000Z',
};

const sanitizedC = sanitizeExternalJobForInsert(expiredJob);
const dbRowC = serializeJobForm(sanitizedC, 'published');
const dbStoredC = JSON.parse(JSON.stringify(dbRowC));
dbStoredC.id = 'cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee';
const publicJobC = processJobData(dbStoredC, 2);

assert('isJobExpired returns true', isJobExpired(publicJobC) === true);
const schemaC = buildJobPostingSchema(publicJobC, { siteUrl: 'https://jobsinvizag.in' });
const validationC = validateJobPostingSchema(schemaC);
printValidationReport('Scenario C — Expired job (schema correctness)', validationC);
assert(
  'Scenario C: schema is structurally valid (only validThrough warning)',
  validationC.errorCount === 0,
);
assert(
  'Scenario C: validThrough warning is the past-date one',
  validationC.warnings.some((w) => /validThrough is in the future/.test(w)),
);

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n=========================================================');
console.log(`SUMMARY: ${totalPass} passed, ${totalFail} failed`);
if (totalFail > 0) {
  console.log('\nFailed assertions:');
  for (const f of failedAssertions) {
    console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ''}`);
  }
  process.exit(1);
}
process.exit(0);
