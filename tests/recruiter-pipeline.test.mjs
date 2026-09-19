import assert from 'node:assert/strict';
import {
  buildInterviewWhatsAppPassMessage,
  buildInterviewWhatsAppPassUrl,
} from '../src/lib/whatsappContact.js';
import {
  APPLICATION_EXPORT_COLUMNS,
  buildApplicationExportRows,
  summarizeApplicationStatuses,
} from '../src/lib/applicationExport.js';
import {
  APPLICATION_STATUSES,
  ADMIN_STATUS_OPTIONS,
  formatApplicationStatus,
  normalizeApplicationStatus,
  getApplicationStatusStyle,
} from '../src/lib/applicationStatus.js';

// 1. Recruiter pipeline stages check
assert.ok(APPLICATION_STATUSES.includes('screened'));
assert.ok(APPLICATION_STATUSES.includes('interview_scheduled'));
assert.ok(APPLICATION_STATUSES.includes('joined'));

assert.ok(ADMIN_STATUS_OPTIONS.includes('screened'));
assert.ok(ADMIN_STATUS_OPTIONS.includes('interview_scheduled'));
assert.ok(ADMIN_STATUS_OPTIONS.includes('joined'));

assert.equal(formatApplicationStatus('screened'), 'Screened');
assert.equal(formatApplicationStatus('interview_scheduled'), 'Interview Scheduled');
assert.equal(formatApplicationStatus('joined'), 'Joined');

// 2. WhatsApp pass generation test
const passMessage = buildInterviewWhatsAppPassMessage({
  candidateName: 'Kavya Varma',
  jobTitle: 'React Frontend Developer',
  companyName: 'Tech Innovators Vizag',
  interviewScheduledAt: '2026-09-25T10:30:00.000Z',
  interviewMode: 'in-person',
  interviewLocation: 'Level 4, IT SEZ, Rushikonda, Visakhapatnam',
  interviewInstructions: 'Please carry your updated CV, ID card, and report 15 mins prior.',
});

assert.ok(passMessage.includes('Kavya Varma'));
assert.ok(passMessage.includes('Tech Innovators Vizag'));
assert.ok(passMessage.includes('React Frontend Developer'));
assert.ok(passMessage.includes('In-Person / Office Venue'));
assert.ok(passMessage.includes('Rushikonda'));
assert.ok(passMessage.includes('Please carry your updated CV'));

const passUrl = buildInterviewWhatsAppPassUrl({
  phone: '+919876543210',
  candidateName: 'Kavya Varma',
  jobTitle: 'React Frontend Developer',
  companyName: 'Tech Innovators Vizag',
  interviewScheduledAt: '2026-09-25T10:30:00.000Z',
  interviewMode: 'online',
  interviewLocation: 'https://meet.google.com/abc-defg-hij',
});

assert.ok(passUrl.startsWith('https://wa.me/919876543210?text='));
assert.ok(passUrl.includes('Online%20%2F%20Video%20Call'));
assert.ok(passUrl.includes('https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij'));

// 3. Export columns include recruiter notes and interview details
const columnIds = APPLICATION_EXPORT_COLUMNS.map((c) => c.id);
assert.ok(columnIds.includes('recruiterNotes'));
assert.ok(columnIds.includes('interviewScheduledAt'));
assert.ok(columnIds.includes('interviewMode'));
assert.ok(columnIds.includes('interviewLocation'));
assert.ok(columnIds.includes('interviewInstructions'));

const sampleApps = [
  {
    status: 'screened',
    recruiterNotes: 'Solid JavaScript basics, communication is good.',
    profileSnapshot: {
      fullName: 'Suresh Raina',
      contactEmail: 'suresh@example.com',
      phone: '9988776655',
    },
  },
  {
    status: 'interview_scheduled',
    interviewScheduledAt: '2026-09-22T14:00:00.000Z',
    interviewMode: 'online',
    interviewLocation: 'Google Meet',
    interviewInstructions: 'Technical screening round',
    recruiterNotes: 'Invited for round 1 tech.',
    profileSnapshot: {
      fullName: 'Anita Rao',
      contactEmail: 'anita@example.com',
      phone: '9848012345',
    },
  },
  {
    status: 'joined',
    recruiterNotes: 'Offer accepted, joined on 1st Sept.',
    profileSnapshot: {
      fullName: 'Prakash Naidu',
      contactEmail: 'prakash@example.com',
      phone: '9700112233',
    },
  },
];

const { headers, rows } = buildApplicationExportRows(sampleApps, [
  'fullName',
  'status',
  'recruiterNotes',
  'interviewScheduledAt',
  'interviewMode',
  'interviewLocation',
]);

assert.deepEqual(headers, [
  'Name',
  'Application status',
  'Recruiter notes',
  'Interview scheduled at',
  'Interview mode',
  'Interview venue / link',
]);

assert.equal(rows[0][0], 'Suresh Raina');
assert.equal(rows[0][1], 'Screened');
assert.equal(rows[0][2], 'Solid JavaScript basics, communication is good.');

assert.equal(rows[1][0], 'Anita Rao');
assert.equal(rows[1][1], 'Interview Scheduled');
assert.equal(rows[1][4], 'Virtual');
assert.equal(rows[1][5], 'Google Meet');

assert.equal(rows[2][0], 'Prakash Naidu');
assert.equal(rows[2][1], 'Joined');
assert.equal(rows[2][2], 'Offer accepted, joined on 1st Sept.');

const counts = summarizeApplicationStatuses(sampleApps);
assert.equal(counts.screened, 1);
assert.equal(counts.interview_scheduled, 1);
assert.equal(counts.joined, 1);

console.log('recruiter-pipeline.test.mjs: ALL TESTS PASSED! OK');
