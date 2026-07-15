import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const navbarSrc = readFileSync(path.join(repoRoot, 'src/components/Navbar.jsx'), 'utf8');
const appliedJobsPathSrc = readFileSync(path.join(repoRoot, 'src/lib/studentAppliedJobsPath.js'), 'utf8');
const sessionRouteSrc = readFileSync(
  path.join(repoRoot, 'src/components/student/StudentSessionRoute.jsx'),
  'utf8',
);

assert.match(appliedJobsPathSrc, /APPLIED_JOBS_PATH = '\/student\/applied-jobs'/);
assert.match(appliedJobsPathSrc, /buildAppliedJobsLoginPath/);
assert.match(navbarSrc, /NavbarAppliedJobsLink/);
assert.match(navbarSrc, /NavbarStudentAuth/);
assert.match(sessionRouteSrc, /buildStudentAuthPath/);

console.log('navbar-applied-jobs.test.mjs: OK');
