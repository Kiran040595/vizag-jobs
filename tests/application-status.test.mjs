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
  'processing',
  'hired',
  'rejected',
  'withdrawn',
]);

assert.deepEqual(ADMIN_STATUS_OPTIONS, ['applied', 'viewed', 'processing', 'hired', 'rejected']);

assert.equal(normalizeApplicationStatus('submitted'), 'applied');
assert.equal(normalizeApplicationStatus('shortlisted'), 'processing');
assert.equal(normalizeApplicationStatus('hired'), 'hired');

assert.equal(formatApplicationStatus('applied'), 'Applied');
assert.equal(formatApplicationStatus('submitted'), 'Applied');
assert.equal(formatApplicationStatus('processing'), 'Processing');
assert.equal(formatApplicationStatus('shortlisted'), 'Processing');
assert.equal(formatApplicationStatus('hired'), 'Hired');

assert.match(getApplicationStatusDescription('hired'), /selected/i);
assert.match(getApplicationStatusStyle('rejected'), /rose/);

console.log('application-status.test.mjs: OK');
