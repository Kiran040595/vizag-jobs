/**
 * Unit tests for the pure helpers in src/lib/jobFilters.js
 *
 * Run with:  node tests/job-filters.test.mjs
 */

import {
  CATEGORY_OPTIONS,
  DEFAULT_FILTERS,
  FRESHNESS_OPTIONS,
  JOB_TYPE_OPTIONS,
  PAGE_SIZE,
  applyJobFilters,
  buildPaginationItems,
  isAnyFilterActive,
  paginate,
  readFiltersFromSearchParams,
  sortJobsForListing,
  writeFiltersToSearchParams,
} from '../src/lib/jobFilters.js';

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
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label}  (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const section = (name) => trail.push(`\n${name}\n${'-'.repeat(name.length)}`);

const fakeJob = (overrides = {}) => ({
  id: 'j1',
  title: 'Software Engineer',
  company: 'Acme',
  description: 'Build great products',
  shortDescription: '',
  skills: 'react, node',
  location: 'Visakhapatnam',
  experience: '2-4 years',
  isFresher: 'No',
  jobType: 'Full-Time',
  postedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(), // 5h ago
  category: 'IT & Software',
  ...overrides,
});

// ------------------------------------------------------------
section('Sanity: option lists are non-empty and have an "all" entry');
for (const [name, opts] of [
  ['CATEGORY_OPTIONS', CATEGORY_OPTIONS],
  ['JOB_TYPE_OPTIONS', JOB_TYPE_OPTIONS],
  ['FRESHNESS_OPTIONS', FRESHNESS_OPTIONS],
]) {
  ok(Array.isArray(opts) && opts.length > 0, `${name} is a non-empty array`);
  ok(opts.some((o) => o.id === 'all'), `${name} contains 'all'`);
}
eq(PAGE_SIZE, 12, 'PAGE_SIZE is 12');

// ------------------------------------------------------------
section('readFiltersFromSearchParams — defaults & invalid values');
{
  const r = readFiltersFromSearchParams(new URLSearchParams(''));
  eq(r, DEFAULT_FILTERS, 'empty params -> DEFAULT_FILTERS');
}
{
  const r = readFiltersFromSearchParams(
    new URLSearchParams('q=react&category=it&jobType=full-time&freshness=24h&page=3'),
  );
  eq(r, { q: 'react', category: 'it', jobType: 'full-time', freshness: '24h', page: 3 }, 'all params parsed');
}
{
  const r = readFiltersFromSearchParams(
    new URLSearchParams('category=bogus&jobType=bogus&freshness=bogus&page=-2'),
  );
  eq(
    r,
    { q: '', category: 'all', jobType: 'all', freshness: 'all', page: 1 },
    'invalid values fall back to defaults',
  );
}

// ------------------------------------------------------------
section('writeFiltersToSearchParams — defaults are NEVER serialized');
{
  const out = writeFiltersToSearchParams(DEFAULT_FILTERS).toString();
  eq(out, '', 'default filter state -> empty query string');
}
{
  const out = writeFiltersToSearchParams({
    q: '  hello  ',
    category: 'it',
    jobType: 'all',
    freshness: '24h',
    page: 2,
  }).toString();
  ok(out.includes('q=hello'), 'q is trimmed before serializing');
  ok(out.includes('category=it'), 'non-default category is serialized');
  ok(!out.includes('jobType'), 'default jobType is omitted');
  ok(out.includes('freshness=24h'), 'freshness=24h is serialized');
  ok(out.includes('page=2'), 'page=2 is serialized');
}
{
  const out = writeFiltersToSearchParams({ ...DEFAULT_FILTERS, page: 1 }).toString();
  eq(out, '', 'page=1 is omitted (canonical URL has no page param)');
}

// ------------------------------------------------------------
section('isAnyFilterActive');
ok(!isAnyFilterActive(DEFAULT_FILTERS), 'defaults -> not active');
ok(isAnyFilterActive({ ...DEFAULT_FILTERS, q: 'foo' }), 'q -> active');
ok(isAnyFilterActive({ ...DEFAULT_FILTERS, category: 'it' }), 'category -> active');
ok(!isAnyFilterActive({ ...DEFAULT_FILTERS, page: 5 }), 'page change alone -> not active');

// ------------------------------------------------------------
section('applyJobFilters — search text matches title/company/skills/location');
{
  // Note: every fake job overrides skills to avoid the default "react, node"
  // bleeding across cases.
  const jobs = [
    fakeJob({ id: 'a', title: 'React Developer', skills: 'react' }),
    fakeJob({ id: 'b', title: 'Java Backend', skills: 'java, spring' }),
    fakeJob({ id: 'c', title: 'BPO Agent', company: 'CallCo', skills: 'communication' }),
  ];
  const r = applyJobFilters(jobs, { ...DEFAULT_FILTERS, q: 'react' });
  eq(
    r.map((j) => j.id),
    ['a'],
    'search "react" -> only React Developer',
  );
  const r2 = applyJobFilters(jobs, { ...DEFAULT_FILTERS, q: 'CALLCO' });
  eq(
    r2.map((j) => j.id),
    ['c'],
    'search is case-insensitive on company',
  );
  const r3 = applyJobFilters(jobs, { ...DEFAULT_FILTERS, q: 'spring' });
  eq(
    r3.map((j) => j.id),
    ['b'],
    'search matches the skills field',
  );
}

// ------------------------------------------------------------
section('applyJobFilters — freshness window');
{
  const jobs = [
    fakeJob({ id: '5h', postedAt: new Date(Date.now() - 5 * 3_600_000).toISOString() }),
    fakeJob({ id: '2d', postedAt: new Date(Date.now() - 48 * 3_600_000).toISOString() }),
    fakeJob({ id: '40d', postedAt: new Date(Date.now() - 40 * 24 * 3_600_000).toISOString() }),
  ];
  eq(
    applyJobFilters(jobs, { ...DEFAULT_FILTERS, freshness: '24h' }).map((j) => j.id),
    ['5h'],
    'last 24h -> only 5h-old job',
  );
  eq(
    applyJobFilters(jobs, { ...DEFAULT_FILTERS, freshness: '7d' }).map((j) => j.id),
    ['5h', '2d'],
    'last 7d -> 5h and 2d',
  );
  eq(
    applyJobFilters(jobs, { ...DEFAULT_FILTERS, freshness: 'all' }).map((j) => j.id),
    ['5h', '2d', '40d'],
    'anytime -> everything',
  );
}

// ------------------------------------------------------------
section('applyJobFilters — job type tolerates spelling variants');
{
  const jobs = [
    fakeJob({ id: 'a', jobType: 'Full-Time' }),
    fakeJob({ id: 'b', jobType: 'Full Time' }),
    fakeJob({ id: 'c', jobType: 'fulltime' }),
    fakeJob({ id: 'd', jobType: 'Internship' }),
    fakeJob({ id: 'e', jobType: 'Internships' }),
  ];
  eq(
    applyJobFilters(jobs, { ...DEFAULT_FILTERS, jobType: 'full-time' }).map((j) => j.id),
    ['a', 'b', 'c'],
    'full-time matches all three spellings',
  );
  eq(
    applyJobFilters(jobs, { ...DEFAULT_FILTERS, jobType: 'internship' }).map((j) => j.id),
    ['d', 'e'],
    'internship matches plural form too',
  );
}

// ------------------------------------------------------------
section('applyJobFilters — fresher / walk-in categories');
{
  const jobs = [
    fakeJob({ id: 'fr', isFresher: 'Yes', experience: '0-2 years' }),
    fakeJob({ id: 'fr2', isFresher: 'No', experience: 'Fresher / 0-1 yrs' }),
    fakeJob({ id: 'fr3', isFresher: 'No', experience: '0 Years' }),
    fakeJob({ id: 'titleOnly', isFresher: 'No', experience: 'Not specified', title: 'Java Fresher Developer' }),
    fakeJob({ id: 'sr', isFresher: 'No', experience: '5-8 years' }),
    fakeJob({ id: 'ten', isFresher: 'No', experience: '10 years' }),
    fakeJob({ id: 'wi', title: 'Walk-in interview at 9am', isFresher: 'No', experience: '5-8 years' }),
  ];
  const fresherIds = applyJobFilters(jobs, { ...DEFAULT_FILTERS, category: 'fresher' })
    .map((j) => j.id)
    .sort();
  eq(
    fresherIds,
    ['fr', 'fr2', 'fr3', 'titleOnly'].sort(),
    'fresher matches flag, experience 0, or fresher in title',
  );
  ok(!fresherIds.includes('sr'), 'fresher does NOT match a senior with no 0 in experience');
  ok(!fresherIds.includes('ten'), 'fresher does NOT match 10 years via naive zero digit');
  eq(
    applyJobFilters(jobs, { ...DEFAULT_FILTERS, category: 'walk-in' }).map((j) => j.id),
    ['wi'],
    'walk-in matches via title',
  );
}

// ------------------------------------------------------------
section('applyJobFilters — engineering branch categories');
{
  const jobs = [
    fakeJob({ id: 'civil', title: 'Civil Site Engineer', category: 'Construction', skills: '' }),
    fakeJob({ id: 'mech', title: 'Mechanical Maintenance Engineer', category: 'Manufacturing', skills: '' }),
    fakeJob({ id: 'it', title: 'React Developer', category: 'IT', skills: 'react' }),
    fakeJob({ id: 'sales', title: 'Sales Executive', category: 'Sales', skills: 'communication' }),
  ];
  eq(
    applyJobFilters(jobs, { ...DEFAULT_FILTERS, category: 'civil' }).map((j) => j.id),
    ['civil'],
    'civil filter',
  );
  eq(
    applyJobFilters(jobs, { ...DEFAULT_FILTERS, category: 'mechanical' }).map((j) => j.id),
    ['mech'],
    'mechanical filter',
  );
  eq(
    applyJobFilters(jobs, { ...DEFAULT_FILTERS, category: 'engineering' }).map((j) => j.id).sort(),
    ['civil', 'mech'].sort(),
    'engineering includes civil and mechanical',
  );
}

// ------------------------------------------------------------
section('applyJobFilters / sortJobsForListing — featured jobs first');
{
  const olderFeatured = fakeJob({
    id: 'featured-old',
    isFeatured: true,
    postedAt: new Date(Date.now() - 48 * 3_600_000).toISOString(),
  });
  const newerRegular = fakeJob({
    id: 'regular-new',
    isFeatured: false,
    postedAt: new Date(Date.now() - 1 * 3_600_000).toISOString(),
  });
  const newerFeatured = fakeJob({
    id: 'featured-new',
    isFeatured: true,
    postedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  });

  eq(
    applyJobFilters([newerRegular, olderFeatured, newerFeatured], DEFAULT_FILTERS).map((j) => j.id),
    ['featured-new', 'featured-old', 'regular-new'],
    'featured jobs sort above regular, then by postedAt',
  );
  eq(
    sortJobsForListing([newerRegular, olderFeatured]).map((j) => j.id),
    ['featured-old', 'regular-new'],
    'sortJobsForListing pins featured first',
  );
}

// ------------------------------------------------------------
section('paginate');
{
  const list = Array.from({ length: 25 }, (_, i) => ({ id: i }));
  const p1 = paginate(list, 1, 10);
  eq(p1.items.length, 10, 'page 1 has 10 items');
  eq(p1.page, 1, 'page=1');
  eq(p1.totalPages, 3, 'totalPages=3');
  eq(p1.total, 25, 'total=25');
  const p3 = paginate(list, 3, 10);
  eq(p3.items.length, 5, 'page 3 has 5 items');
  const pOver = paginate(list, 99, 10);
  eq(pOver.page, 3, 'page > totalPages clamps to last page');
  const pEmpty = paginate([], 1, 10);
  eq(pEmpty.totalPages, 1, 'empty list still has 1 page (no special-casing)');
  eq(pEmpty.items, [], 'empty list -> empty page');
}

// ------------------------------------------------------------
section('buildPaginationItems — smart truncation');
eq(buildPaginationItems(1, 1), [1], '1 page -> [1]');
eq(buildPaginationItems(3, 5), [1, 2, 3, 4, 5], '<=7 pages -> all numbers');
eq(buildPaginationItems(1, 10), [1, 2, '…', 10], 'page 1 of 10');
eq(buildPaginationItems(5, 10), [1, '…', 4, 5, 6, '…', 10], 'middle page truncates both sides');
eq(buildPaginationItems(10, 10), [1, '…', 9, 10], 'last page of 10');

// ------------------------------------------------------------
console.log(trail.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
