import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNotificationInbox, clearNotificationInbox } from '../src/lib/notificationInbox.js';

test('student inbox fetches replies once and never requests moderator data', async () => {
  const calls = [];
  const result = await loadNotificationInbox({ inboxUserId: 'student' }, {
    fetchReplyNotifications: async (id) => { calls.push(id); return [{ isRead: false }, { isRead: true }]; },
    fetchQuestionNotifications: () => assert.fail('student requested questions'),
    fetchFeedbackNotifications: () => assert.fail('student requested feedback'),
  });
  assert.deepEqual(calls, ['student']);
  assert.equal(result.unreadCount, 1);
  assert.deepEqual(result.questions, []);
});

test('admin count matches visible rows and excludes deleted question/feedback targets', async () => {
  const calls = [];
  const result = await loadNotificationInbox({ moderatorId: 'admin', inboxUserId: 'admin', isAdmin: true }, {
    fetchQuestionNotifications: async (id) => {
      calls.push(['question', id]);
      return [{ question: {}, job: {}, jobPath: '/job/test', isRead: false }, { question: null, isRead: false }];
    },
    fetchFeedbackNotifications: async (id) => { calls.push(['feedback', id]); return [{ feedback: {}, isRead: true }, { feedback: null }]; },
    fetchReplyNotifications: async (id) => { calls.push(['reply', id]); return [{ isRead: false }]; },
  });
  assert.equal(calls.length, 3);
  assert.equal(result.unreadCount, 2);
  assert.equal(result.questions.length, 1);
  assert.equal(result.feedback.length, 1);
});

test('employer receives questions and replies without admin feedback', async () => {
  const result = await loadNotificationInbox({ moderatorId: 'employer', inboxUserId: 'employer', isAdmin: false }, {
    fetchQuestionNotifications: async () => [],
    fetchReplyNotifications: async () => [{ isRead: false }],
    fetchFeedbackNotifications: () => assert.fail('employer requested admin feedback'),
  });
  assert.equal(result.unreadCount, 1);
});

test('failed fetch rejects rather than reporting an empty inbox', async () => {
  await assert.rejects(loadNotificationInbox({ inboxUserId: 'student' }, {
    fetchReplyNotifications: async () => { throw new Error('offline'); },
  }), /offline/);
});

test('clear waits for successful writes even when another write fails', async () => {
  let finishReply;
  let completed = false;
  const operation = clearNotificationInbox({ moderatorId: 'admin', inboxUserId: 'admin', isAdmin: true }, {
    dismissAllQuestionNotifications: async () => { throw new Error('offline'); },
    dismissAllFeedbackNotifications: async () => {},
    dismissAllReplyNotifications: () => new Promise((resolve) => { finishReply = resolve; }),
  });
  const assertion = assert.rejects(operation, /could not be cleared/).then(() => { completed = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(completed, false);
  finishReply();
  await assertion;
});

test('student clear only touches that student reply inbox', async () => {
  const calls = [];
  await clearNotificationInbox({ inboxUserId: 'student' }, {
    dismissAllReplyNotifications: async (id) => calls.push(id),
  });
  assert.deepEqual(calls, ['student']);
});
