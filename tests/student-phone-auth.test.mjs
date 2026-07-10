import assert from 'node:assert/strict';
import {
  isValidStudentPhone,
  normalizeStudentPhone,
  phoneToAuthEmail,
  resolveStudentSignInCredentials,
} from '../src/lib/studentPhoneAuth.js';
import {
  buildStudentAuthPath,
  readAuthReturnPath,
  shouldAutoApplyAfterAuth,
} from '../src/lib/studentApplyRedirect.js';

assert.equal(normalizeStudentPhone('9876543210'), '+919876543210');
assert.equal(normalizeStudentPhone('+91 98765 43210'), '+919876543210');
assert.ok(isValidStudentPhone('9876543210'));
assert.ok(!isValidStudentPhone('12345'));

const authEmail = phoneToAuthEmail('9876543210');
assert.equal(authEmail, '919876543210@phone.jobsinvizag.in');

const phoneCreds = resolveStudentSignInCredentials({
  identifier: '9876543210',
  password: 'secret',
});
assert.equal(phoneCreds.email, authEmail);
assert.equal(phoneCreds.phone, '+919876543210');

const emailCreds = resolveStudentSignInCredentials({
  identifier: 'student@college.edu',
  password: 'secret',
});
assert.equal(emailCreds.email, 'student@college.edu');
assert.equal(emailCreds.phone, null);

const authPath = buildStudentAuthPath({
  pathname: '/jobs/it/sample-job',
  apply: true,
});
assert.ok(authPath.includes('next=%2Fjobs%2Fit%2Fsample-job'));
assert.ok(authPath.includes('apply=1'));

const params = new URLSearchParams('next=/jobs/fresher/test&apply=1');
assert.equal(readAuthReturnPath(params), '/jobs/fresher/test');
assert.equal(shouldAutoApplyAfterAuth(params), true);

console.log('student-phone-auth.test.mjs: OK');
