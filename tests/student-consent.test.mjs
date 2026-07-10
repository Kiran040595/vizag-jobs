import assert from 'node:assert/strict';
import {
  EMPTY_STUDENT_CONSENTS,
  hasStudentRegistrationConsents,
  validateStudentConsents,
} from '../src/lib/studentConsent.js';

assert.throws(() => validateStudentConsents(EMPTY_STUDENT_CONSENTS));

assert.doesNotThrow(() =>
  validateStudentConsents({
    terms: true,
    shareWithEmployers: true,
    accurateInfo: true,
    age18: true,
  }),
);

assert.equal(hasStudentRegistrationConsents({}), false);
assert.equal(
  hasStudentRegistrationConsents({
    consent_terms_at: '2026-07-10T08:00:00.000Z',
    consent_share_with_employers_at: '2026-07-10T08:00:00.000Z',
    consent_accurate_info_at: '2026-07-10T08:00:00.000Z',
    consent_age_18_at: '2026-07-10T08:00:00.000Z',
  }),
  true,
);

console.log('student-consent.test.mjs: OK');
