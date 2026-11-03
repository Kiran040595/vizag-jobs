import assert from 'node:assert/strict';
import test from 'node:test';
import { mapPlacementRecord } from '../src/services/adminPlacements.js';
import { loadNotificationInbox } from '../src/lib/notificationInbox.js';

test('mapPlacementRecord maps direct job application correctly', () => {
  const row = {
    id: 'app-101',
    job_id: 'job-55',
    student_user_id: 'user-99',
    status: 'hired',
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-03T12:00:00Z',
    job: {
      id: 'job-55',
      title: 'Frontend Developer',
      company: 'TechCorp Vizag',
      location: 'Visakhapatnam',
    },
    student: {
      user_id: 'user-99',
      full_name: 'Suresh Kumar Profile',
      contact_email: 'suresh.profile@example.com',
      phone: '9876543210',
      degree: 'B.Tech',
      branch: 'CSE',
      college: 'AU',
      graduation_year: 2024,
      is_paid: true,
      payment_amount: 5000,
      payment_date: '2026-11-03',
      placed_company: 'TechCorp Vizag',
      payment_notes: 'Paid via GPay',
    },
  };

  const record = mapPlacementRecord(row, 'direct_application');

  assert.equal(record.id, 'app-101');
  assert.equal(record.source, 'direct_application');
  assert.equal(record.jobId, 'job-55');
  assert.equal(record.jobTitle, 'Frontend Developer');
  assert.equal(record.company, 'TechCorp Vizag');
  assert.equal(record.userId, 'user-99');
  assert.equal(record.fullName, 'Suresh Kumar Profile');
  assert.equal(record.hiredStatus, 'hired');
  assert.equal(record.isPaid, true);
  assert.equal(record.paymentAmount, 5000);
  assert.equal(record.paymentDate, '2026-11-03');
  assert.equal(record.placedCompany, 'TechCorp Vizag');
  assert.equal(record.paymentNotes, 'Paid via GPay');
});

test('mapPlacementRecord maps suitable profile with snapshot fallback values when student profile missing', () => {
  const row = {
    id: 'rec-202',
    job_id: 'job-88',
    candidate_user_id: 'user-44',
    status: 'joined',
    created_at: '2026-10-20T08:00:00Z',
    updated_at: '2026-11-02T15:30:00Z',
    job: {
      id: 'job-88',
      title: 'Full Stack Engineer',
      company: 'Vizag Innovations',
    },
    profile_snapshot: {
      fullName: 'Anita Roy',
      email: 'anita@example.com',
      phone: '9123456789',
    },
  };

  const record = mapPlacementRecord(row, 'suitable_recommendation');

  assert.equal(record.id, 'rec-202');
  assert.equal(record.source, 'suitable_recommendation');
  assert.equal(record.fullName, 'Anita Roy');
  assert.equal(record.email, 'anita@example.com');
  assert.equal(record.hiredStatus, 'joined');
  assert.equal(record.isPaid, false);
  assert.equal(record.paymentAmount, null);
  assert.equal(record.placedCompany, 'Vizag Innovations');
});

test('loadNotificationInbox aggregates hire placement notifications for admin', async () => {
  const mockHires = [
    {
      id: 'hire-1',
      candidateName: 'Ramesh Naidu',
      company: 'Miracle Software',
      jobTitle: 'QA Engineer',
      isPaid: false,
      isRead: false,
      updatedAt: '2026-11-03T14:00:00Z',
    },
    {
      id: 'hire-2',
      candidateName: 'Priya Sharma',
      company: 'Wipro',
      jobTitle: 'Data Analyst',
      isPaid: true,
      isRead: true,
      updatedAt: '2026-11-02T10:00:00Z',
    },
  ];

  const inbox = await loadNotificationInbox(
    { moderatorId: 'admin-1', inboxUserId: 'admin-1', isAdmin: true },
    {
      fetchQuestionNotifications: async () => [],
      fetchFeedbackNotifications: async () => [],
      fetchReplyNotifications: async () => [],
      fetchAdminHireAlerts: async () => mockHires,
    },
  );

  assert.equal(inbox.hires.length, 2);
  // Only hire-1 is unread (isPaid=false, isRead=false)
  assert.equal(inbox.unreadCount, 1);
  assert.equal(inbox.hires[0].candidateName, 'Ramesh Naidu');
});
