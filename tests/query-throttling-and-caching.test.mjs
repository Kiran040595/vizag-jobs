import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1. Verify Job Questions Caching in jobQuestions.js
const jobQuestionsSrc = readFileSync(path.join(repoRoot, 'src/services/jobQuestions.js'), 'utf8');
assert.match(jobQuestionsSrc, /const publishedQuestionsCache = new Map\(\)/);
assert.match(jobQuestionsSrc, /const inFlightQuestionPromises = new Map\(\)/);
assert.match(jobQuestionsSrc, /PUBLISHED_QUESTIONS_TTL_MS = 3 \* 60 \* 1000/);
assert.match(jobQuestionsSrc, /export const invalidatePublishedJobQuestionsCache/);
assert.match(jobQuestionsSrc, /publishedQuestionsCache\.get\(jobId\)/);
assert.match(jobQuestionsSrc, /inFlightQuestionPromises\.get\(jobId\)/);

// 2. Verify Reply Notifications Caching in replyNotifications.js
const replyNotificationsSrc = readFileSync(path.join(repoRoot, 'src/services/replyNotifications.js'), 'utf8');
assert.match(replyNotificationsSrc, /const replyNotificationsCache = new Map\(\)/);
assert.match(replyNotificationsSrc, /const inFlightReplyPromises = new Map\(\)/);
assert.match(replyNotificationsSrc, /REPLY_NOTIFICATIONS_TTL_MS = 60 \* 1000/);
assert.match(replyNotificationsSrc, /export const invalidateReplyNotificationsCache/);
assert.match(replyNotificationsSrc, /replyNotificationsCache\.get\(userId\)/);
assert.match(replyNotificationsSrc, /inFlightReplyPromises\.get\(userId\)/);

// 3. Verify Applied Jobs Count Caching in jobApplications.js & useAppliedJobsCount.js
const jobApplicationsSrc = readFileSync(path.join(repoRoot, 'src/services/jobApplications.js'), 'utf8');
const appliedJobsHookSrc = readFileSync(path.join(repoRoot, 'src/hooks/useAppliedJobsCount.js'), 'utf8');
assert.match(jobApplicationsSrc, /export const fetchMyApplicationsCount/);
assert.match(jobApplicationsSrc, /select\('id',\s*\{\s*count:\s*'exact',\s*head:\s*true\s*\}\)/);
assert.match(jobApplicationsSrc, /COUNT_CACHE_TTL_MS = 3 \* 60 \* 1000/);
assert.match(jobApplicationsSrc, /export const invalidateAppliedJobsCount/);
assert.match(appliedJobsHookSrc, /fetchMyApplicationsCount\(userId\)/);
assert.match(appliedJobsHookSrc, /subscribeAppliedJobsCount/);

// 4. Verify QuestionNotificationBell uses shared reply channels and pauses on document.hidden
const bellSrc = readFileSync(path.join(repoRoot, 'src/components/QuestionNotificationBell.jsx'), 'utf8');
assert.match(bellSrc, /const sharedReplyChannels = new Map\(\)/);
assert.match(bellSrc, /document\.hidden/);
assert.match(bellSrc, /visibilitychange/);

console.log('query-throttling-and-caching.test.mjs: ALL VERIFICATIONS PASSED! OK');
