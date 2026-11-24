import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hookSrc = readFileSync(path.join(repoRoot, 'src/hooks/useAppliedJobsCount.js'), 'utf8');
const serviceSrc = readFileSync(path.join(repoRoot, 'src/services/jobApplications.js'), 'utf8');

// Verify service exports
assert.match(serviceSrc, /export const fetchMyApplicationsCount/);
assert.match(serviceSrc, /export const getCachedAppliedJobsCount/);
assert.match(serviceSrc, /export const setCachedAppliedJobsCount/);
assert.match(serviceSrc, /export const invalidateAppliedJobsCount/);
assert.match(serviceSrc, /export const subscribeAppliedJobsCount/);

// Verify head count query to Supabase (zero data payload egress)
assert.match(serviceSrc, /select\('id',\s*\{\s*count:\s*'exact',\s*head:\s*true\s*\}\)/);

// Verify 3 minute TTL
assert.match(serviceSrc, /COUNT_CACHE_TTL_MS\s*=\s*3\s*\*\s*60\s*\*\s*1000/);

// Verify cache invalidation on submitJobApplication
assert.match(serviceSrc, /invalidateAppliedJobsCount\(user\.id\)/);

// Verify hook uses fetchMyApplicationsCount instead of heavy fetchMyApplications
assert.match(hookSrc, /fetchMyApplicationsCount\(userId\)/);
assert.doesNotMatch(hookSrc, /fetchMyApplications\(\)/);
assert.match(hookSrc, /subscribeAppliedJobsCount/);
assert.match(hookSrc, /getCachedAppliedJobsCount/);

console.log('applied-jobs-count-cache.test.mjs: OK');
