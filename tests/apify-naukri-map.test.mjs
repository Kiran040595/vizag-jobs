import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const SRC = path.join(repoRoot, 'supabase', 'functions', 'fetch-external-jobs', 'apify-naukri.ts');
const FIXTURE = path.join(repoRoot, 'tests', 'fixtures', 'apify-naukri-api-empire-item.json');

const NAUKRI_VIZAG_RE = /\b(visakhapatnam|vishakhapatnam|vizag)\b/i;

function isNaukriVizagJob(job) {
  const location = job.location?.trim() ?? '';
  if (location) {
    return NAUKRI_VIZAG_RE.test(location);
  }
  const url = (job.apply_url ?? job.source_url ?? '').toLowerCase();
  if (!url.includes('naukri.com')) return false;
  if (NAUKRI_VIZAG_RE.test(url)) return true;
  if (/-(?:hyderabad|bangalore|bengaluru|chennai|mumbai|pune|delhi)-\d{9,}/i.test(url)) {
    return false;
  }
  return false;
}

// Node-port of apify-naukri mapping (keep in sync with apify-naukri.ts)
function firstString(obj, keys) {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function parseApifyDate(value, referenceIso) {
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function isUsableNaukriTitle(title) {
  if (!title?.trim()) return false;
  const low = title.trim().toLowerCase();
  return low.length >= 3 && low !== 'job description';
}

function normalizeNaukriJobUrl(raw) {
  if (!raw?.trim()) return null;
  try {
    return new URL(raw.trim()).href;
  } catch {
    return null;
  }
}

function parseSkillsBlob(raw) {
  if (!raw?.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function naukriJobRecordFromFlat(flat, scrapedAt, fallbackSearchUrl) {
  const title = firstString(flat, ['title', 'jobTitle']) ?? null;
  if (!isUsableNaukriTitle(title)) return null;
  const company = firstString(flat, ['companyName', 'company']) ?? 'Unknown';
  const applyUrl = normalizeNaukriJobUrl(firstString(flat, ['link', 'jdURL', 'jobUrl']));
  const description = firstString(flat, ['jobDescription', 'description']) ?? '';
  const posted_at = parseApifyDate(flat.createdDate ?? flat.postedDate ?? flat.postedAt, scrapedAt);
  const sourceUrl = applyUrl ?? fallbackSearchUrl;
  return {
    title,
    company,
    location: firstString(flat, ['location']) ?? undefined,
    apply_url: applyUrl ?? sourceUrl,
    source_url: sourceUrl,
    source_name: 'naukri.com',
    posted_at,
    description_markdown: description,
    source_kind: 'naukri',
    skills: Array.isArray(flat.skills)
      ? flat.skills
      : parseSkillsBlob(firstString(flat, ['tagsAndSkills'])),
    salary: firstString(flat, ['salary']),
  };
}

function apifyItemsToNaukriJobs(items, scrapedAt, fallbackSearchUrl) {
  const jobs = [];
  for (const item of items) {
    const details = item.jobDetails && typeof item.jobDetails === 'object' ? item.jobDetails : item;
    const record = naukriJobRecordFromFlat(details, scrapedAt, fallbackSearchUrl);
    if (record && isNaukriVizagJob(record)) jobs.push(record);
  }
  return jobs;
}

const sourceText = fs.readFileSync(SRC, 'utf8');
assert.match(sourceText, /dineshwadhwani~naukri-job-scrapper/);
assert.match(sourceText, /APIFY_API_TOKEN_NAUKRI/);
assert.match(sourceText, /roles:\s*\[\s*'Associate',\s*'Executive',\s*'Manager'\s*\]/);
assert.match(sourceText, /locations:\s*\[\s*'Visakhapatnam'\s*\]/);
assert.match(sourceText, /isNaukriVizagJob/);
assert.match(sourceText, /prioritizeNaukriJobsByExperience/);
assert.match(sourceText, /naukriApifyScrapePoolSize/);

const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const scrapedAt = '2026-06-17T12:00:00.000Z';
const hub = 'https://www.naukri.com/jobs-in-visakhapatnam?jobAge=1';
const jobs = apifyItemsToNaukriJobs([fixture], scrapedAt, hub);

assert.equal(jobs.length, 1);
assert.equal(jobs[0].title, 'Software Engineer');
assert.equal(jobs[0].company, 'Infosys');
assert.equal(jobs[0].location, 'Visakhapatnam');
assert.equal(jobs[0].source_kind, 'naukri');
assert.equal(jobs[0].posted_at, '2026-06-17T08:14:11.000Z');
assert.ok(jobs[0].apply_url.includes('job-listings-software-engineer'));
assert.deepEqual(jobs[0].skills, ['Java', 'Spring Boot', 'Microservices']);

const dineshItem = {
  jobId: '4426507200',
  title: 'Account Executive',
  company: 'Acme Corp',
  location: 'Visakhapatnam',
  experience: '0-2 Yrs',
  salary: '3-5 Lakhs',
  skills: ['Sales', 'Communication'],
  postedAt: '2026-07-28',
  link: 'https://www.naukri.com/job-listings-account-executive-acme-visakhapatnam-4426507200',
};
const dineshJobs = apifyItemsToNaukriJobs([dineshItem], scrapedAt, hub);
assert.equal(dineshJobs.length, 1);
assert.ok(dineshJobs[0].apply_url.includes('job-listings-account-executive'));
assert.deepEqual(dineshJobs[0].skills, ['Sales', 'Communication']);

assert.equal(isNaukriVizagJob(jobs[0]), true);
assert.equal(
  isNaukriVizagJob({
    location: 'Hyderabad',
    source_url: 'https://www.naukri.com/job-listings-dev-tcs-hyderabad-140526018212',
  }),
  false,
);
assert.equal(
  isNaukriVizagJob({
    location: 'Hyderabad, Visakhapatnam',
    source_url: 'https://www.naukri.com/job-listings-dev-tcs-hyderabad-140526018212',
  }),
  true,
);
assert.equal(
  isNaukriVizagJob({
    source_url:
      'https://www.naukri.com/job-listings-software-engineer-infosys-visakhapatnam-140526018212',
  }),
  true,
);

// Hyderabad-only row should be dropped during mapping
const hyderabadFixture = {
  jobDetails: {
    title: 'Java Developer',
    companyName: 'TCS',
    location: 'Hyderabad',
    jdURL: 'https://www.naukri.com/job-listings-java-developer-tcs-hyderabad-140526018999',
    createdDate: '2026-06-17T08:14:11.000Z',
  },
};
const mixed = apifyItemsToNaukriJobs([fixture, hyderabadFixture], scrapedAt, hub);
assert.equal(mixed.length, 1);
assert.equal(mixed[0].company, 'Infosys');

console.log('apify-naukri-map.test.mjs: OK');
