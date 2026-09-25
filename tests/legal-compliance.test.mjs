/**
 * Run with: node --test tests/legal-compliance.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldLoadAdSenseScript } from '../src/lib/adsense.js';
import { LEGAL_PAGE_META } from '../src/lib/legalPageMeta.js';
import {
  buildContactMailto,
  buildListingReportPath,
  LISTING_REPORT_TOPIC,
  PRIVACY_REQUEST_TOPIC,
  readContactRequest,
} from '../src/lib/listingReport.js';
import {
  SITE_CONTACT_EMAIL,
  SITE_DATA_FIDUCIARY_NAME,
  SITE_GRIEVANCE_OFFICER_NAME,
  SITE_LEGAL_LAST_UPDATED,
} from '../src/lib/siteLegal.js';

test('legal identity includes DPDP grievance contacts', () => {
  assert.equal(SITE_DATA_FIDUCIARY_NAME, 'Kiran Kumar');
  assert.equal(SITE_GRIEVANCE_OFFICER_NAME, 'Kiran Kumar');
  assert.match(SITE_CONTACT_EMAIL, /@/);
  assert.match(SITE_LEGAL_LAST_UPDATED, /2026/);
});

test('privacy and terms SSR summaries mention DPDP, cookies, and public job ads', () => {
  const privacy = LEGAL_PAGE_META['/privacy-policy'].paragraphs.join(' ');
  const terms = LEGAL_PAGE_META['/terms-of-service'].paragraphs.join(' ');
  const disclaimer = LEGAL_PAGE_META['/disclaimer'].paragraphs.join(' ');

  assert.match(privacy, /Data Fiduciary/i);
  assert.match(privacy, /advertising cookies/i);
  assert.match(privacy, /Grievance Officer/i);
  assert.match(terms, /publicly advertised/i);
  assert.match(disclaimer, /publicly advertised/i);
});

test('listing report path and mailto include job details', () => {
  const path = buildListingReportPath({
    jobTitle: 'Java Developer',
    jobId: 'abc-123',
    jobPath: '/jobs/it/java-developer',
  });

  assert.equal(path.startsWith('/contact?'), true);

  const params = new URLSearchParams(path.split('?')[1]);
  const request = readContactRequest(params);
  assert.equal(request.isListingReport, true);
  assert.equal(request.jobTitle, 'Java Developer');
  assert.equal(request.jobId, 'abc-123');
  assert.equal(request.jobPath, '/jobs/it/java-developer');

  const mailto = buildContactMailto({
    email: SITE_CONTACT_EMAIL,
    topic: LISTING_REPORT_TOPIC,
    jobTitle: 'Java Developer',
    jobPath: '/jobs/it/java-developer',
    jobId: 'abc-123',
  });
  assert.match(mailto, /^mailto:/);
  assert.match(mailto, /Listing%20report/);
});

test('privacy request topic is distinct from listing reports', () => {
  const request = readContactRequest(new URLSearchParams(`topic=${PRIVACY_REQUEST_TOPIC}`));
  assert.equal(request.isPrivacyRequest, true);
  assert.equal(request.isListingReport, false);
});

test('AdSense loader stays off until advertising consent', () => {
  assert.equal(shouldLoadAdSenseScript(false), false);
  assert.equal(shouldLoadAdSenseScript(true), true);
});
