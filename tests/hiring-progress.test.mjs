import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MIN_APPLICATIONS_TO_UNLOCK,
  formatHiringProgressSummary,
  getHiringStageBadgeStyle,
  getHiringStageLabel,
  isHiringProgressUnlocked,
  mapHiringProgressRow,
} from '../src/lib/hiringProgress.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jobApplicationsSrc = readFileSync(path.join(repoRoot, 'src/services/jobApplications.js'), 'utf8');
const studentApplicationsPageSrc = readFileSync(path.join(repoRoot, 'src/pages/StudentApplicationsPage.jsx'), 'utf8');
const jobDetailsPageSrc = readFileSync(path.join(repoRoot, 'src/pages/JobDetailsPage.jsx'), 'utf8');
const hiringProgressCardSrc = readFileSync(path.join(repoRoot, 'src/components/student/HiringProgressCard.jsx'), 'utf8');

test('MIN_APPLICATIONS_TO_UNLOCK is set to 50', () => {
  assert.equal(MIN_APPLICATIONS_TO_UNLOCK, 50);
});

test('isHiringProgressUnlocked strictly requires total applications > 50 and unlocked flag', () => {
  // Over threshold and unlocked -> true
  assert.equal(
    isHiringProgressUnlocked({ unlocked: true, totalApplications: 51 }),
    true,
  );
  assert.equal(
    isHiringProgressUnlocked({ unlocked: true, totalApplications: 85 }),
    true,
  );

  // Exactly 50 (not greater than 50) -> false
  assert.equal(
    isHiringProgressUnlocked({ unlocked: true, totalApplications: 50 }),
    false,
  );

  // Less than 50 -> false
  assert.equal(
    isHiringProgressUnlocked({ unlocked: true, totalApplications: 24 }),
    false,
  );

  // Over threshold but employer has not taken action (unlocked is false) -> false
  assert.equal(
    isHiringProgressUnlocked({ unlocked: false, totalApplications: 90 }),
    false,
  );

  // Missing or null -> false
  assert.equal(isHiringProgressUnlocked(null), false);
  assert.equal(isHiringProgressUnlocked({}), false);
});

test('mapHiringProgressRow conceals metrics when locked and reveals when unlocked', () => {
  // 1. Locked row from DB (e.g. 15 applications or employer hasn't reviewed yet)
  const lockedRow = {
    job_id: 'job-1',
    unlocked: false,
    total_applications: 15,
    viewed_count: null,
    shortlisted_count: null,
    interview_scheduled_count: null,
    hired_count: null,
    hiring_stage: null,
  };
  const mappedLocked = mapHiringProgressRow(lockedRow);
  assert.equal(mappedLocked.unlocked, false);
  assert.equal(mappedLocked.totalApplications, null);
  assert.equal(mappedLocked.viewedCount, null);
  assert.equal(mappedLocked.hiringStage, null);

  // 2. Unlocked row from DB (total 74, reviewed and shortlisted)
  const unlockedRow = {
    job_id: 'job-2',
    unlocked: true,
    total_applications: 74,
    viewed_count: 28,
    shortlisted_count: 6,
    interview_scheduled_count: 2,
    hired_count: 0,
    hiring_stage: 'interviewing',
    last_activity_at: '2026-10-25T10:00:00Z',
  };
  const mappedUnlocked = mapHiringProgressRow(unlockedRow);
  assert.equal(mappedUnlocked.unlocked, true);
  assert.equal(mappedUnlocked.totalApplications, 74);
  assert.equal(mappedUnlocked.viewedCount, 28);
  assert.equal(mappedUnlocked.shortlistedCount, 6);
  assert.equal(mappedUnlocked.interviewScheduledCount, 2);
  assert.equal(mappedUnlocked.hiredCount, 0);
  assert.equal(mappedUnlocked.hiringStage, 'interviewing');
});

test('stage labels and badge styles format correctly', () => {
  assert.equal(getHiringStageLabel('reviewing'), 'Actively reviewing applications');
  assert.equal(getHiringStageLabel('shortlisting'), 'Shortlisting candidates');
  assert.equal(getHiringStageLabel('interviewing'), 'Interviews in progress');
  assert.equal(getHiringStageLabel('hiring_completed'), 'Hiring completed');

  assert.ok(getHiringStageBadgeStyle('interviewing').includes('amber'));
  assert.ok(getHiringStageBadgeStyle('hiring_completed').includes('emerald'));
});

test('formatHiringProgressSummary formats unlocked funnel breakdown and locked fallback', () => {
  const locked = { unlocked: false, totalApplications: 12 };
  assert.match(formatHiringProgressSummary(locked), /Application submitted/);

  const unlocked = {
    unlocked: true,
    totalApplications: 62,
    viewedCount: 30,
    shortlistedCount: 4,
    interviewScheduledCount: 1,
    hiredCount: 0,
  };
  const summary = formatHiringProgressSummary(unlocked);
  assert.match(summary, /30 viewed/);
  assert.match(summary, /4 shortlisted/);
  assert.match(summary, /1 interview scheduled/);
});

test('services export fetchMyAppliedJobsHiringProgress and fetchJobHiringProgress', () => {
  assert.match(jobApplicationsSrc, /export const fetchMyAppliedJobsHiringProgress/);
  assert.match(jobApplicationsSrc, /export const fetchJobHiringProgress/);
  assert.match(jobApplicationsSrc, /get_my_applied_jobs_hiring_progress/);
  assert.match(jobApplicationsSrc, /get_job_hiring_progress/);
});

test('StudentApplicationsPage loads and displays HiringProgressCard', () => {
  assert.match(studentApplicationsPageSrc, /fetchMyAppliedJobsHiringProgress/);
  assert.match(studentApplicationsPageSrc, /HiringProgressCard/);
  assert.match(studentApplicationsPageSrc, /hiringProgressByJobId/);
});

test('JobDetailsPage displays HiringProgressCard for applied students', () => {
  assert.match(jobDetailsPageSrc, /fetchJobHiringProgress/);
  assert.match(jobDetailsPageSrc, /HiringProgressCard/);
  assert.match(jobDetailsPageSrc, /appliedHiringProgress/);
});

test('HiringProgressCard renders unlocked breakdown and locked pending message', () => {
  assert.match(hiringProgressCardSrc, /isHiringProgressUnlocked/);
  assert.match(hiringProgressCardSrc, /Application submitted · Review pending/);
  assert.match(hiringProgressCardSrc, /progress\.totalApplications/);
  assert.match(hiringProgressCardSrc, /Reviewed/);
  assert.match(hiringProgressCardSrc, /Shortlisted/);
  assert.match(hiringProgressCardSrc, /Interviews/);
});
