import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUG_STATUS_COLORS,
  BUG_STATUS_OPTIONS,
  formatBugTimestamp,
} from '../src/services/adminBugs.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appPath = path.join(repoRoot, 'src/App.jsx');
const shellPath = path.join(repoRoot, 'src/components/admin/AdminShell.jsx');
const pagePath = path.join(repoRoot, 'src/pages/AdminBugsPage.jsx');
const servicePath = path.join(repoRoot, 'src/services/adminBugs.js');

// 1. Service file exists and exports required constants and helpers
assert.equal(existsSync(servicePath), true, 'src/services/adminBugs.js must exist');
const serviceSrc = readFileSync(servicePath, 'utf8');
assert.match(serviceSrc, /export async function fetchAdminBugs/, 'Must export fetchAdminBugs');
assert.match(serviceSrc, /export async function fetchAdminBugStats/, 'Must export fetchAdminBugStats');
assert.match(serviceSrc, /export async function updateAdminBug/, 'Must export updateAdminBug');

// 2. Options and colors contract
assert.ok(Array.isArray(BUG_STATUS_OPTIONS), 'BUG_STATUS_OPTIONS must be an array');
assert.ok(BUG_STATUS_OPTIONS.some((opt) => opt.value === 'all'));
assert.ok(BUG_STATUS_OPTIONS.some((opt) => opt.value === 'open'));
assert.ok(BUG_STATUS_OPTIONS.some((opt) => opt.value === 'resolved'));
assert.ok(BUG_STATUS_OPTIONS.some((opt) => opt.value === 'ignored'));

assert.ok(BUG_STATUS_COLORS.open, 'Must define open color');
assert.ok(BUG_STATUS_COLORS.resolved, 'Must define resolved color');

// 3. formatBugTimestamp formats IST dates cleanly
const formatted = formatBugTimestamp('2026-11-01T07:36:23.434Z');
assert.match(formatted, /Nov/i, 'Formatted timestamp must include month');
assert.match(formatted, /2026/, 'Formatted timestamp must include year');
assert.equal(formatBugTimestamp(null), 'Unknown');

// 4. AdminShell includes Bugs & Errors in navItems
assert.equal(existsSync(shellPath), true, 'AdminShell must exist');
const shellSrc = readFileSync(shellPath, 'utf8');
assert.match(shellSrc, /to:\s*'\/admin\/bugs'/, 'AdminShell navItems must include /admin/bugs');
assert.match(shellSrc, /label:\s*'Bugs & Errors'/, 'AdminShell navItems must have label Bugs & Errors');

// 5. App.jsx registers /admin/bugs route protected with AdminRoute
assert.equal(existsSync(appPath), true, 'App.jsx must exist');
const appSrc = readFileSync(appPath, 'utf8');
assert.match(appSrc, /import AdminBugsPage from '\.\/pages\/AdminBugsPage'/, 'App.jsx must import AdminBugsPage');
assert.match(appSrc, /path="\/admin\/bugs"/, 'App.jsx must configure path="/admin/bugs"');
assert.match(appSrc, /<AdminRoute>\s*<AdminBugsPage \/>\s*<\/AdminRoute>/, 'Route /admin/bugs must be wrapped in AdminRoute');

// 6. AdminBugsPage component exists and includes KPI summary and resolution handling
assert.equal(existsSync(pagePath), true, 'AdminBugsPage.jsx must exist');
const pageSrc = readFileSync(pagePath, 'utf8');
assert.match(pageSrc, /export default function AdminBugsPage/, 'Must export default AdminBugsPage');
assert.match(pageSrc, /Open Bugs/, 'Must display Open Bugs KPI');
assert.match(pageSrc, /Resolved/, 'Must display Resolved KPI');
assert.match(pageSrc, /Ignored/, 'Must display Ignored KPI');
assert.match(pageSrc, /Resolved in Git Commit/, 'Must support displaying Git commit resolution');

console.log('admin-bugs.test.mjs: OK');
