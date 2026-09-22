import assert from 'node:assert/strict';
import {
  ADMIN_STATUS_OPTIONS,
  APPLICATION_STATUSES,
  formatApplicationStatus,
  getApplicationStatusDescription,
  getApplicationStatusStyle,
  normalizeApplicationStatus,
} from '../src/lib/applicationStatus.js';

assert.deepEqual(APPLICATION_STATUSES, [
  'applied',
  'viewed',
  'screened',
  'interview_scheduled',
  'processing',
  'hired',
  'joined',
  'rejected',
  'withdrawn',
]);

assert.deepEqual(ADMIN_STATUS_OPTIONS, [
  'applied',
  'viewed',
  'screened',
  'interview_scheduled',
  'processing',
  'hired',
  'joined',
  'rejected',
]);

assert.equal(normalizeApplicationStatus('submitted'), 'applied');
assert.equal(normalizeApplicationStatus('shortlisted'), 'screened');
assert.equal(normalizeApplicationStatus('screened'), 'screened');
assert.equal(normalizeApplicationStatus('interview_scheduled'), 'interview_scheduled');
assert.equal(normalizeApplicationStatus('joined'), 'joined');
assert.equal(normalizeApplicationStatus('hired'), 'hired');

assert.equal(formatApplicationStatus('applied'), 'Applied');
assert.equal(formatApplicationStatus('submitted'), 'Applied');
assert.equal(formatApplicationStatus('screened'), 'Screened');
assert.equal(formatApplicationStatus('shortlisted'), 'Screened');
assert.equal(formatApplicationStatus('interview_scheduled'), 'Interview Scheduled');
assert.equal(formatApplicationStatus('processing'), 'Processing');
assert.equal(formatApplicationStatus('hired'), 'Hired');
assert.equal(formatApplicationStatus('joined'), 'Joined');
assert.equal(formatApplicationStatus('external_click'), 'External Apply Click');

assert.match(getApplicationStatusDescription('hired'), /selected/i);
assert.match(getApplicationStatusDescription('joined'), /joined/i);
assert.match(getApplicationStatusStyle('rejected'), /rose/);
assert.match(getApplicationStatusStyle('screened'), /purple/);
assert.match(getApplicationStatusStyle('interview_scheduled'), /indigo/);

console.log('application-status.test.mjs: OK');
