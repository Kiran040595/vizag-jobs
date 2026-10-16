// Fetch each list once so the badge and rendered inbox use the same snapshot.
export async function loadNotificationInbox({ moderatorId, inboxUserId, isAdmin }, services) {
  const [questions, feedback, replies] = await Promise.all([
    moderatorId ? services.fetchQuestionNotifications(moderatorId) : [],
    moderatorId && isAdmin ? services.fetchFeedbackNotifications(moderatorId) : [],
    inboxUserId ? services.fetchReplyNotifications(inboxUserId) : [],
  ]);
  const visibleQuestions = questions.filter((item) => item.question && item.job && item.jobPath);
  const visibleFeedback = feedback.filter((item) => item.feedback);
  return {
    questions: visibleQuestions, feedback: visibleFeedback, replies,
    unreadCount: [...visibleQuestions, ...visibleFeedback, ...replies].filter((item) => !item.isRead).length,
  };
}

export async function clearNotificationInbox({ moderatorId, inboxUserId, isAdmin }, services) {
  const operations = [];
  if (moderatorId) {
    operations.push(services.dismissAllQuestionNotifications(moderatorId));
    if (isAdmin) operations.push(services.dismissAllFeedbackNotifications(moderatorId));
  }
  if (inboxUserId) operations.push(services.dismissAllReplyNotifications(inboxUserId));
  // Wait for every write before the caller reloads after a partial failure.
  const results = await Promise.allSettled(operations);
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('Some notifications could not be cleared.');
  }
}
