import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageSrc = readFileSync(path.join(repoRoot, 'src/pages/AdminNewJobPage.jsx'), 'utf8');
const adminJobsSrc = readFileSync(path.join(repoRoot, 'src/services/adminJobs.js'), 'utf8');
const externalFetchSrc = readFileSync(path.join(repoRoot, 'src/services/externalJobFetch.js'), 'utf8');
const edgeIndexSrc = readFileSync(path.join(repoRoot, 'supabase/functions/fetch-external-jobs/index.ts'), 'utf8');
const edgeCareersSrc = readFileSync(path.join(repoRoot, 'supabase/functions/fetch-external-jobs/company-careers.ts'), 'utf8');

// 1. AdminNewJobPage verification
assert.match(pageSrc, /sqlMode/, 'sqlMode state must exist');
assert.match(pageSrc, /handleToggleSqlMode/, 'toggle mode handler must exist');
assert.match(pageSrc, /Single Job/, 'Single Job button label must exist');
assert.match(pageSrc, /Multiple Jobs/, 'Multiple Jobs button label must exist');
assert.match(pageSrc, /SQL_EXAMPLE_SINGLE/, 'SQL single example must exist');
assert.match(pageSrc, /SQL_EXAMPLE_MULTIPLE/, 'SQL multiple example must exist');
assert.match(pageSrc, /handleParseJobTextWithGemini/, 'Gemini text parser handler must exist');
assert.match(pageSrc, /parseRawJobTextWithGemini/, 'parseRawJobTextWithGemini must be imported and called');
assert.match(pageSrc, /handlePostAiJobsToWebsite/, 'Post AI jobs handler must exist');
assert.match(pageSrc, /handleConvertAiJobsToSql/, 'Convert AI jobs to SQL handler must exist');
assert.match(pageSrc, /In-Platform Apply Only/, 'In-platform apply only badge must exist');

// 2. Admin Jobs service verification
assert.match(adminJobsSrc, /export const splitSqlValuesTuples/, 'splitSqlValuesTuples must be exported');
assert.match(adminJobsSrc, /export const parseSqlInsertToRecords/, 'parseSqlInsertToRecords must be exported');
assert.match(adminJobsSrc, /export const formatJobsToSqlInsert/, 'formatJobsToSqlInsert must be exported');
assert.match(adminJobsSrc, /export const createAdminJobsFromSql/, 'createAdminJobsFromSql must be exported');
assert.match(adminJobsSrc, /export const createAdminJobs/, 'createAdminJobs must be exported');

// 3. External Job Fetch service verification
assert.match(externalFetchSrc, /export async function parseRawJobTextWithGemini/, 'parseRawJobTextWithGemini must be exported');
assert.match(externalFetchSrc, /mode: 'parse_text_jobs'/, 'parse_text_jobs mode must be queried');

// 4. Edge function verification
assert.match(edgeIndexSrc, /mode === 'parse_text_jobs'/, 'edge function must handle parse_text_jobs');
assert.match(edgeIndexSrc, /PARSE_RAW_TEXT_JOBS_SCHEMA/, 'edge function must use PARSE_RAW_TEXT_JOBS_SCHEMA');
assert.match(edgeCareersSrc, /export const PARSE_RAW_TEXT_JOBS_SCHEMA/, 'PARSE_RAW_TEXT_JOBS_SCHEMA must be exported');

console.log('admin-new-job-page.test.mjs: ALL CONTRACT CHECKS PASSED');
