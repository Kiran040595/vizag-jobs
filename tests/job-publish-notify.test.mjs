/**
 * Unit tests for direct-portal job publish notifications.
 *
 * Run with: node tests/job-publish-notify.test.mjs
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import {
  buildJobAlertLinkPath,
  buildJobAlertNotification,
  buildJobAlertPreview,
  buildJobAlertTitle,
  isDirectPortalJob,
  shouldNotifyJobPublish,
} from '../src/lib/jobPublishNotify.js';
import { urlBase64ToUint8Array } from '../src/lib/webPush.js';

assert.equal(
  isDirectPortalJob({
    created_by: '11111111-1111-1111-1111-111111111111',
    source_name: '',
  }),
  true,
  'employer-owned jobs are direct portal posts',
);

assert.equal(
  isDirectPortalJob({
    createdBy: null,
    source_name: '',
    source_url: '',
  }),
  true,
  'admin jobs without a scrape source are direct portal posts',
);

assert.equal(
  isDirectPortalJob({
    source_name: 'naukri.com',
    source_url: 'https://www.naukri.com/job-listings-123',
  }),
  false,
  'naukri imports are not direct portal posts',
);

assert.equal(
  isDirectPortalJob({
    source: 'Direct Company Website',
    source_url: 'https://example.com/careers',
  }),
  false,
  'company-career imports are not direct portal posts',
);

assert.equal(
  shouldNotifyJobPublish({
    status: 'published',
    created_by: '11111111-1111-1111-1111-111111111111',
  }),
  true,
);

assert.equal(
  shouldNotifyJobPublish(
    {
      status: 'published',
      created_by: '11111111-1111-1111-1111-111111111111',
    },
    'published',
  ),
  false,
  'already-published updates should not notify again',
);

assert.equal(
  shouldNotifyJobPublish({
    status: 'pending',
    created_by: '11111111-1111-1111-1111-111111111111',
  }),
  false,
  'pending employer submissions should wait for admin approval',
);

assert.equal(
  shouldNotifyJobPublish({
    status: 'published',
    source_name: 'linkedin.com',
  }),
  false,
);

assert.equal(buildJobAlertLinkPath({ slug: 'react-developer-vizag' }), '/job/react-developer-vizag');
assert.match(buildJobAlertTitle({ title: 'React Developer' }), /React Developer/);
assert.match(buildJobAlertPreview({ company: 'Acme', location: 'Vizag' }), /Acme/);

const payload = buildJobAlertNotification({
  id: 'job-1',
  slug: 'react-developer-vizag',
  title: 'React Developer',
  company: 'Acme',
  location: 'Vizag',
});
assert.equal(payload.tag, 'job-alert-job-1');
assert.equal(payload.linkPath, '/job/react-developer-vizag');

const bytes = urlBase64ToUint8Array('AQID');
assert.deepEqual([...bytes], [1, 2, 3]);

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration = readFileSync(
  path.join(repoRoot, 'supabase/migrations/20260925_job_publish_web_notifications.sql'),
  'utf8',
);
assert.match(migration, /kind in \([\s\S]*'new_job'/);
assert.match(migration, /create table if not exists public.job_alerts/);
assert.match(migration, /create table if not exists public.web_push_subscriptions/);
assert.match(migration, /create trigger on_job_published_notify_seekers/);
assert.match(migration, /from public.student_profiles sp/);
assert.match(migration, /alter publication supabase_realtime add table public.job_alerts/);

const adminJobsSrc = readFileSync(path.join(repoRoot, 'src/services/adminJobs.js'), 'utf8');
assert.match(adminJobsSrc, /notifyNewJobPublishedSafe/);
assert.match(adminJobsSrc, /rememberPublishedJob/);

const appSrc = readFileSync(path.join(repoRoot, 'src/App.jsx'), 'utf8');
assert.match(appSrc, /JobAlertNotifications/);

console.log('job-publish-notify.test.mjs: OK');
