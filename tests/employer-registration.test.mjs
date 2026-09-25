import assert from 'node:assert/strict';
import {
  EMPLOYER_INDUSTRY_OPTIONS,
  EMPLOYER_LOCATION_OPTIONS,
  isValidEmployerPhone,
  normalizeEmployerPhone,
} from '../src/lib/employerProfileOptions.js';
import {
  employerSearchBlob,
  mapEmployerProfileRow,
} from '../src/lib/adminEmployerProfile.js';

// 1. Validate Industry & Location Options
assert.ok(EMPLOYER_INDUSTRY_OPTIONS.length >= 8);
assert.ok(EMPLOYER_INDUSTRY_OPTIONS.includes('IT & Software / Tech'));
assert.ok(EMPLOYER_INDUSTRY_OPTIONS.includes('Manufacturing & Industrial / Steel'));
assert.ok(EMPLOYER_INDUSTRY_OPTIONS.includes('Pharma, Biotech & Healthcare'));

assert.ok(EMPLOYER_LOCATION_OPTIONS.length >= 8);
assert.ok(EMPLOYER_LOCATION_OPTIONS.includes('Rushikonda IT SEZ / Madhurawada'));
assert.ok(EMPLOYER_LOCATION_OPTIONS.includes('Gajuwaka / Auto Nagar'));
assert.ok(EMPLOYER_LOCATION_OPTIONS.includes('Dwaraka Nagar / RTC Complex'));

// 2. Validate Phone Helpers
assert.equal(isValidEmployerPhone('9876543210'), true);
assert.equal(isValidEmployerPhone('+919876543210'), true);
assert.equal(isValidEmployerPhone('98765'), false);
assert.equal(isValidEmployerPhone(''), false);

assert.equal(normalizeEmployerPhone('9876543210'), '9876543210');
assert.equal(normalizeEmployerPhone('+91 98765-43210'), '9876543210');
assert.equal(normalizeEmployerPhone('919876543210'), '9876543210');

// 3. Validate Profile Row Mapping with Industry & Location
const dbRow = {
  user_id: '12345678-1234-1234-1234-123456789abc',
  company_name: 'Rushikonda Tech Labs',
  contact_name: 'Sunil Varma',
  contact_email: 'sunil@rushikonda.tech',
  phone: '9848011223',
  industry: 'IT & Software / Tech',
  location: 'Rushikonda IT SEZ / Madhurawada',
  website: 'https://rushikonda.tech',
  company_logo_url: '',
  is_active: true,
  created_at: '2026-09-19T10:00:00.000Z',
  updated_at: '2026-09-19T10:00:00.000Z',
};

const mapped = mapEmployerProfileRow(dbRow, { total: 5, pending: 2, published: 3 });
assert.equal(mapped.companyName, 'Rushikonda Tech Labs');
assert.equal(mapped.contactName, 'Sunil Varma');
assert.equal(mapped.phone, '9848011223');
assert.equal(mapped.industry, 'IT & Software / Tech');
assert.equal(mapped.location, 'Rushikonda IT SEZ / Madhurawada');
assert.equal(mapped.profileComplete, true);
assert.equal(mapped.jobStats.pending, 2);

// 4. Validate Search Blob Matching
const blob = employerSearchBlob(mapped);
assert.ok(blob.includes('rushikonda tech labs'));
assert.ok(blob.includes('sunil varma'));
assert.ok(blob.includes('it & software'));
assert.ok(blob.includes('madhurawada'));

console.log('employer-registration.test.mjs: ALL TESTS PASSED! OK');
