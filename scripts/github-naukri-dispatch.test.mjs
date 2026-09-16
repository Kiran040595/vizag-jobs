import assert from 'node:assert/strict';
import test from 'node:test';
import { timingSafeEqual } from 'node:crypto';
import { isAuthorizedCronRequest } from '../api/_lib/cronAuth.js';
import {
  shouldSkipNaukriDispatch,
  triggerNaukriWorkflowIfIdle,
} from './lib/github-naukri-dispatch.mjs';

test('skips when a Naukri run is already in progress', () => {
  const decision = shouldSkipNaukriDispatch([
    { status: 'in_progress', created_at: '2026-09-16T10:00:00Z' },
  ]);
  assert.equal(decision.skip, true);
  assert.match(decision.reason, /in_progress/);
});

test('skips a successful run from earlier the same window', () => {
  const now = Date.parse('2026-09-16T11:00:00Z');
  const decision = shouldSkipNaukriDispatch(
    [{ status: 'completed', conclusion: 'success', created_at: '2026-09-16T04:00:00Z' }],
    { now },
  );
  assert.equal(decision.skip, true);
  assert.match(decision.reason, /12 hours/);
});

test('allows a new run after yesterday failed', () => {
  const now = Date.parse('2026-09-16T11:00:00Z');
  const decision = shouldSkipNaukriDispatch(
    [{ status: 'completed', conclusion: 'failure', created_at: '2026-09-15T15:09:53Z' }],
    { now },
  );
  assert.equal(decision.skip, false);
});

test('debounces two schedulers firing together', () => {
  const now = Date.parse('2026-09-16T11:00:30Z');
  const decision = shouldSkipNaukriDispatch(
    [{ status: 'completed', conclusion: 'failure', created_at: '2026-09-16T10:55:00Z' }],
    { now },
  );
  assert.equal(decision.skip, true);
  assert.match(decision.reason, /20 minutes/);
});

test('cron auth accepts Vercel CRON_SECRET bearer', () => {
  const req = { headers: { authorization: 'Bearer cron-test-secret' } };
  assert.equal(
    isAuthorizedCronRequest(req, { CRON_SECRET: 'cron-test-secret', FETCH_JOBS_CRON_SECRET: '' }),
    true,
  );
  assert.equal(
    isAuthorizedCronRequest(req, { CRON_SECRET: 'other', FETCH_JOBS_CRON_SECRET: '' }),
    false,
  );
});

test('cron auth accepts Vercel platform cron headers without CRON_SECRET', () => {
  const req = {
    headers: {
      'user-agent': 'vercel-cron/1.0',
      'x-vercel-cron-schedule': '0 11 * * *',
    },
  };
  assert.equal(isAuthorizedCronRequest(req, { CRON_SECRET: '' }), true);
  assert.equal(
    isAuthorizedCronRequest({ headers: { 'user-agent': 'vercel-cron/1.0' } }, { CRON_SECRET: '' }),
    false,
  );
});

test('cron auth rejects empty or missing secrets', () => {
  assert.equal(
    isAuthorizedCronRequest({ headers: { authorization: 'Bearer x' } }, { CRON_SECRET: '' }),
    false,
  );
  assert.equal(timingSafeEqual(Buffer.from('ab'), Buffer.from('ab')), true);
});

test('idle trigger dispatches once', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET' });
    if (String(url).includes('/runs')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ workflow_runs: [] }),
      };
    }
    return { ok: true, text: async () => '' };
  };

  const result = await triggerNaukriWorkflowIfIdle(
    {
      token: 'token',
      repo: 'Kiran040595/vizag-jobs',
      ref: 'develop',
      workflowFile: 'auto-naukri-fetch.yml',
    },
    { fetchImpl },
  );

  assert.equal(result.queued, true);
  assert.equal(result.skipped, false);
  assert.equal(calls.some((call) => call.method === 'POST'), true);
});
