import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = path.join(repoRoot, 'supabase/migrations/20261015120000_create_site_error_logs.sql');
const queueScriptPath = path.join(repoRoot, 'scripts/bugs-queue.mjs');
const pkgPath = path.join(repoRoot, 'package.json');
const apiHandlerPath = path.join(repoRoot, 'api/report-error.js');

// 1. Migration file exists and defines site_error_logs with status check
assert.equal(existsSync(migrationPath), true, 'Migration 20261015120000_create_site_error_logs.sql must exist');
const migrationSql = readFileSync(migrationPath, 'utf8');
assert.match(migrationSql, /create table if not exists public\.site_error_logs/, 'Migration must create site_error_logs table');
assert.match(migrationSql, /check \(status in \('open', 'investigating', 'resolved', 'ignored'\)\)/, 'Status check must include open, investigating, resolved, ignored');
assert.match(migrationSql, /create index if not exists site_error_logs_open_idx/, 'Index on open status must be created');

// 2. Queue runner script exists and exports list, resolve, ignore commands
assert.equal(existsSync(queueScriptPath), true, 'scripts/bugs-queue.mjs must exist');
const queueScript = readFileSync(queueScriptPath, 'utf8');
assert.match(queueScript, /listBugs/, 'bugs-queue.mjs must define listBugs');
assert.match(queueScript, /resolveBug/, 'bugs-queue.mjs must define resolveBug');
assert.match(queueScript, /ignoreBug/, 'bugs-queue.mjs must define ignoreBug');

// 3. package.json exposes npm scripts
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
assert.equal(typeof pkg.scripts['bugs:list'], 'string', 'package.json must contain bugs:list');
assert.equal(typeof pkg.scripts['bugs:resolve'], 'string', 'package.json must contain bugs:resolve');

// 4. api/report-error.js writes to site_error_logs with status
const apiHandler = readFileSync(apiHandlerPath, 'utf8');
assert.match(apiHandler, /status:\s*test\s*\?\s*'ignored'\s*:\s*'open'/, 'api/report-error.js must set status to open for real errors');

console.log('bugs-queue.test.mjs: OK');
