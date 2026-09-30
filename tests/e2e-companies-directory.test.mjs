import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIRECTORY_SECTORS,
  mapCategoryToSector,
  EXCLUDED_DIRECTORY_COMPANIES,
  KNOWN_COMPANY_DEFAULTS,
} from '../src/services/adminCompanies.js';

import {
  PUBLIC_COMPANIES_CACHE_KEY,
  COMPANY_DIRECTORY_CACHE_TTL_MS,
  readCachedPublicCompanies,
  writeCachedPublicCompanies,
  clearCachedPublicCompanies,
} from '../src/lib/publicJobsSessionCache.js';

import {
  readFiltersFromSearchParams,
  applyJobFilters,
} from '../src/lib/jobFilters.js';

// Setup Mock Storage for node environment testing
class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) || null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

test('Companies Directory: Sector Taxonomy & Mapping', async (t) => {
  await t.test('has all required sectors defined', () => {
    const ids = DIRECTORY_SECTORS.map((s) => s.id);
    assert.deepEqual(ids, ['all', 'it', 'pharma', 'education', 'banking', 'manufacturing', 'hospitality']);
  });

  await t.test('maps categories accurately to sectors', () => {
    assert.equal(mapCategoryToSector('IT & Software').id, 'it');
    assert.equal(mapCategoryToSector('Healthcare').id, 'pharma');
    assert.equal(mapCategoryToSector('Pharmaceutical').id, 'pharma');
    assert.equal(mapCategoryToSector('Education').id, 'education');
    assert.equal(mapCategoryToSector('Banking & Finance').id, 'banking');
    assert.equal(mapCategoryToSector('Manufacturing').id, 'manufacturing');
    assert.equal(mapCategoryToSector('Logistics').id, 'manufacturing');
    assert.equal(mapCategoryToSector('Hospitality & Retail').id, 'hospitality');
  });
});

test('Companies Directory: Browser Storage Cache (10-minute TTL)', async (t) => {
  globalThis.localStorage = new MockStorage();
  globalThis.sessionStorage = new MockStorage();

  await t.test('writes and reads cached public companies', () => {
    const dummyCompanies = [
      { id: '1', name: 'TCS', activeJobsCount: 15, sectorId: 'it' },
      { id: '2', name: 'Dr. Reddy', activeJobsCount: 8, sectorId: 'pharma' },
    ];

    writeCachedPublicCompanies(dummyCompanies);
    const cached = readCachedPublicCompanies();

    assert.ok(cached, 'Cache should exist');
    assert.equal(cached.companies.length, 2);
    assert.equal(cached.companies[0].name, 'TCS');
    assert.ok(cached.timestamp > 0);
  });

  await t.test('clears cache on admin mutation', () => {
    clearCachedPublicCompanies();
    assert.equal(readCachedPublicCompanies(), null);
    assert.equal(globalThis.localStorage.getItem(PUBLIC_COMPANIES_CACHE_KEY), null);
    assert.equal(globalThis.sessionStorage.getItem(PUBLIC_COMPANIES_CACHE_KEY), null);
  });

  await t.test('expires cache after 10-minute TTL', () => {
    const dummy = [{ id: '1', name: 'Old Company' }];
    const pastTimestamp = Date.now() - (COMPANY_DIRECTORY_CACHE_TTL_MS + 5000);
    globalThis.localStorage.setItem(
      PUBLIC_COMPANIES_CACHE_KEY,
      JSON.stringify({ timestamp: pastTimestamp, companies: dummy })
    );

    const result = readCachedPublicCompanies();
    assert.equal(result, null, 'Expired cache must return null to trigger fresh fetch');
  });
});

