import test from 'node:test';
import assert from 'node:assert/strict';

import { computeSiteStats, formatStatCount } from '../src/lib/siteStats.js';

test('computeSiteStats counts jobs, companies, and recency buckets', () => {
  const now = Date.now();
  const stats = computeSiteStats([
    { company: 'Acme', category: 'IT', postedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
    { company: 'Acme', category: 'Sales', postedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString() },
    { company: 'Beta Corp', category: 'IT', postedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() },
  ]);

  assert.equal(stats.activeJobs, 3);
  assert.equal(stats.companies, 2);
  assert.equal(stats.newThisWeek, 2);
  assert.equal(stats.categories, 2);
  assert.equal(stats.postedToday, 1);
});

test('formatStatCount renders locale numbers and placeholders', () => {
  assert.equal(formatStatCount(1234), '1,234');
  assert.equal(formatStatCount(null), '—');
});
