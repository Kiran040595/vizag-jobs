/**
 * Unit tests for src/lib/jobSourceFilter.js
 *
 * Run with: node tests/job-source-filter.test.mjs
 */

import {
  ADMIN_SOURCE_OPTIONS,
  inferJobAdminSourceId,
  matchesAdminSourceFilter,
  parseSourceFilter,
  toggleAdminSource,
} from '../src/lib/jobSourceFilter.js';

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
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const section = (name) => trail.push(`\n${name}\n${'-'.repeat(name.length)}`);

section('ADMIN_SOURCE_OPTIONS includes expected buckets');
ok(ADMIN_SOURCE_OPTIONS.some((o) => o.id === 'naukri'), 'has naukri');
ok(ADMIN_SOURCE_OPTIONS.some((o) => o.id === 'linkedin_jobs'), 'has linkedin_jobs');
ok(ADMIN_SOURCE_OPTIONS.some((o) => o.id === 'linkedin_posts'), 'has linkedin_posts');

section('inferJobAdminSourceId');
eq(
  inferJobAdminSourceId({
    source: 'naukri.com',
    sourceUrl: 'https://www.naukri.com/job-listings-123',
  }),
  'naukri',
  'naukri.com source_name',
);
eq(
  inferJobAdminSourceId({
    source: 'linkedin.com',
    sourceUrl: 'https://www.linkedin.com/jobs/view/123456',
  }),
  'linkedin_jobs',
  'linkedin job listing URL',
);
eq(
  inferJobAdminSourceId({
    source: 'linkedin.com',
    sourceUrl: 'https://www.linkedin.com/posts/user_activity-123',
  }),
  'linkedin_posts',
  'linkedin post URL',
);
eq(
  inferJobAdminSourceId({
    source: 'indeed.com',
    sourceUrl: 'https://in.indeed.com/viewjob?jk=abc',
  }),
  'indeed',
  'indeed source',
);
eq(
  inferJobAdminSourceId({
    source: 'Admin Post',
    createdBy: null,
  }),
  'admin',
  'manual admin post',
);
eq(
  inferJobAdminSourceId({
    source: '',
    createdBy: '11111111-1111-1111-1111-111111111111',
  }),
  'employer',
  'employer submission',
);

section('parseSourceFilter');
eq(parseSourceFilter('all'), [], 'parse "all" returns empty array');
eq(parseSourceFilter(''), [], 'parse empty string returns empty array');
eq(parseSourceFilter(null), [], 'parse null returns empty array');
eq(parseSourceFilter('naukri'), ['naukri'], 'parse single valid source');
eq(parseSourceFilter('naukri,indeed'), ['naukri', 'indeed'], 'parse comma-separated string');
eq(parseSourceFilter(['naukri', 'indeed']), ['naukri', 'indeed'], 'parse array of sources');
eq(parseSourceFilter(['naukri,indeed', 'admin']), ['naukri', 'indeed', 'admin'], 'parse nested comma in array');
eq(parseSourceFilter('naukri,invalid_source,indeed,all'), ['naukri', 'indeed'], 'ignores invalid IDs and "all"');
eq(parseSourceFilter('naukri,naukri,indeed'), ['naukri', 'indeed'], 'deduplicates entries');

section('toggleAdminSource');
eq(toggleAdminSource([], 'naukri'), ['naukri'], 'selecting first source when empty');
eq(toggleAdminSource(['naukri'], 'indeed'), ['naukri', 'indeed'], 'selecting second source');
eq(toggleAdminSource(['naukri', 'indeed'], 'naukri'), ['indeed'], 'deselecting an existing source');
eq(toggleAdminSource(['naukri'], 'naukri'), [], 'deselecting sole source returns empty array');
eq(toggleAdminSource(['naukri', 'indeed'], 'all'), [], 'clicking "all" clears all active sources');
eq(
  toggleAdminSource(['naukri', 'linkedin_jobs'], 'linkedin'),
  ['naukri', 'linkedin'],
  'selecting umbrella linkedin removes linkedin_jobs',
);
eq(
  toggleAdminSource(['naukri', 'linkedin'], 'linkedin_jobs'),
  ['naukri', 'linkedin_jobs'],
  'selecting linkedin_jobs removes umbrella linkedin',
);

section('matchesAdminSourceFilter');
ok(
  matchesAdminSourceFilter(
    { source: 'naukri.com', sourceUrl: 'https://www.naukri.com/x' },
    'all',
  ),
  'all matches everything',
);
ok(
  matchesAdminSourceFilter(
    { source: 'naukri.com', sourceUrl: 'https://www.naukri.com/x' },
    'naukri',
  ),
  'naukri filter matches naukri job',
);
ok(
  !matchesAdminSourceFilter(
    { source: 'naukri.com', sourceUrl: 'https://www.naukri.com/x' },
    'linkedin_jobs',
  ),
  'linkedin_jobs filter excludes naukri',
);
ok(
  matchesAdminSourceFilter(
    { source: 'linkedin.com', sourceUrl: 'https://www.linkedin.com/jobs/view/1' },
    'linkedin',
  ),
  'linkedin umbrella matches linkedin jobs',
);
ok(
  matchesAdminSourceFilter(
    { source: 'linkedin.com', sourceUrl: 'https://www.linkedin.com/posts/x' },
    'linkedin',
  ),
  'linkedin umbrella matches linkedin posts',
);
ok(
  matchesAdminSourceFilter(
    { source: 'naukri.com', sourceUrl: 'https://www.naukri.com/x' },
    'naukri,indeed',
  ),
  'comma-separated multi-source matches naukri job',
);
ok(
  matchesAdminSourceFilter(
    { source: 'indeed.com', sourceUrl: 'https://in.indeed.com/viewjob?jk=abc' },
    ['naukri', 'indeed'],
  ),
  'array multi-source matches indeed job',
);
ok(
  !matchesAdminSourceFilter(
    { source: 'Admin Post', createdBy: null },
    ['naukri', 'indeed'],
  ),
  'multi-source excludes non-matching admin job',
);

console.log(trail.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
