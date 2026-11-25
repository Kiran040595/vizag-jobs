import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  POSTER_FORMATS,
  POSTER_THEMES,
  buildPosterFilename,
  buildPosterMetadata,
} from '../src/lib/jobPosterGenerator.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1. Formats & Themes
assert.equal(POSTER_FORMATS.portrait.width, 1080);
assert.equal(POSTER_FORMATS.portrait.height, 1350);
assert.equal(POSTER_FORMATS.story.height, 1920);
assert.equal(POSTER_FORMATS.square.height, 1080);
assert.ok(POSTER_THEMES.cyan && POSTER_THEMES.emerald && POSTER_THEMES.indigo);

// 2. Metadata builder works for camelCase (JobDetailsPage)
const camelMeta = buildPosterMetadata({
  id: '123',
  slug: 'react-developer-vizag',
  title: 'React Developer',
  company: 'Acme Tech',
  location: 'Madhurawada, Visakhapatnam',
  category: 'IT & Software',
  jobType: 'Full-time',
  isFresher: 'Yes',
  salary: 'Not disclosed',
  skills: 'React, JavaScript, Tailwind, SQL, Git',
  applyMode: 'internal',
});
assert.equal(camelMeta.title, 'React Developer');
assert.equal(camelMeta.company, 'Acme Tech');
assert.equal(camelMeta.salary, null); // hides "Not disclosed"
assert.deepEqual(camelMeta.skills, ['React', 'JavaScript', 'Tailwind', 'SQL']); // max 4
assert.equal(camelMeta.badge, 'DIRECT EMPLOYER · APPLY NOW');
assert.match(camelMeta.shareUrl, /react-developer-vizag/);

// 3. Metadata builder works for raw snake_case DB row (AdminJobsPage / EmployerJobsListPage)
const snakeMeta = buildPosterMetadata({
  id: '456',
  slug: 'site-engineer-gajuwaka',
  title: 'Site Engineer',
  company: 'Vizag Infra',
  location: 'Gajuwaka',
  category: 'Civil Engineering',
  job_type: 'Full-time',
  is_fresher: true,
  salary: '₹25,000/month',
  skills: ['AutoCAD', 'Estimation'],
  source_name: 'naukri.com',
});
assert.equal(snakeMeta.salary, '₹25,000/month');
assert.deepEqual(snakeMeta.skills, ['AutoCAD', 'Estimation']);
assert.equal(snakeMeta.badge, 'FRESHER HIRING · VISAKHAPATNAM');

// 4. Filename builder
assert.equal(
  buildPosterFilename({ slug: 'React Dev / Vizag!' }, 'story'),
  'vizagjobs-react-dev-vizag-story.png',
);

// 5. Modal & CSS rules follow dialog + light-dismiss accessibility guidance
const modalSrc = readFileSync(path.join(repoRoot, 'src/components/JobPosterModal.jsx'), 'utf8');
assert.match(modalSrc, /<dialog\b/);
assert.match(modalSrc, /closedby="any"/);
assert.match(modalSrc, /dialog\.showModal\(\)/);
assert.doesNotMatch(modalSrc, /role="dialog"/);
assert.doesNotMatch(modalSrc, /aria-modal/);
assert.match(modalSrc, /navigator\.share/);
assert.match(modalSrc, /canvas\.toBlob/);

const cssSrc = readFileSync(path.join(repoRoot, 'src/index.css'), 'utf8');
assert.match(cssSrc, /dialog:modal\s*\{[^}]*overscroll-behavior:\s*contain/);
assert.match(cssSrc, /dialog::backdrop\s*\{[^}]*overscroll-behavior:\s*contain/);

// 6. Wired for Students/Visitors, Admins, and Employers
const shareButtonsSrc = readFileSync(path.join(repoRoot, 'src/components/JobShareButtons.jsx'), 'utf8');
const adminBarSrc = readFileSync(path.join(repoRoot, 'src/components/admin/AdminJobActionsBar.jsx'), 'utf8');
const adminJobsSrc = readFileSync(path.join(repoRoot, 'src/pages/AdminJobsPage.jsx'), 'utf8');
const employerJobsSrc = readFileSync(path.join(repoRoot, 'src/pages/EmployerJobsListPage.jsx'), 'utf8');
const contactSrc = readFileSync(path.join(repoRoot, 'src/pages/ContactPage.jsx'), 'utf8');

assert.match(shareButtonsSrc, /JobPosterModal/);
assert.match(shareButtonsSrc, /setIsPosterOpen\(true\)/);
assert.match(adminBarSrc, /JobPosterModal/);
assert.match(adminJobsSrc, /JobPosterModal/);
assert.match(employerJobsSrc, /JobPosterModal/);
assert.match(employerJobsSrc, /Feature Job/);
assert.match(contactSrc, /prefilledSubject/);

console.log('job-poster-generator.test.mjs: ALL TESTS PASSED! OK');
