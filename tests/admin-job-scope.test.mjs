import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminJobsSrc = readFileSync(path.join(repoRoot, 'src/services/adminJobs.js'), 'utf8');
const adminJobsPageSrc = readFileSync(path.join(repoRoot, 'src/pages/AdminJobsPage.jsx'), 'utf8');
const adminShellSrc = readFileSync(path.join(repoRoot, 'src/components/admin/AdminShell.jsx'), 'utf8');
const externalFetchSrc = readFileSync(path.join(repoRoot, 'src/pages/AdminExternalFetchPage.jsx'), 'utf8');
const appSrc = readFileSync(path.join(repoRoot, 'src/App.jsx'), 'utf8');

assert.match(adminJobsSrc, /scope === 'admin'/);
assert.match(adminJobsSrc, /scope === 'employer'/);
assert.match(adminJobsSrc, /scope === 'platform'/);
assert.match(adminJobsSrc, /export const isExternalFetchSourceName/);
assert.match(adminJobsSrc, /source_name\.not\.ilike\.%naukri%/);
assert.match(adminJobsSrc, /source_name\.not\.ilike\.%linkedin%/);
assert.match(adminJobsSrc, /export const fetchAdminCreatedJobs/);
assert.match(adminJobsSrc, /export const fetchAdminPlatformJobs/);
assert.match(adminJobsSrc, /export const fetchEmployerSubmittedJobs/);
assert.match(adminJobsSrc, /export const getAdminJobsListPath/);

assert.match(adminJobsPageSrc, /scope = 'employer'/);
assert.match(adminJobsPageSrc, /fetchAdminCreatedJobs/);
assert.match(adminJobsPageSrc, /fetchEmployerSubmittedJobs/);
assert.match(adminJobsPageSrc, /isExternalFetchSourceName/);
assert.doesNotMatch(adminJobsPageSrc, /fetchAdminPlatformJobs/);

assert.match(adminShellSrc, /label: 'Admin Jobs'/);
assert.match(adminShellSrc, /to: '\/admin\/admin-jobs'/);
assert.match(adminShellSrc, /label: 'Employer submissions'/);

assert.match(externalFetchSrc, /fetchAdminPlatformJobs/);
assert.doesNotMatch(externalFetchSrc, /fetchAdminCreatedJobs/);
assert.doesNotMatch(externalFetchSrc, /fetchAdminJobs\(/);

assert.match(appSrc, /path="\/admin\/admin-jobs"/);
assert.match(appSrc, /<AdminJobsPage scope="admin" \/>/);
assert.match(appSrc, /<AdminJobsPage scope="employer" \/>/);

console.log('admin-job-scope.test.mjs: OK');
