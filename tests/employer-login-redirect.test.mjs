import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// 1. Verify EmployerJobsListPage.jsx implementation
const jobsListPagePath = path.join(repoRoot, 'src/pages/EmployerJobsListPage.jsx');
assert.ok(existsSync(jobsListPagePath), 'EmployerJobsListPage.jsx must exist');
const jobsListPageSrc = readFileSync(jobsListPagePath, 'utf8');

assert.match(
  jobsListPageSrc,
  /import.*useSearchParams.*from 'react-router-dom'/,
  'EmployerJobsListPage must import useSearchParams from react-router-dom',
);

assert.match(
  jobsListPageSrc,
  /const\s*\[searchParams\]\s*=\s*useSearchParams\(\);/,
  'EmployerJobsListPage must call useSearchParams()',
);

assert.match(
  jobsListPageSrc,
  /const\s*viewMode\s*=\s*searchParams\.get\(['"]view['"]\);/,
  'EmployerJobsListPage must extract viewMode from searchParams',
);

assert.match(
  jobsListPageSrc,
  /if\s*\(\s*data\.length\s*===\s*0\s*&&\s*viewMode\s*!==\s*['"]list['"]\s*\)\s*\{\s*navigate\(['"]\/employer\/jobs\/new\?empty=1['"],\s*\{\s*replace:\s*true\s*\}\);/,
  'EmployerJobsListPage must redirect to /employer/jobs/new?empty=1 when data.length === 0 and viewMode is not list',
);

assert.match(
  jobsListPageSrc,
  /},\s*\[user\?\.id,\s*viewMode,\s*navigate\]\);/,
  'EmployerJobsListPage useEffect must depend on user?.id, viewMode, and navigate',
);

// 2. Verify EmployerNewJobPage.jsx implementation
const newJobPagePath = path.join(repoRoot, 'src/pages/EmployerNewJobPage.jsx');
assert.ok(existsSync(newJobPagePath), 'EmployerNewJobPage.jsx must exist');
const newJobPageSrc = readFileSync(newJobPagePath, 'utf8');

assert.match(
  newJobPageSrc,
  /import.*useSearchParams.*from 'react-router-dom'/,
  'EmployerNewJobPage must import useSearchParams from react-router-dom',
);

assert.match(
  newJobPageSrc,
  /const\s*isEmptyPrompt\s*=\s*searchParams\.get\(['"]empty['"]\)\s*===\s*['"]1['"];/,
  'EmployerNewJobPage must check if empty parameter equals 1',
);

assert.match(
  newJobPageSrc,
  /onCancel=\{\(\)\s*=>\s*navigate\(['"]\/employer\/jobs\?view=list['"]\)\}/,
  'EmployerNewJobPage must navigate to /employer/jobs?view=list on cancel to avoid infinite redirect',
);

assert.match(
  newJobPageSrc,
  /No jobs have been listed for your company yet/,
  'EmployerNewJobPage must include empty state informational message',
);

// 3. Verify UnifiedLoginPage.jsx routes employer login to /employer/jobs
const unifiedLoginPagePath = path.join(repoRoot, 'src/pages/UnifiedLoginPage.jsx');
assert.ok(existsSync(unifiedLoginPagePath), 'UnifiedLoginPage.jsx must exist');
const loginPageSrc = readFileSync(unifiedLoginPagePath, 'utf8');

assert.match(
  loginPageSrc,
  /<Navigate to=\{postLoginPath \|\| '\/employer\/jobs'\} replace \/>/,
  'UnifiedLoginPage must route employer to /employer/jobs by default',
);

// 4. Verify EmployerShell has navigation tabs
const shellPath = path.join(repoRoot, 'src/components/employer/EmployerShell.jsx');
assert.ok(existsSync(shellPath), 'EmployerShell.jsx must exist');
const shellSrc = readFileSync(shellPath, 'utf8');

assert.match(shellSrc, /\{\s*label:\s*'My jobs',\s*to:\s*'\/employer\/jobs'\s*\}/, 'EmployerShell must have My jobs tab');
assert.match(shellSrc, /\{\s*label:\s*'Post a job',\s*to:\s*'\/employer\/jobs\/new'\s*\}/, 'EmployerShell must have Post a job tab');

console.log('✓ All employer login redirect tests passed successfully!');
