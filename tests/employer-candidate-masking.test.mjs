import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maskPhoneNumber, maskEmail } from '../src/lib/contactMasking.js';
import { buildApplicationStatusPushPayload } from '../src/lib/applicationPushNotify.js';

describe('Employer Candidate Contact Masking & View Notifications', () => {
  describe('maskPhoneNumber', () => {
    it('returns empty string for null, undefined, or non-string input', () => {
      assert.equal(maskPhoneNumber(null), '');
      assert.equal(maskPhoneNumber(undefined), '');
      assert.equal(maskPhoneNumber(''), '');
      assert.equal(maskPhoneNumber('   '), '');
    });

    it('masks standard 10-digit Indian mobile numbers correctly', () => {
      const masked = maskPhoneNumber('9876543210');
      assert.equal(masked, '98••••••10');
      // Ensure private middle digits 765432 are NOT exposed
      assert.ok(!masked.includes('765432'));
    });

    it('masks phone numbers with +91 country code and spaces/dashes', () => {
      const maskedWithPlus = maskPhoneNumber('+91 9876543210');
      assert.equal(maskedWithPlus, '+91 98••••••10');

      const maskedWithDash = maskPhoneNumber('+91-98765-43210');
      assert.equal(maskedWithDash, '+91 98••••••10');
    });

    it('masks international numbers preserving country code and first/last digits', () => {
      const maskedUs = maskPhoneNumber('+1 5551234567');
      assert.equal(maskedUs, '+1 55••••••67');
    });

    it('handles short or malformed phone numbers without leaking or throwing', () => {
      assert.equal(maskPhoneNumber('1234'), '••••••••');
      const maskedShort = maskPhoneNumber('123456');
      assert.ok(maskedShort.includes('••••'));
    });
  });

  describe('maskEmail', () => {
    it('returns empty string for null, undefined, or empty input', () => {
      assert.equal(maskEmail(null), '');
      assert.equal(maskEmail(undefined), '');
      assert.equal(maskEmail(''), '');
      assert.equal(maskEmail('   '), '');
    });

    it('masks standard email addresses hiding personal username while showing domain', () => {
      const masked = maskEmail('kiran.reddy@gmail.com');
      assert.equal(masked, 'ki••••••@gmail.com');
      assert.ok(!masked.includes('reddy'));
      assert.ok(masked.endsWith('@gmail.com'));
    });

    it('masks email with short local part safely', () => {
      const masked = maskEmail('me@company.org');
      assert.equal(masked, 'me••••••@company.org');

      const singleChar = maskEmail('a@domain.com');
      assert.equal(singleChar, 'a••••••@domain.com');
    });

    it('handles invalid email formats without @ safely', () => {
      assert.equal(maskEmail('invalidemail'), '••••••');
    });
  });

  describe('buildApplicationStatusPushPayload with viewType', () => {
    it('tailors push notification when employer views mobile number', () => {
      const payload = buildApplicationStatusPushPayload({
        applicationId: 'app-view-phone',
        jobTitle: 'Full Stack Engineer',
        companyName: 'Infosys',
        status: 'viewed',
        viewType: 'phone',
        origin: 'https://vizagjobs.in',
      });

      assert.match(payload.title, /👀 Contact Viewed: Full Stack Engineer/);
      assert.match(payload.body, /Infosys just viewed your mobile number for Full Stack Engineer\./);
      assert.equal(payload.data.viewType, 'phone');
      assert.equal(payload.data.status, 'viewed');
      assert.match(payload.url, /applied-jobs\?application=app-view-phone/);
    });

    it('tailors push notification when employer views email address', () => {
      const payload = buildApplicationStatusPushPayload({
        applicationId: 'app-view-email',
        jobTitle: 'Data Analyst',
        companyName: 'Wipro',
        status: 'viewed',
        viewType: 'email',
        origin: 'https://vizagjobs.in',
      });

      assert.match(payload.title, /👀 Contact Viewed: Data Analyst/);
      assert.match(payload.body, /Wipro just viewed your email address for Data Analyst\./);
      assert.equal(payload.data.viewType, 'email');
    });

    it('tailors push notification when employer views resume', () => {
      const payload = buildApplicationStatusPushPayload({
        applicationId: 'app-view-resume',
        jobTitle: 'Accounts Officer',
        companyName: 'Miracle Software',
        status: 'viewed',
        viewType: 'resume',
        origin: 'https://vizagjobs.in',
      });

      assert.match(payload.title, /👀 Resume Viewed: Accounts Officer/);
      assert.match(payload.body, /Miracle Software just opened and viewed your resume for Accounts Officer\./);
      assert.equal(payload.data.viewType, 'resume');
    });

    it('uses standard reviewed/viewed copy when viewType is not specified', () => {
      const payload = buildApplicationStatusPushPayload({
        applicationId: 'app-view-default',
        jobTitle: 'Sales Manager',
        companyName: 'HDFC',
        status: 'viewed',
        origin: 'https://vizagjobs.in',
      });

      assert.match(payload.title, /👀 Resume Viewed: Sales Manager/);
      assert.match(payload.body, /HDFC just reviewed your application and profile\./);
    });
  });
});
