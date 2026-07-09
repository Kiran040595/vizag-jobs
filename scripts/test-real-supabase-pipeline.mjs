// Real-Supabase smoke test:
// Fetches actual published jobs from the project's Supabase, runs them through
// the same processJobData + buildJobPostingSchema chain the front-end uses,
// and validates each against the Google JobPosting spec.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildJobPostingSchema, isJobExpired } from '../src/lib/jobPostingSchema.js';
import {
  validateJobPostingSchema,
  printValidationReport,
} from './google-jobposting-validator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const loadEnv = (file) => {
  const fp = path.join(projectRoot, file);
  if (!fs.existsSync(fp)) return {};
  return fs
    .readFileSync(fp, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return env;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return env;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      env[key] = value;
      return env;
    }, {});
};

const env = { ...loadEnv('.env'), ...loadEnv('.env.local'), ...process.env };

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const JOBS_TABLE = env.VITE_SUPABASE_JOBS_TABLE || 'jobs';
const SAMPLE_LIMIT = Number(process.env.SAMPLE_LIMIT || 5);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

console.log(`Supabase: ${SUPABASE_URL}`);
console.log(`Table:    ${JOBS_TABLE}`);
console.log(`Limit:    ${SAMPLE_LIMIT} most recent published jobs\n`);

// Mirror of processJobData (src/services/jobs.js)
const joinList = (value) =>
  Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value || '');
const normalizeFresherValue = (v) => (v ? 'Yes' : 'No');

const processJobData = (job, index = 0) => {
  const category = String(job.category || '');
  const jobType = String(job.job_type || '');
  const isFresher = normalizeFresherValue(job.is_fresher);
  const fresherTag = isFresher === 'Yes' ? 'Fresher' : 'Experienced';
  return {
    id: job.id || `job-${index + 1}`,
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

const fetchPublishedJobs = async () => {
  const params = new URLSearchParams({
    select: '*',
    status: 'eq.published',
    order: 'posted_at.desc',
    limit: String(SAMPLE_LIMIT),
  });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${JOBS_TABLE}?${params}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase REST returned ${res.status}: ${body}`);
  }
  return res.json();
};

const checkColumnExistence = async () => {
  // Use OpenAPI introspection via PostgREST: select=json_ld&limit=0 returns 200
  // if the column exists, 400/404 otherwise.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${JOBS_TABLE}?select=json_ld,seo_meta&limit=0`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );
  return res.ok;
};

let totalPass = 0;
let totalFail = 0;

const assert = (label, condition, detail) => {
  if (condition) {
    totalPass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    totalFail += 1;
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
};

console.log('--- Schema column check (json_ld, seo_meta) ---');
const columnsExist = await checkColumnExistence();
if (columnsExist) {
  assert('Migration applied: json_ld + seo_meta columns exist', true);
} else {
  console.log(
    '  WARN  json_ld / seo_meta columns NOT yet present in Supabase',
  );
  console.log(
    '        Run supabase/migrations/20260524_add_jobs_json_ld_seo.sql in Supabase SQL Editor.',
  );
  console.log('        Continuing test using fallback schema builder only.\n');
}

console.log('--- Fetching real published jobs ---');
let jobs;
try {
  jobs = await fetchPublishedJobs();
  console.log(`  Fetched ${jobs.length} jobs.\n`);
} catch (err) {
  console.error(`  Failed: ${err.message}`);
  process.exit(1);
}

if (jobs.length === 0) {
  console.log('  No published jobs in Supabase. Test cannot validate real data.');
  process.exit(0);
}

let withStoredSchema = 0;
let withoutStoredSchema = 0;
let allValid = true;
const validationSummary = [];

for (let i = 0; i < jobs.length; i += 1) {
  const raw = jobs[i];
  const slug = raw.slug || raw.id;
  console.log(`\n=== Job ${i + 1}/${jobs.length}: ${raw.title} (${slug}) ===`);
  console.log(`  Company:   ${raw.company}`);
  console.log(`  Posted:    ${raw.posted_at}`);
  console.log(`  Source:    ${raw.source_name || 'employer/admin'}`);
  console.log(`  Has json_ld: ${raw.json_ld ? 'yes' : 'no (will use fallback)'}`);
  console.log(`  Has seo_meta: ${raw.seo_meta ? 'yes' : 'no'}`);

  if (raw.json_ld) withStoredSchema += 1;
  else withoutStoredSchema += 1;

  const publicJob = processJobData(raw, i);
  const schema = buildJobPostingSchema(publicJob, {
    siteUrl: 'https://jobsinvizag.in',
  });

  if (!schema) {
    console.log('  ERROR: buildJobPostingSchema returned null (missing required fields)');
    totalFail += 1;
    allValid = false;
    continue;
  }

  const validation = validateJobPostingSchema(schema);
  validationSummary.push({
    slug,
    title: raw.title,
    valid: validation.valid,
    errors: validation.errorCount,
    warnings: validation.warningCount,
  });

  printValidationReport(`${raw.title}`, validation);

  if (!validation.valid) {
    allValid = false;
    totalFail += 1;
  } else {
    totalPass += 1;
  }

  if (isJobExpired(publicJob)) {
    console.log('    [INFO] Job is expired -- middleware will emit noindex meta tag.');
  }
}

console.log('\n=========================================================');
console.log('REAL DATA SUMMARY');
console.log('=========================================================');
console.log(`  Jobs scanned:          ${jobs.length}`);
console.log(`  With stored json_ld:   ${withStoredSchema}`);
console.log(`  Using fallback schema: ${withoutStoredSchema}`);
console.log(`  Valid:                 ${validationSummary.filter((v) => v.valid).length}`);
console.log(`  Invalid:               ${validationSummary.filter((v) => !v.valid).length}`);
console.log('');
console.log('  Per-job:');
for (const v of validationSummary) {
  const status = v.valid ? 'VALID  ' : 'INVALID';
  console.log(`    [${status}] ${v.errors} err, ${v.warnings} warn  -- ${v.title}`);
}

console.log('');
console.log(`  Final: ${totalPass} pass, ${totalFail} fail`);

if (!allValid) {
  process.exit(1);
}
process.exit(0);
