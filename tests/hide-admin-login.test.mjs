import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const loginSrc = readFileSync(path.join(repoRoot, 'src/pages/UnifiedLoginPage.jsx'), 'utf8');
assert.doesNotMatch(loginSrc, /RoleToggle label="Admin"/);
assert.match(loginSrc, /\{role !== 'admin' \?/);
assert.match(loginSrc, /noindex=\{role === 'admin'\}/);

const robotsTxt = readFileSync(path.join(repoRoot, 'public/robots.txt'), 'utf8');
assert.match(robotsTxt, /Disallow:\s*\/admin/);

const footerSrc = readFileSync(path.join(repoRoot, 'src/components/Footer.jsx'), 'utf8');
assert.doesNotMatch(footerSrc, /\/admin/);

const navbarSrc = readFileSync(path.join(repoRoot, 'src/components/Navbar.jsx'), 'utf8');
assert.doesNotMatch(navbarSrc, /\/admin\/login/);

console.log('hide-admin-login.test.mjs: ALL TESTS PASSED! OK');
