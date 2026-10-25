import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCredentialsUpdate,
  generateSuggestedPassword,
  formatLoginCredentialsForSharing,
  formatAuthTimestamp,
  EMAIL_REGEX,
  MIN_PASSWORD_LENGTH,
} from '../src/lib/adminUserCredentials.js';

describe('Admin User Credentials Utilities', () => {
  describe('validateCredentialsUpdate', () => {
    it('rejects when both email and password are empty', () => {
      const res = validateCredentialsUpdate({});
      assert.equal(res.valid, false);
      assert.match(res.error, /Please enter a new email/);
    });

    it('rejects invalid email formats', () => {
      const invalidEmails = ['plainaddress', '@missingusername.com', 'user@domain', 'user@.com'];
      for (const email of invalidEmails) {
        const res = validateCredentialsUpdate({ newEmail: email });
        assert.equal(res.valid, false, `Expected ${email} to be invalid`);
        assert.match(res.error, /valid email address/);
      }
    });

    it('accepts valid email and normalizes it to lowercase', () => {
      const res = validateCredentialsUpdate({ newEmail: '  TEST.User@EXAMPLE.com  ' });
      assert.equal(res.valid, true);
      assert.equal(res.cleanEmail, 'test.user@example.com');
      assert.equal(res.cleanPassword, undefined);
    });

    it('rejects password below minimum length', () => {
      const res = validateCredentialsUpdate({ newPassword: '123' });
      assert.equal(res.valid, false);
      assert.match(res.error, new RegExp(`at least ${MIN_PASSWORD_LENGTH} characters`));
    });

    it('accepts valid password and valid email together', () => {
      const res = validateCredentialsUpdate({
        newEmail: 'hr@techcorp.com',
        newPassword: 'SecretPassword#2026',
      });
      assert.equal(res.valid, true);
      assert.equal(res.cleanEmail, 'hr@techcorp.com');
      assert.equal(res.cleanPassword, 'SecretPassword#2026');
    });

    it('accepts password only when email is omitted', () => {
      const res = validateCredentialsUpdate({ newPassword: 'SecureNewPassword123' });
      assert.equal(res.valid, true);
      assert.equal(res.cleanEmail, undefined);
      assert.equal(res.cleanPassword, 'SecureNewPassword123');
    });
  });

  describe('generateSuggestedPassword', () => {
    it('generates a password meeting minimum length and containing prefix and special characters', () => {
      const pwd = generateSuggestedPassword('Vizag');
      assert.ok(pwd.length >= 10);
      assert.ok(pwd.startsWith('Vizag'));
      assert.ok(/[@#!&$]/.test(pwd));
    });
  });

  describe('formatLoginCredentialsForSharing', () => {
    it('formats employer credentials with employer portal URL', () => {
      const text = formatLoginCredentialsForSharing({
        displayName: 'Acme Infra',
        role: 'employer',
        email: 'jobs@acme.com',
        password: 'Password123!',
      });
      assert.match(text, /Acme Infra/);
      assert.match(text, /Employer Portal/);
      assert.match(text, /jobs@acme\.com/);
      assert.match(text, /Password123!/);
      assert.match(text, /\/employers\/login/);
    });

    it('formats student credentials with student portal URL', () => {
      const text = formatLoginCredentialsForSharing({
        displayName: 'Indrani S',
        role: 'student',
        email: 'indrani@example.com',
        password: 'Student#Pass2026',
      });
      assert.match(text, /Indrani S/);
      assert.match(text, /Student Portal/);
      assert.match(text, /indrani@example\.com/);
      assert.match(text, /\/students\/login/);
    });
  });

  describe('formatAuthTimestamp', () => {
    it('returns "Never" for falsy timestamps', () => {
      assert.equal(formatAuthTimestamp(null), 'Never');
      assert.equal(formatAuthTimestamp(undefined), 'Never');
      assert.equal(formatAuthTimestamp(''), 'Never');
    });

    it('formats valid ISO timestamps', () => {
      const formatted = formatAuthTimestamp('2026-10-25T10:30:00Z');
      assert.ok(formatted.includes('2026'));
      assert.ok(formatted.includes('Oct') || formatted.includes('10'));
    });
  });
});
