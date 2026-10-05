/**
 * Unit tests for Gemini Q&A answering, auto-publishing, and student notifications.
 *
 * Run with: node tests/job-question-gemini-notify.test.mjs
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1. Verify SQL migration for auto-publishing and notifying students
const migrationSrc = readFileSync(
  path.join(repoRoot, 'supabase/migrations/20261005_auto_publish_job_question_notify_students.sql'),
  'utf8',
);
assert.match(migrationSrc, /create or replace function public\.create_job_question_reply_notification/);
assert.match(migrationSrc, /after insert or update of answer_body, status on public\.job_questions/);
assert.match(migrationSrc, /insert into public\.reply_notifications/);
assert.match(migrationSrc, /from public\.job_applications ja/);
assert.match(migrationSrc, /from public\.student_profiles sp/);
assert.match(migrationSrc, /\/community-qa\?question=/);
assert.match(migrationSrc, /on conflict \(user_id, kind, ref_id\)/);

// 2. Verify Edge Function answer-job-question implementation
const edgeFunctionSrc = readFileSync(
  path.join(repoRoot, 'supabase/functions/answer-job-question/index.ts'),
  'utf8',
);
assert.match(edgeFunctionSrc, /DEFAULT_GEMINI_MODEL = 'gemini-2\.5-flash'/);
assert.match(edgeFunctionSrc, /JOB_SYSTEM_PROMPT/);
assert.match(edgeFunctionSrc, /GENERAL_SYSTEM_PROMPT/);
assert.match(edgeFunctionSrc, /status:\s*'published'/);
assert.match(edgeFunctionSrc, /buildJobQuestionReplyEmail/);
assert.match(edgeFunctionSrc, /from\('job_applications'\)/);
assert.match(edgeFunctionSrc, /from\('student_profiles'\)/);
assert.match(edgeFunctionSrc, /Gemini answered your question/);
assert.match(edgeFunctionSrc, /New Q&A answered for/);

// 3. Verify Vercel Serverless API implementation
const apiSrc = readFileSync(path.join(repoRoot, 'api/answer-job-question.js'), 'utf8');
assert.match(apiSrc, /createServiceClient/);
assert.match(apiSrc, /callGemini/);
assert.match(apiSrc, /status:\s*'published'/);
assert.match(apiSrc, /from\('reply_notifications'\)/);
assert.match(apiSrc, /from\('job_applications'\)/);
assert.match(apiSrc, /from\('student_profiles'\)/);

// 4. Verify jobQuestions client service
const jobQuestionsSrc = readFileSync(path.join(repoRoot, 'src/services/jobQuestions.js'), 'utf8');
assert.match(jobQuestionsSrc, /export const requestJobAiAnswer/);
assert.match(jobQuestionsSrc, /\/api\/answer-job-question/);
assert.match(jobQuestionsSrc, /🤖 Gemini AI/);
assert.match(jobQuestionsSrc, /insertPendingJobQuestion/);
assert.match(jobQuestionsSrc, /export const submitJobQuestion/);

// 5. Verify CommunityQaPage integration
const communityQaSrc = readFileSync(path.join(repoRoot, 'src/pages/CommunityQaPage.jsx'), 'utf8');
assert.match(communityQaSrc, /requestJobAiAnswer/);
assert.match(communityQaSrc, /Answered by Gemini AI/);
assert.match(communityQaSrc, /Auto-Published &amp; Students Notified/);

// 6. Verify JobQuestionsSection on job details page
const jobQuestionsSectionSrc = readFileSync(
  path.join(repoRoot, 'src/components/JobQuestionsSection.jsx'),
  'utf8',
);
assert.match(jobQuestionsSectionSrc, /Ask Gemini AI/);
assert.match(jobQuestionsSectionSrc, /Answer received &amp; Auto-Published/);
assert.match(jobQuestionsSectionSrc, /🤖 Gemini AI/);
assert.match(jobQuestionsSectionSrc, /Auto-published to this job/);

// 7. Verify helper logic on imported functions
const { validateQuestionInput } = await import('../src/services/jobQuestions.js');
assert.equal(validateQuestionInput({ askerName: '', askerEmail: '', body: 'Hello' }), 'Please enter your name or email.');
assert.equal(validateQuestionInput({ askerName: 'Rahul', askerEmail: '', body: 'Hi' }), 'Please enter a question with at least 3 characters.');
assert.equal(validateQuestionInput({ askerName: 'Rahul', askerEmail: 'bad-email', body: 'Is this fresher eligible?' }), 'Please enter a valid email address.');
assert.equal(validateQuestionInput({ askerName: 'Rahul', askerEmail: 'rahul@example.com', body: 'Is this fresher eligible?' }), '');

console.log('job-question-gemini-notify.test.mjs: OK');
