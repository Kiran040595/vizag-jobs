import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCompanyScrapeUpdateBatches,
  getBulkScrapeSelection,
  updateCompanyScrapeFlags,
} from '../src/lib/companyBulkScraperSelection.js';

const companies = [
  { name: 'Pfizer', careersUrl: 'https://example.com/pfizer', isActiveForScrape: false },
  { name: 'Conduent', careersUrl: 'https://example.com/conduent', isActiveForScrape: false },
  { name: 'Missing Portal', careersUrl: '', isActiveForScrape: false },
];

test('bulk scraper ON targets selected companies with careers URLs and reports skipped companies', () => {
  const result = getBulkScrapeSelection(
    companies,
    ['Pfizer', 'Missing Portal'],
    true,
  );

  assert.deepEqual(result.targets.map((company) => company.name), ['Pfizer']);
  assert.deepEqual(result.skippedMissingCareersUrl.map((company) => company.name), ['Missing Portal']);
});

test('bulk scraper OFF targets every selected company', () => {
  const result = getBulkScrapeSelection(
    companies,
    companies.map((company) => company.name),
    false,
  );

  assert.equal(result.targets.length, 3);
  assert.equal(result.skippedMissingCareersUrl.length, 0);
});

test('bulk scraper state update changes only successful targets', () => {
  const updated = updateCompanyScrapeFlags(companies, ['Pfizer', 'Conduent'], true);

  assert.equal(updated[0].isActiveForScrape, true);
  assert.equal(updated[1].isActiveForScrape, true);
  assert.equal(updated[2].isActiveForScrape, false);
  assert.notEqual(updated[0], companies[0]);
  assert.equal(updated[2], companies[2]);
});

test('bulk scraper database rows are deduplicated and chunked', () => {
  const names = Array.from({ length: 501 }, (_, index) => `Company ${index + 1}`);
  names.push('Company 1', '  Company 2  ', '');

  const batches = buildCompanyScrapeUpdateBatches(names, true, '2026-11-03T00:00:00.000Z');

  assert.deepEqual(batches.map((batch) => batch.length), [250, 250, 1]);
  assert.deepEqual(batches[0][0], {
    name: 'Company 1',
    is_active_for_scrape: true,
    updated_at: '2026-11-03T00:00:00.000Z',
  });
});
