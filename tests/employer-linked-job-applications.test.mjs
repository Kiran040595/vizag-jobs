import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// 1. Verify Database RLS and can_view_job_applications
const migrationPath = path.join(repoRoot, 'supabase/migrations/20260717_job_applications.sql');
assert.ok(existsSync(migrationPath), '20260717_job_applications.sql must exist');
const migrationSrc = readFileSync(migrationPath, 'utf8');

assert.match(
  migrationSrc,
  /create or replace function public\.can_view_job_applications\(job_uuid uuid, uid uuid\)/,
  'Migration must define can_view_job_applications(job_uuid, uid)',
);

assert.match(
  migrationSrc,
  /select public\.can_moderate_job_questions\(job_uuid, uid\);/,
  'can_view_job_applications must delegate to can_moderate_job_questions',
);

assert.match(
  migrationSrc,
  /create policy "Moderators read job applications"[\s\S]*?using \(public\.can_view_job_applications\(job_id, auth\.uid\(\)\)\);/,
  'Job applications table must have Moderators read policy using can_view_job_applications',
);

assert.match(
  migrationSrc,
  /create policy "Moderators update job applications"[\s\S]*?using \(public\.can_view_job_applications\(job_id, auth\.uid\(\)\)\)/,
  'Job applications table must have Moderators update policy using can_view_job_applications',
);

// 2. Verify can_moderate_job_questions checks created_by = uid
const qaMigrationPath = path.join(repoRoot, 'supabase/migrations/20260924_community_qa_enhancements.sql');
assert.ok(existsSync(qaMigrationPath), '20260924_community_qa_enhancements.sql must exist');
const qaMigrationSrc = readFileSync(qaMigrationPath, 'utf8');

assert.match(
  qaMigrationSrc,
  /from public\.jobs j\s*where j\.id = job_uuid\s*and j\.created_by = uid/,
  'can_moderate_job_questions must check j.created_by = uid, granting full moderator access to the company',
);

// 3. Verify Resume Storage RLS for moderators
assert.match(
  migrationSrc,
  /create policy "Moderators read application resumes"/,
  'Storage policy must allow moderators to read application resumes',
);
assert.match(
  migrationSrc,
  /public\.can_view_job_applications\(ja\.job_id,\s*auth\.uid\(\)\)/,
  'Storage policy must use public.can_view_job_applications(ja.job_id, auth.uid())',
);

// 4. Verify assignJobsToEmployer sets created_by to the linked employer user ID
const adminJobsPath = path.join(repoRoot, 'src/services/adminJobs.js');
assert.ok(existsSync(adminJobsPath), 'adminJobs.js must exist');
const adminJobsSrc = readFileSync(adminJobsPath, 'utf8');

assert.match(
  adminJobsSrc,
  /updates\s*=\s*\{\s*created_by:\s*ownerId,/,
  'assignJobsToEmployer must set created_by = ownerId, establishing ownership and RLS permission',
);

// 5. Verify EmployerJobsListPage displays View Applications button and count link
const jobsListPagePath = path.join(repoRoot, 'src/pages/EmployerJobsListPage.jsx');
assert.ok(existsSync(jobsListPagePath), 'EmployerJobsListPage.jsx must exist');
const jobsListPageSrc = readFileSync(jobsListPagePath, 'utf8');

assert.match(
  jobsListPageSrc,
  /resolveOnPlatformApplicationCount\(job, applicationCounts\)\s*>\s*0/,
  'EmployerJobsListPage must check for on-platform application count',
);

assert.match(
  jobsListPageSrc,
  /to=\{`\/employer\/jobs\/\$\{job\.id\}\/applications`\}/,
  'EmployerJobsListPage must link to the job applications page',
);

// 6. Verify EmployerJobApplicationsPage loads applications and handles status & fallback
const applicationsPagePath = path.join(repoRoot, 'src/pages/EmployerJobApplicationsPage.jsx');
assert.ok(existsSync(applicationsPagePath), 'EmployerJobApplicationsPage.jsx must exist');
const applicationsPageSrc = readFileSync(applicationsPagePath, 'utf8');

assert.match(
  applicationsPageSrc,
  /fetchJobApplications\(jobId\)/,
  'EmployerJobApplicationsPage must call fetchJobApplications(jobId)',
);

assert.match(
  applicationsPageSrc,
  /JobApplicationCard/,
  'EmployerJobApplicationsPage must render JobApplicationCard for each applicant',
);

assert.match(
  applicationsPageSrc,
  /ApplicationExportDialog/,
  'EmployerJobApplicationsPage must provide Excel export dialog for applicants',
);

console.log('✓ All employer linked job applications verification tests passed successfully!');
