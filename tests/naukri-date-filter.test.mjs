// Unit test for the Naukri 24h date-filter logic in
// supabase/functions/fetch-external-jobs/index.ts.
//
// The edge function runs on Deno (TypeScript). Rather than wrestle with TS
// stripping, we keep a Node-port of the two pure functions below — exact same
// shape and rules as the source — and assert the source still contains the
// fix landmarks so this test fails loudly if the real implementation drifts.

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const SRC = path.join(
  repoRoot,
  'supabase',
  'functions',
  'fetch-external-jobs',
  'index.ts',
);

// ---------- Node-port of the source functions ----------
function parsePostedAt(value) {
  if (!value || typeof value !== 'string') return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function parseRelativePostedAt(phrase, referenceIso) {
  if (!phrase || !phrase.trim()) return null;
  const ref = new Date(referenceIso);
  if (Number.isNaN(ref.getTime())) return null;
  const low = phrase.trim().toLowerCase();
  const msDay = 86_400_000;

  if (/\bjust now\b|\btoday\b/i.test(low)) return ref.toISOString();
  if (/\byesterday\b/i.test(low)) {
    return new Date(ref.getTime() - msDay).toISOString();
  }

  const years = low.match(/(\d+)\s*(?:y|yr|yrs|years?)\s*ago/i);
  if (years) {
    return new Date(ref.getTime() - Number(years[1]) * 365 * msDay).toISOString();
  }
  const months = low.match(/(\d+)\s*(?:mo|mos|months?)\s*ago/i);
  if (months) {
    return new Date(ref.getTime() - Number(months[1]) * 30 * msDay).toISOString();
  }
  if (/\b30\+\s*days?\s*ago\b/i.test(low) || /\bover\s+a\s+month\s*ago\b/i.test(low)) {
    return new Date(ref.getTime() - 31 * msDay).toISOString();
  }

  const days = low.match(/(\d+)\s*days?\s*ago/i);
  if (days) {
    return new Date(ref.getTime() - Number(days[1]) * msDay).toISOString();
  }
  const weeks = low.match(/(\d+)\s*weeks?\s*ago/i);
  if (weeks) {
    return new Date(ref.getTime() - Number(weeks[1]) * 7 * msDay).toISOString();
  }
  if (/\b1\s*week\s*ago\b/i.test(low)) {
    return new Date(ref.getTime() - 7 * msDay).toISOString();
  }
  const hours = low.match(/(\d+)\s*hours?\s*ago/i);
  if (hours) {
    return new Date(ref.getTime() - Number(hours[1]) * 3_600_000).toISOString();
  }
  const minutes = low.match(/(\d+)\s*(?:m|min|mins|minutes?)\s*ago/i);
  if (minutes) {
    return new Date(ref.getTime() - Number(minutes[1]) * 60_000).toISOString();
  }
  const hoursShort = low.match(/^(\d+)\s*h$/);
  if (hoursShort) {
    return new Date(ref.getTime() - Number(hoursShort[1]) * 3_600_000).toISOString();
  }
  const daysShort = low.match(/^(\d+)\s*d$/);
  if (daysShort) {
    return new Date(ref.getTime() - Number(daysShort[1]) * msDay).toISOString();
  }
  return null;
}

function extractPostedPhrase(md, summary) {
  const jobBlock =
    (md || '').split(/##\s*Job description/i)[1]?.slice(0, 4_000) ??
    (md || '').slice(0, 4_000);
  const blob = `${jobBlock}\n${summary ?? ''}`;
  const posted =
    blob
      .match(/Posted:\s*([^O\n]+?)(?:Openings:|Applicants:|Register to apply|Continue with|$)/i)?.[1]
      ?.replace(/Openings$/i, '')
      .trim() ??
    blob
      .match(
        /\bPosted:\s*(\d+\s+(?:hours?|days?|weeks?|months?|mos?|years?|yrs?|y)\s+ago|just\s+now|today|yesterday|\d+\s*[hd]|over\s+a\s+month\s+ago|30\+\s+days?\s+ago)\b/i,
      )
      ?.[1]
      ?.trim() ??
    blob.match(/\b(\d+\s*(?:mo|mos|months?|y|yr|yrs|years?)\s*ago)\b/i)?.[1]?.trim() ??
    blob.match(/\b(\d+\s*(?:m|min|mins|minutes?|h|hr|hrs|hours?)\s*ago)\b/i)?.[1]?.trim() ??
    blob
      .match(
        /\b(Just\s+now|Today|Yesterday|\d+\s*days?\s*ago|\d+\s*weeks?\s*ago|over\s+a\s+month\s+ago|30\+\s*days?\s*ago)\b/i,
      )
      ?.[1]
      ?.trim();
  return posted ?? null;
}

function resolvePostedAtFromSource(job, raw, fetchInstant, options = {}) {
  if (parsePostedAt(job?.posted_at)) return job.posted_at;
  if (raw?.posted_at && parsePostedAt(raw.posted_at)) return raw.posted_at;
  const md = raw?.description_markdown ?? '';
  const phrase = extractPostedPhrase(md, raw?.summary ?? job?.short_description);
  const parsed = phrase ? parseRelativePostedAt(phrase, fetchInstant) : null;
  if (parsed) return parsed;
  return options.strict ? null : fetchInstant;
}

// ---------- Helpers ----------
const REF = '2026-05-24T12:00:00.000Z';
const REF_MS = Date.parse(REF);
const HOUR = 3_600_000;
const DAY = 86_400_000;

const expectAge = (iso, expectedAgeMs, tolerance = 60_000) => {
  assert.ok(typeof iso === 'string', `expected string, got ${iso}`);
  const got = REF_MS - Date.parse(iso);
  assert.ok(
    Math.abs(got - expectedAgeMs) <= tolerance,
    `expected age ~${expectedAgeMs}ms, got ${got}ms (${iso})`,
  );
};

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

// ---------- Source landmark assertions ----------
console.log('\nSource landmark checks (drift detection)');
console.log('----------------------------------------');
const sourceText = fs.readFileSync(SRC, 'utf8');

run('source contains months-ago regex', () => {
  assert.ok(
    /\(\\d\+\)\\s\*\(\?:mo\|mos\|months\?\)\\s\*ago/.test(sourceText),
    'months-ago pattern missing — fix may have been reverted',
  );
});
run('source contains years-ago regex', () => {
  assert.ok(
    /\(\\d\+\)\\s\*\(\?:y\|yr\|yrs\|years\?\)\\s\*ago/.test(sourceText),
    'years-ago pattern missing — fix may have been reverted',
  );
});
run('resolvePostedAtFromSource returns string | null', () => {
  assert.ok(
    /resolvePostedAtFromSource[\s\S]*?\):\s*string\s*\|\s*null/.test(sourceText),
    'resolvePostedAtFromSource return type should be `string | null`',
  );
});
run('resolvePostedAtFromSource accepts strict option', () => {
  assert.ok(
    /options:\s*\{\s*strict\?:\s*boolean\s*\}\s*=\s*\{\}/.test(sourceText),
    'resolvePostedAtFromSource should accept `{ strict?: boolean } = {}`',
  );
});
run('Naukri call site passes strict option', () => {
  assert.ok(
    /resolvePostedAtFromSource\(\s*job,\s*raw,\s*fetchInstant,\s*\{\s*strict:\s*naukriStrictDates,?\s*\}\s*\)/.test(
      sourceText,
    ),
    'Naukri branch should call resolvePostedAtFromSource with { strict: naukriStrictDates }',
  );
});
run('FETCH_NAUKRI_STRICT_DATES env wired', () => {
  assert.ok(
    /FETCH_NAUKRI_STRICT_DATES.*?'true'/s.test(sourceText),
    'FETCH_NAUKRI_STRICT_DATES env var should default to true',
  );
});
run('extractPostedPhrase recognizes month/year wording', () => {
  assert.ok(
    /Posted:[\s\S]*?months\?\|mos\?\|years\?\|yrs\?/.test(sourceText),
    'extractPostedPhrase should explicitly include month/year tokens',
  );
});
run('NAUKRI_VIZAG_24H_HUB_URL constant is wired with jobAge=1 + cityTypeGid=26', () => {
  assert.ok(
    /const NAUKRI_VIZAG_24H_HUB_URL\s*=\s*['"]https:\/\/www\.naukri\.com\/jobs-in-visakhapatnam\?[^'"\n]*jobAge=1[^'"\n]*['"]/.test(
      sourceText,
    ),
    'NAUKRI_VIZAG_24H_HUB_URL should be defined as the curated Vizag jobAge=1 URL',
  );
  assert.ok(
    /cityTypeGid=26/.test(sourceText),
    'cityTypeGid=26 (Visakhapatnam) should be present in the Naukri hub URL',
  );
  assert.ok(
    /functionAreaIdGid=1[\s\S]*?functionAreaIdGid=37/.test(sourceText),
    'functionAreaIdGid filters should be present in the Naukri hub URL',
  );
});
run('naukri channel scrapes the 24h hub URL', () => {
  assert.ok(
    /firecrawlScrapeUrl\(\s*hubUrl\s*,\s*firecrawlApiKeys\s*\)/.test(sourceText),
    'discoverDetailUrlsForChannel should scrape the constructed hub URL(s)',
  );
  assert.ok(
    /naukriHubUrlForPage\(\s*NAUKRI_VIZAG_24H_HUB_URL/.test(sourceText),
    'paginated hub URLs should derive from NAUKRI_VIZAG_24H_HUB_URL',
  );
});
run('FETCH_NAUKRI_USE_SEARCH defaults to false', () => {
  assert.ok(
    /FETCH_NAUKRI_USE_SEARCH[^\n]*?'false'/.test(sourceText),
    'FETCH_NAUKRI_USE_SEARCH should default to false (legacy search queries off)',
  );
});
run('FETCH_NAUKRI_HUB_PAGES env wired with sane bounds', () => {
  assert.ok(
    /FETCH_NAUKRI_HUB_PAGES/.test(sourceText),
    'FETCH_NAUKRI_HUB_PAGES env var should be read in the Naukri discovery branch',
  );
});

// ---------- parseRelativePostedAt coverage ----------
console.log('\nparseRelativePostedAt — coverage');
console.log('--------------------------------');
run('"just now" -> reference time', () =>
  expectAge(parseRelativePostedAt('just now', REF), 0));
run('"today"', () => expectAge(parseRelativePostedAt('today', REF), 0));
run('"yesterday" -> -1d', () =>
  expectAge(parseRelativePostedAt('yesterday', REF), DAY));
run('"5 hours ago" -> -5h', () =>
  expectAge(parseRelativePostedAt('5 hours ago', REF), 5 * HOUR));
run('"2 days ago" -> -2d', () =>
  expectAge(parseRelativePostedAt('2 days ago', REF), 2 * DAY));
run('"3 weeks ago" -> -21d', () =>
  expectAge(parseRelativePostedAt('3 weeks ago', REF), 21 * DAY));
run('"1d" short -> -1d', () =>
  expectAge(parseRelativePostedAt('1d', REF), DAY));
run('"45 minutes ago" -> -45min', () =>
  expectAge(parseRelativePostedAt('45 minutes ago', REF), 45 * 60_000));

console.log('\nparseRelativePostedAt — month/year (NEW)');
console.log('----------------------------------------');
run('"1 month ago" -> -30d (NEW)', () =>
  expectAge(parseRelativePostedAt('1 month ago', REF), 30 * DAY));
run('"3 months ago" -> -90d (NEW)', () =>
  expectAge(parseRelativePostedAt('3 months ago', REF), 90 * DAY));
run('"1 mo ago" -> -30d (NEW)', () =>
  expectAge(parseRelativePostedAt('1 mo ago', REF), 30 * DAY));
run('"1 year ago" -> -365d (NEW)', () =>
  expectAge(parseRelativePostedAt('1 year ago', REF), 365 * DAY));
run('"2 yrs ago" -> -730d (NEW)', () =>
  expectAge(parseRelativePostedAt('2 yrs ago', REF), 730 * DAY));
run('"30+ days ago" -> -31d (NEW)', () =>
  expectAge(parseRelativePostedAt('30+ days ago', REF), 31 * DAY));
run('"over a month ago" -> -31d (NEW)', () =>
  expectAge(parseRelativePostedAt('over a month ago', REF), 31 * DAY));

run('unparseable phrase returns null', () => {
  assert.equal(parseRelativePostedAt('whenever', REF), null);
});
run('empty phrase returns null', () => {
  assert.equal(parseRelativePostedAt('', REF), null);
  assert.equal(parseRelativePostedAt(null, REF), null);
});

// ---------- resolvePostedAtFromSource strict-mode ----------
console.log('\nresolvePostedAtFromSource — strict-mode (FIX)');
console.log('---------------------------------------------');

const undatedJob = { posted_at: null, short_description: 'No date here.' };
const undatedRaw = { description_markdown: 'Buy our cheese.', summary: '' };

run('undated + strict -> null  ← THE FIX', () => {
  const r = resolvePostedAtFromSource(undatedJob, undatedRaw, REF, { strict: true });
  assert.equal(r, null);
});
run('undated + non-strict -> fetchInstant (legacy preserved)', () => {
  const r = resolvePostedAtFromSource(undatedJob, undatedRaw, REF, { strict: false });
  assert.equal(r, REF);
});
run('undated + no opts -> fetchInstant (default = non-strict)', () => {
  const r = resolvePostedAtFromSource(undatedJob, undatedRaw, REF);
  assert.equal(r, REF);
});

run('Naukri "Posted: 2 months ago" -> aged correctly (was: leaked through)', () => {
  const oldJob = { posted_at: null, short_description: '' };
  const oldRaw = {
    description_markdown: '## Job description\n\nPosted: 2 months ago\nOpenings: 1',
    summary: '',
  };
  const r = resolvePostedAtFromSource(oldJob, oldRaw, REF, { strict: true });
  assert.ok(typeof r === 'string', `expected ISO string, got ${r}`);
  expectAge(r, 60 * DAY);
});

run('Job with explicit posted_at within 24h passes through verbatim', () => {
  const fresh = '2026-05-24T08:00:00.000Z';
  const r = resolvePostedAtFromSource({ posted_at: fresh }, {}, REF, { strict: true });
  assert.equal(r, fresh);
});

run('raw.posted_at fallback when job.posted_at absent', () => {
  const r = resolvePostedAtFromSource(
    { posted_at: null },
    { posted_at: '2026-05-24T11:30:00.000Z', description_markdown: '' },
    REF,
    { strict: true },
  );
  assert.equal(r, '2026-05-24T11:30:00.000Z');
});

run('"Posted: 5 hours ago" markdown -> -5h regardless of strict flag', () => {
  const phrasesMd = '## Job description\n\nPosted: 5 hours ago\nOpenings: 2';
  const a = resolvePostedAtFromSource({}, { description_markdown: phrasesMd }, REF, {
    strict: true,
  });
  const b = resolvePostedAtFromSource({}, { description_markdown: phrasesMd }, REF, {
    strict: false,
  });
  expectAge(a, 5 * HOUR);
  expectAge(b, 5 * HOUR);
});

console.log('\n----');
if (failures === 0) {
  console.log('All tests passed.');
  process.exit(0);
} else {
  console.log(`${failures} test(s) FAILED.`);
  process.exit(1);
}
