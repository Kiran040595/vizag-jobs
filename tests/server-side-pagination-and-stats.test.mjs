import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1. SQL migration defines stats & pagination RPCs with anon grant
const migrationPath = path.join(
  repoRoot,
  'supabase/migrations/20261125210000_public_pagination_and_stats_rpc.sql',
);
assert.ok(existsSync(migrationPath), 'Pagination & stats migration must exist');
const migrationSql = readFileSync(migrationPath, 'utf8');
assert.match(migrationSql, /CREATE OR REPLACE FUNCTION public\.get_public_job_stats\(\)/);
assert.match(migrationSql, /CREATE OR REPLACE FUNCTION public\.query_public_jobs\(/);
assert.match(migrationSql, /GRANT EXECUTE ON FUNCTION public\.get_public_job_stats\(\) TO anon, authenticated/);
assert.match(migrationSql, /GRANT EXECUTE ON FUNCTION public\.query_public_jobs\([^)]+\) TO anon, authenticated/);

// 2. jobs.js provides server-side pagination & stats RPC wrappers with caching
const jobsServiceSrc = readFileSync(path.join(repoRoot, 'src/services/jobs.js'), 'utf8');
assert.match(jobsServiceSrc, /export const fetchPublicJobStats/);
assert.match(jobsServiceSrc, /export const readCachedPublicJobStats/);
assert.match(jobsServiceSrc, /export const fetchPaginatedPublicJobs/);
assert.match(jobsServiceSrc, /export const readCachedPaginatedJobs/);
assert.match(jobsServiceSrc, /client\.rpc\('get_public_job_stats'\)/);
assert.match(jobsServiceSrc, /client\.rpc\('query_public_jobs'/);

// 3. Shared pagination hooks exist and debounce search
const paginatedHookSrc = readFileSync(path.join(repoRoot, 'src/hooks/usePaginatedPublicJobs.js'), 'utf8');
assert.match(paginatedHookSrc, /fetchPaginatedPublicJobs/);
assert.match(paginatedHookSrc, /SEARCH_DEBOUNCE_MS/);

const categoryRouteHookSrc = readFileSync(path.join(repoRoot, 'src/hooks/usePaginatedCategoryRoute.js'), 'utf8');
assert.match(categoryRouteHookSrc, /usePaginatedPublicJobs/);
assert.match(categoryRouteHookSrc, /searchParams\.get\('page'\)/);

// 4. SimilarJobs.jsx avoids full-table download
const similarJobsSrc = readFileSync(path.join(repoRoot, 'src/components/SimilarJobs.jsx'), 'utf8');
assert.doesNotMatch(similarJobsSrc, /useCachedPublicJobs/);
assert.match(similarJobsSrc, /fetchPaginatedPublicJobs/);
assert.match(similarJobsSrc, /pageSize:\s*18/);

// 5. HomePage.jsx uses server-side pagination + stats RPC and does not call fetchJobs() eagerly on load
const homePageSrc = readFileSync(path.join(repoRoot, 'src/pages/HomePage.jsx'), 'utf8');
assert.match(homePageSrc, /usePaginatedPublicJobs/);
assert.match(homePageSrc, /fetchPublicJobStats/);
assert.match(homePageSrc, /canServeFromSsr/);
assert.doesNotMatch(homePageSrc, /fetchJobs\(\{\}, true\)/);

// 6. All listing sub-pages use server-side pagination and render <Pagination />
const listingPages = [
  'src/pages/JobsInVizagPage.jsx',
  'src/pages/ItJobsInVizagPage.jsx',
  'src/pages/FresherJobsInVizagPage.jsx',
  'src/pages/DirectJobsInVizagPage.jsx',
  'src/pages/PartTimeJobsVizagPage.jsx',
  'src/pages/BranchJobsInVizagPage.jsx',
];

for (const relPath of listingPages) {
  const src = readFileSync(path.join(repoRoot, relPath), 'utf8');
  assert.doesNotMatch(src, /useCachedPublicJobs/, `${relPath} must not call useCachedPublicJobs`);
  assert.match(src, /<Pagination\b/, `${relPath} must render <Pagination />`);
}

console.log('server-side-pagination-and-stats.test.mjs: ALL TESTS PASSED! OK');
