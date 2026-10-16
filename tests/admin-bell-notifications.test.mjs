import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  replyNotificationKindLabel,
  notifyAdminsNewEmployer,
  notifyAdminsNewEmployerJob,
} from '../src/services/replyNotifications.js';
import { loadNotificationInbox } from '../src/lib/notificationInbox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('replyNotificationKindLabel correctly maps new_employer and new_employer_job', () => {
  assert.equal(replyNotificationKindLabel('new_employer'), 'New employer');
  assert.equal(replyNotificationKindLabel('new_employer_job'), 'New employer job');
  assert.equal(replyNotificationKindLabel('new_application'), 'New application');
  assert.equal(replyNotificationKindLabel('new_job'), 'New job');
  assert.equal(replyNotificationKindLabel('application_status'), 'Application status');
  assert.equal(replyNotificationKindLabel('job_question'), 'Job question reply');
  assert.equal(replyNotificationKindLabel('site_feedback'), 'Feedback reply');
  assert.equal(replyNotificationKindLabel('unknown_kind'), 'Notification');
});

test('migration 20261016140000_admin_employer_notifications.sql includes all required triggers and checks', () => {
  const migrationPath = path.join(
    rootDir,
    'supabase/migrations/20261016140000_admin_employer_notifications.sql',
  );
  const sql = readFileSync(migrationPath, 'utf8');

  // Verify check constraint allows new kinds
  assert.match(sql, /kind in \([\s\S]*'new_employer'[\s\S]*'new_employer_job'/);

  // Verify generic notify_admins helper with admin_users iteration
  assert.match(sql, /create or replace function public\.notify_admins/);
  assert.match(sql, /select user_id from public\.admin_users/);

  // Verify employer registration trigger
  assert.match(sql, /notify_admin_on_employer_registration/);
  assert.match(sql, /on_employer_registered_notify_admin/);
  assert.match(sql, /after insert or update of company_name on public\.employer_profiles/);
  assert.match(sql, /'\/admin\/employers'/);

  // Verify employer job post trigger
  assert.match(sql, /notify_admin_on_employer_job_posted/);
  assert.match(sql, /on_employer_job_posted_notify_admin/);
  assert.match(sql, /after insert or update of status on public\.jobs/);
  assert.match(sql, /'\/admin\/jobs'/);

  // Verify safeguards: creator not null, and not an admin
  assert.match(sql, /new\.created_by is null/);
  assert.match(sql, /public\.is_admin\(new\.created_by\)/);
});

test('AdminShell renders QuestionNotificationBell in header', () => {
  const adminShellPath = path.join(rootDir, 'src/components/admin/AdminShell.jsx');
  const code = readFileSync(adminShellPath, 'utf8');

  assert.match(code, /import QuestionNotificationBell from '\.\.\/QuestionNotificationBell';/);
  assert.match(code, /<QuestionNotificationBell \/>/);
});

test('QuestionNotificationBell includes styling and admin labels for new_employer and new_employer_job', () => {
  const bellPath = path.join(rootDir, 'src/components/QuestionNotificationBell.jsx');
  const code = readFileSync(bellPath, 'utf8');

  assert.match(code, /notification\.kind === 'new_employer'/);
  assert.match(code, /text-emerald-700/);
  assert.match(code, /notification\.kind === 'new_employer_job'/);
  assert.match(code, /text-violet-700/);
  assert.match(code, /Employer updates, jobs, and moderation/);
});

test('admin notification inbox correctly counts and returns new employer and job notifications', async () => {
  const mockReplies = [
    {
      id: 'notif-1',
      kind: 'new_employer',
      ref_id: 'emp-1',
      title: 'New employer registered: Amasis Tech',
      preview: 'Ravi · IT · Vizag · hr@amasistech.com',
      link_path: '/admin/employers',
      isRead: false,
    },
    {
      id: 'notif-2',
      kind: 'new_employer_job',
      ref_id: 'job-1',
      title: 'New employer job: Senior React Developer',
      preview: 'Amasis Tech · Visakhapatnam · Pending review',
      link_path: '/admin/jobs',
      isRead: false,
    },
    {
      id: 'notif-3',
      kind: 'new_employer',
      ref_id: 'emp-2',
      title: 'New employer registered: Old Company',
      preview: '',
      link_path: '/admin/employers',
      isRead: true,
    },
  ];

  const inbox = await loadNotificationInbox(
    { moderatorId: 'admin-1', inboxUserId: 'admin-1', isAdmin: true },
    {
      fetchQuestionNotifications: async () => [],
      fetchFeedbackNotifications: async () => [],
      fetchReplyNotifications: async () => mockReplies,
    },
  );

  assert.equal(inbox.unreadCount, 2);
  assert.equal(inbox.replies.length, 3);
  assert.equal(inbox.replies[0].title, 'New employer registered: Amasis Tech');
  assert.equal(inbox.replies[1].title, 'New employer job: Senior React Developer');
});

test('createEmployerJob dispatches notifyAdminsNewEmployerJob fallback', () => {
  const employerJobsSrc = readFileSync(
    path.join(rootDir, 'src/services/employerJobs.js'),
    'utf8',
  );
  assert.match(employerJobsSrc, /notifyAdminsNewEmployerJob\(data\)/);
});

test('EmployerAuthContext invokes notifyAdminsNewEmployer upon signup', () => {
  const authContextSrc = readFileSync(
    path.join(rootDir, 'src/context/EmployerAuthContext.jsx'),
    'utf8',
  );
  assert.match(authContextSrc, /notifyAdminsNewEmployer\(\{/);
});
