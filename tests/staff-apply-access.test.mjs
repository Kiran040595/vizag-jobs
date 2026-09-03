import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isStaffApplicantSession } from '../src/lib/staffApplyAccess.js';

describe('staff apply access', () => {
  it('treats signed-in admins as staff applicants', () => {
    assert.equal(
      isStaffApplicantSession({
        session: { user: { id: 'admin-1' } },
        isStudent: false,
        isAdmin: true,
        isEmployer: false,
      }),
      true,
    );
  });

  it('treats signed-in employers as staff applicants', () => {
    assert.equal(
      isStaffApplicantSession({
        session: { user: { id: 'emp-1' } },
        isStudent: false,
        isAdmin: false,
        isEmployer: true,
      }),
      true,
    );
  });

  it('does not treat students as staff applicants', () => {
    assert.equal(
      isStaffApplicantSession({
        session: { user: { id: 'stu-1' } },
        isStudent: true,
        isAdmin: false,
        isEmployer: false,
      }),
      false,
    );
  });

  it('does not treat guests as staff applicants', () => {
    assert.equal(
      isStaffApplicantSession({
        session: null,
        isStudent: false,
        isAdmin: false,
        isEmployer: false,
      }),
      false,
    );
  });
});
