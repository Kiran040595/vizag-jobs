import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApplicationStatusPushPayload,
  formatInterviewNotificationTime,
} from '../src/lib/applicationPushNotify.js';

describe('Application Status Push Notification Utilities', () => {
  describe('formatInterviewNotificationTime', () => {
    it('returns empty string for falsy or invalid dates', () => {
      assert.equal(formatInterviewNotificationTime(null), '');
      assert.equal(formatInterviewNotificationTime(''), '');
      assert.equal(formatInterviewNotificationTime('invalid-date'), '');
    });

    it('formats a valid ISO timestamp', () => {
      const formatted = formatInterviewNotificationTime('2026-10-28T10:30:00Z');
      assert.ok(formatted.length > 0);
      assert.ok(formatted.includes('28') || formatted.includes('Oct'));
    });
  });

  describe('buildApplicationStatusPushPayload', () => {
    it('generates interview scheduled payload with time and instructions note', () => {
      const payload = buildApplicationStatusPushPayload({
        applicationId: 'app-123',
        jobTitle: 'Frontend Developer',
        companyName: 'Wipro',
        status: 'interview_scheduled',
        interviewScheduledAt: '2026-10-28T14:00:00Z',
        origin: 'https://vizagjobs.in',
      });

      assert.match(payload.title, /🎉 Interview Scheduled: Frontend Developer/);
      assert.match(payload.body, /Wipro scheduled an interview/);
      assert.equal(payload.tag, 'app-status-app-123');
      assert.match(payload.url, /https:\/\/vizagjobs\.in\/student\/applied-jobs\?application=app-123&utm_source=web_push/);
    });

    it('generates shortlisted payload', () => {
      const payload = buildApplicationStatusPushPayload({
        applicationId: 'app-456',
        jobTitle: 'Junior GIS Engineer',
        companyName: 'Aarvee Associates',
        status: 'shortlisted',
        origin: 'https://vizagjobs.in',
      });

      assert.match(payload.title, /⭐ Profile Shortlisted: Junior GIS Engineer/);
      assert.match(payload.body, /Aarvee Associates has shortlisted your profile/);
      assert.equal(payload.tag, 'app-status-app-456');
    });

    it('generates reviewed payload', () => {
      const payload = buildApplicationStatusPushPayload({
        applicationId: 'app-789',
        jobTitle: 'Accounts Executive',
        companyName: 'Miracle Software',
        status: 'reviewed',
        origin: 'https://vizagjobs.in',
      });

      assert.match(payload.title, /👀 Resume Viewed: Accounts Executive/);
      assert.match(payload.body, /Miracle Software just reviewed your application/);
    });

    it('generates hired payload', () => {
      const payload = buildApplicationStatusPushPayload({
        applicationId: 'app-999',
        jobTitle: 'Data Analyst',
        companyName: 'Tech Mahindra',
        status: 'hired',
        origin: 'https://vizagjobs.in',
      });

      assert.match(payload.title, /🎊 Congratulations! Hired at Tech Mahindra/);
      assert.match(payload.body, /marked your application as Hired for Data Analyst/);
    });

    it('generates rejected/update payload', () => {
      const payload = buildApplicationStatusPushPayload({
        applicationId: 'app-101',
        jobTitle: 'Sales Officer',
        companyName: 'HDFC',
        status: 'rejected',
        origin: 'https://vizagjobs.in',
      });

      assert.match(payload.title, /Application Update: Sales Officer/);
      assert.match(payload.body, /HDFC has concluded review/);
    });

    it('uses fallbacks for missing jobTitle and companyName', () => {
      const payload = buildApplicationStatusPushPayload({
        applicationId: 'app-default',
        status: 'shortlisted',
      });

      assert.match(payload.title, /Job Application/);
      assert.match(payload.body, /Company/);
    });
  });
});
