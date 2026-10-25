import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isJobExpired } from '../src/lib/jobPostingSchema.js';
import { isJobWithinPublicDisplayWindow } from '../src/lib/jobDisplayWindow.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminJobsSrc = readFileSync(path.join(repoRoot, 'src/services/adminJobs.js'), 'utf8');
const adminJobsPageSrc = readFileSync(path.join(repoRoot, 'src/pages/AdminJobsPage.jsx'), 'utf8');
const adminJobFormSrc = readFileSync(path.join(repoRoot, 'src/components/admin/AdminJobForm.jsx'), 'utf8');

test('isJobExpired correctly identifies past and future dates', () => {
  const pastJob = {
    title: 'Walk-in GIS Engineer',
    expires_at: '2026-10-24T12:59:00Z',
  };
  assert.equal(isJobExpired(pastJob), true);

  const futureJob = {
    title: 'Walk-in GIS Engineer Extended',
    expires_at: '2026-11-24T12:59:00Z',
  };
  assert.equal(isJobExpired(futureJob), false);

  const noExpiryJob = {
    title: 'Permanent Role',
    expires_at: null,
  };
  assert.equal(isJobExpired(noExpiryJob), false);
});

test('isJobWithinPublicDisplayWindow restores visibility when expires_at is in the future', () => {
  const expiredJob = {
    id: 'test-job-1',
    title: 'Junior GIS Engineer',
    posted_at: '2026-10-23T12:30:00Z',
    expires_at: '2026-10-24T12:59:00Z',
    created_by: 'admin-uuid',
    status: 'published',
  };
  assert.equal(isJobWithinPublicDisplayWindow(expiredJob), false);

  const reactivatedJob = {
    id: 'test-job-1',
    title: 'Junior GIS Engineer',
    posted_at: '2026-10-23T12:30:00Z',
    expires_at: '2026-11-24T12:59:00Z',
    created_by: 'admin-uuid',
    status: 'published',
  };
  assert.equal(isJobWithinPublicDisplayWindow(reactivatedJob), true);
});

test('admin jobs service exports updateAdminJobExpiry', () => {
  assert.match(adminJobsSrc, /export const updateAdminJobExpiry = async/);
  assert.match(adminJobsSrc, /expires_at: expiresAtIsoOrNull/);
  assert.match(adminJobsSrc, /invalidatePublicJobCache\(\)/);
});

test('AdminJobsPage includes expired indicators, filter options, and extend/clear actions', () => {
  assert.match(adminJobsPageSrc, /import \{ isJobExpired \} from '\.\.\/lib\/jobPostingSchema'/);
  assert.match(adminJobsPageSrc, /updateAdminJobExpiry/);
  assert.match(adminJobsPageSrc, /Expired \(Hidden from public\)/);
  assert.match(adminJobsPageSrc, /handleExtendExpiry/);
  assert.match(adminJobsPageSrc, /handleClearExpiry/);
  assert.match(adminJobsPageSrc, /Extend \(\+30d\)/);
  assert.match(adminJobsPageSrc, /Clear expiry/);
});

test('AdminJobForm provides expiry explanation and past-date warning', () => {
  assert.match(adminJobFormSrc, /hidden from public search and homepage/);
  assert.match(adminJobFormSrc, /This date is in the past! Saving will immediately hide this job/);
});
