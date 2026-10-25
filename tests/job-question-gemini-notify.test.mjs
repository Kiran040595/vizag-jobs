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

// 1. Verify SQL migration stops broadcasting Q&A questions to other students
const stopBroadcastMigrationSrc = readFileSync(
  path.join(repoRoot, 'supabase/migrations/20261025170000_stop_broadcasting_job_questions_to_students.sql'),
  'utf8',
);
assert.match(stopBroadcastMigrationSrc, /create or replace function public\.create_job_question_reply_notification/);
assert.match(stopBroadcastMigrationSrc, /new\.asker_user_id/);
assert.ok(!stopBroadcastMigrationSrc.includes('from public.job_applications'), 'Must not broadcast to job applicants');
assert.ok(!stopBroadcastMigrationSrc.includes('from public.student_profiles'), 'Must not broadcast to all registered students');
assert.match(stopBroadcastMigrationSrc, /delete from public\.reply_notifications/);

// 2. Verify Edge Function answer-job-question only notifies asker, never broadcasts to applicants or students
const edgeFunctionSrc = readFileSync(
  path.join(repoRoot, 'supabase/functions/answer-job-question/index.ts'),
  'utf8',
);
assert.match(edgeFunctionSrc, /DEFAULT_GEMINI_MODEL = 'gemini-2\.5-flash'/);
assert.match(edgeFunctionSrc, /JOB_SYSTEM_PROMPT/);
assert.match(edgeFunctionSrc, /GENERAL_SYSTEM_PROMPT/);
assert.match(edgeFunctionSrc, /status:\s*'published'/);
assert.match(edgeFunctionSrc, /buildJobQuestionReplyEmail/);
assert.match(edgeFunctionSrc, /New response for your question/);
assert.ok(!edgeFunctionSrc.includes("from('job_applications')"), 'Edge function must not query job_applications for broadcasting');
assert.ok(!edgeFunctionSrc.includes("from('student_profiles')"), 'Edge function must not query student_profiles for broadcasting');
assert.ok(!edgeFunctionSrc.includes('New Q&A answered for'), 'Edge function must not send broadcast Q&A notifications');

// 3. Verify Vercel Serverless API only notifies asker, never broadcasts to applicants or students
const apiSrc = readFileSync(path.join(repoRoot, 'api/answer-job-question.js'), 'utf8');
assert.match(apiSrc, /createServiceClient/);
assert.match(apiSrc, /callGemini/);
assert.match(apiSrc, /status:\s*'published'/);
assert.match(apiSrc, /from\('reply_notifications'\)/);
assert.ok(!apiSrc.includes("from('job_applications')"), 'API must not query job_applications for broadcasting');
assert.ok(!apiSrc.includes("from('student_profiles')"), 'API must not query student_profiles for broadcasting');

// 4. Verify jobQuestions client service
const jobQuestionsSrc = readFileSync(path.join(repoRoot, 'src/services/jobQuestions.js'), 'utf8');
assert.match(jobQuestionsSrc, /export const requestJobAiAnswer/);
assert.match(jobQuestionsSrc, /\/api\/answer-job-question/);
assert.match(jobQuestionsSrc, /Verified Response/);
assert.match(jobQuestionsSrc, /insertPendingJobQuestion/);
assert.match(jobQuestionsSrc, /export const submitJobQuestion/);

// 5. Verify CommunityQaPage integration
const communityQaSrc = readFileSync(path.join(repoRoot, 'src/pages/CommunityQaPage.jsx'), 'utf8');
assert.match(communityQaSrc, /requestJobAiAnswer/);
assert.match(communityQaSrc, /Verified Career Guidance/);
assert.match(communityQaSrc, /Auto-Published &amp; Students Notified/);

// 6. Verify JobQuestionsSection on job details page
const jobQuestionsSectionSrc = readFileSync(
  path.join(repoRoot, 'src/components/JobQuestionsSection.jsx'),
  'utf8',
);
assert.match(jobQuestionsSectionSrc, /Ask a Question/);
assert.match(jobQuestionsSectionSrc, /Question Posted &amp; Under Review/);
assert.match(jobQuestionsSectionSrc, /Verified Response/);
assert.match(jobQuestionsSectionSrc, /DeviceAlertPrompt/);

// 7. Verify helper logic on imported functions
const { validateQuestionInput } = await import('../src/services/jobQuestions.js');
assert.equal(validateQuestionInput({ askerName: '', askerEmail: '', body: 'Hello' }), 'Please enter your name or email.');
assert.equal(validateQuestionInput({ askerName: 'Rahul', askerEmail: '', body: 'Hi' }), 'Please enter a question with at least 3 characters.');
assert.equal(validateQuestionInput({ askerName: 'Rahul', askerEmail: 'bad-email', body: 'Is this fresher eligible?' }), 'Please enter a valid email address.');
assert.equal(validateQuestionInput({ askerName: 'Rahul', askerEmail: 'rahul@example.com', body: 'Is this fresher eligible?' }), '');

console.log('job-question-gemini-notify.test.mjs: OK');
