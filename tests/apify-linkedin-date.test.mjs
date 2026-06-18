import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const APIFY_SRC = path.join(repoRoot, 'supabase', 'functions', 'fetch-external-jobs', 'apify-linkedin.ts');
const INDEX_SRC = path.join(repoRoot, 'supabase', 'functions', 'fetch-external-jobs', 'index.ts');
const FIXTURE = path.join(repoRoot, 'tests', 'fixtures', 'apify-linkedin-curious-coder-item.json');

const MS_24H = 24 * 60 * 60 * 1000;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseCalendarDateOnlyAsIstEnd(isoDate) {
  const d = new Date(`${isoDate}T23:59:59.999+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseApifyDate(value, referenceIso) {
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    if (DATE_ONLY_RE.test(trimmed)) {
      return parseCalendarDateOnlyAsIstEnd(trimmed);
    }
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function parsePostedAt(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (DATE_ONLY_RE.test(trimmed)) {
    const t = Date.parse(`${trimmed}T23:59:59.999+05:30`);
    return Number.isNaN(t) ? null : t;
  }
  const t = Date.parse(trimmed);
  return Number.isNaN(t) ? null : t;
}

function isPostedWithinCutoff(postedAt, cutoffMs) {
  const ts = parsePostedAt(postedAt ?? null);
  return ts !== null && ts >= cutoffMs;
}

function firstString(obj, keys) {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function apifyItemsToLinkedInJobs(items, scrapedAt, listingUrl) {
  const jobs = [];
  for (const item of items) {
    const title = firstString(item, ['title', 'jobTitle']) ?? null;
    if (!title) continue;
    const posted_at =
      parseApifyDate(item.postedAt ?? item.posted_at, scrapedAt) ?? scrapedAt;
    jobs.push({
      title,
      company: firstString(item, ['companyName', 'company']) ?? 'Unknown',
      posted_at,
      from_linkedin_content_24h: true,
      source_kind: 'linkedin_job',
      description_markdown: firstString(item, ['descriptionText', 'description']) ?? '',
    });
  }
  return jobs;
}

const FETCH_INSTANT = '2026-06-18T02:31:46.731Z';
const CUTOFF = Date.parse(FETCH_INSTANT) - MS_24H;
const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

let failures = 0;
const run = (label, fn) => {
  try {
    fn();
    console.log(`  OK    ${label}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL  ${label} — ${err.message}`);
  }
};

console.log('\nSource landmarks');
const apifySrc = fs.readFileSync(APIFY_SRC, 'utf8');
const indexSrc = fs.readFileSync(INDEX_SRC, 'utf8');

run('apify-linkedin parses date-only as IST end of day', () => {
  assert.ok(/T23:59:59\.999\+05:30/.test(apifySrc));
});
run('index parsePostedAt handles date-only', () => {
  assert.ok(/T23:59:59\.999\+05:30/.test(indexSrc));
});
run('apifyLinkedInJobsOnly skip-scrape branch exists', () => {
  assert.ok(/apifyLinkedInJobsOnly/.test(indexSrc));
});

console.log('\nDate-only postedAt within 24h (user repro)');
run('midnight UTC would fail 24h filter', () => {
  const midnight = Date.parse('2026-06-17');
  assert.ok(midnight < CUTOFF, 'midnight UTC should be older than cutoff');
});
run('IST end-of-day passes 24h filter', () => {
  const iso = parseApifyDate('2026-06-17', FETCH_INSTANT);
  assert.ok(isPostedWithinCutoff(iso, CUTOFF), `expected within 24h, got ${iso}`);
});
run('fixture maps to job that passes 24h filter', () => {
  const jobs = apifyItemsToLinkedInJobs([fixture], FETCH_INSTANT, 'https://example.com');
  assert.equal(jobs.length, 1);
  assert.ok(isPostedWithinCutoff(jobs[0].posted_at, CUTOFF));
});

console.log('\n----');
if (failures === 0) {
  console.log('apify-linkedin-date.test.mjs: OK');
  process.exit(0);
} else {
  console.log(`${failures} test(s) FAILED.`);
  process.exit(1);
}