test('Companies Directory & Jobs Page: Exact Company Name Matching', async (t) => {
  const sampleJobs = [
    { id: 1, title: 'Software Engineer', company: 'Conduent', location: 'Visakhapatnam' },
    { id: 2, title: 'Senior Developer', company: 'conduent ', location: 'Visakhapatnam' },
    { id: 3, title: 'HR Manager', company: 'Miracle Software Systems', location: 'Visakhapatnam' },
    { id: 4, title: 'DevOps Lead', company: 'TCS', location: 'Visakhapatnam' },
  ];

  await t.test('filters jobs exactly by company search param', () => {
    const searchParams = new URLSearchParams('company=Conduent');
    const filters = readFiltersFromSearchParams(searchParams);
    assert.equal(filters.company, 'Conduent');

    const filtered = applyJobFilters(sampleJobs, filters);
    assert.equal(filtered.length, 2, 'Should match both Conduent and conduent (case & whitespace insensitive)');
    assert.ok(filtered.every((j) => j.company.trim().toLowerCase() === 'conduent'));
  });

  await t.test('does not bleed partial matches into exact company search', () => {
    const searchParams = new URLSearchParams('company=Miracle Software Systems');
    const filters = readFiltersFromSearchParams(searchParams);
    const filtered = applyJobFilters(sampleJobs, filters);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].company, 'Miracle Software Systems');
  });
});

test('Companies Directory: Verified Vizag Company URLs & Non-Vizag Exclusions', async (t) => {
  const EXPECTED_EXCLUDED = [
    'bairesdev',
    'turing',
    'google',
    'uber',
    'armani exchange',
    'escape academy',
    'with ease education india',
    'tablets india',
    'fresenius medical care',
    'planetspark',
    'patra corporation',
  ];

  await t.test('all non-Vizag, remote-only, and invalid companies are in EXCLUDED_DIRECTORY_COMPANIES', () => {
    for (const name of EXPECTED_EXCLUDED) {
      assert.ok(
        EXCLUDED_DIRECTORY_COMPANIES.has(name),
        `Expected ${name} to be in EXCLUDED_DIRECTORY_COMPANIES`
      );
    }
    // Da Vinci International School has an active verified campus in Vizag and should NOT be excluded
    assert.equal(
      EXCLUDED_DIRECTORY_COMPANIES.has('da vinci international school'),
      false,
      'Da Vinci International School must not be excluded as it is a verified Vizag school'
    );
  });

  const VERIFIED_URLS = {
    'PBL Transport Corporation': 'https://www.pbltransport.co.in/',
    'Karur Vysya Bank': 'https://www.kvb.co.in',
    'Hetero': 'https://www.hetero.com',
    'Foxconn': 'https://www.foxconn.com',
    'JLL': 'https://www.jll.co.in',
    'JSE Engineering': 'https://www.jseengineering.com',
    'Transasia Bio-Medicals Ltd.': 'https://transasia.co.in',
    'Decorpot': 'https://www.decorpot.com',
    'Benovymed Healthcare': 'https://benovymed.com',
    'Teks Academy': 'https://teksacademy.com',
    'Kiya World School': 'https://kiyaworldschool.com',
    'Eisai Pharmaceuticals India': 'https://www.eisai.co.in',
    'Edify Education': 'https://edifyschools.com',
    'Patra India': 'https://patracorp.com',
    'Pema Wellness Retreat': 'https://www.pemawellness.com',
    'SITARAM MOTORS': 'https://sitarammotors.royalenfield.com',
    'GITAM Deemed University': 'https://www.gitam.edu',
    'MGM Healthcare': 'https://mgmsevenhills.in',
    'DA VINCI INTERNATIONAL SCHOOL': 'https://davincischool.in',
  };

  await t.test('all premier Vizag companies have valid official websites and careers URLs in KNOWN_COMPANY_DEFAULTS', () => {
    for (const [name, expectedWeb] of Object.entries(VERIFIED_URLS)) {
      const entry = KNOWN_COMPANY_DEFAULTS[name];
      assert.ok(entry, `Expected KNOWN_COMPANY_DEFAULTS to have entry for ${name}`);
      assert.equal(entry.website, expectedWeb, `Expected ${name} website to be ${expectedWeb}`);
      assert.ok(entry.careers_url, `Expected ${name} to have a careers_url`);
      assert.ok(entry.careers_url.startsWith('http'), `Expected ${name} careers_url to start with http`);
    }
  });
});

