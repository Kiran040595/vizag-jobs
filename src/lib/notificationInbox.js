// Fetch each list once so the badge and rendered inbox use the same snapshot.
export async function loadNotificationInbox({ moderatorId, inboxUserId, isAdmin }, services) {
  const [questions, feedback, replies, hires] = await Promise.all([
    moderatorId ? services.fetchQuestionNotifications(moderatorId) : [],
    moderatorId && isAdmin ? services.fetchFeedbackNotifications(moderatorId) : [],
    inboxUserId ? services.fetchReplyNotifications(inboxUserId) : [],
    isAdmin && services.fetchAdminHireAlerts ? services.fetchAdminHireAlerts() : [],
  ]);
  const visibleQuestions = questions.filter((item) => item.question && item.job && item.jobPath);
  const visibleFeedback = feedback.filter((item) => item.feedback);
  const visibleHires = hires || [];
  return {
    questions: visibleQuestions,
    feedback: visibleFeedback,
    replies,
    hires: visibleHires,
    unreadCount: [...visibleQuestions, ...visibleFeedback, ...replies, ...visibleHires].filter((item) => !item.isRead).length,
  };
}

export async function clearNotificationInbox({ moderatorId, inboxUserId, isAdmin }, services) {
  const operations = [];
  if (moderatorId) {
    operations.push(services.dismissAllQuestionNotifications(moderatorId));
    if (isAdmin) operations.push(services.dismissAllFeedbackNotifications(moderatorId));
  }
  if (inboxUserId) operations.push(services.dismissAllReplyNotifications(inboxUserId));
  if (isAdmin && services.dismissAllHireAlerts) {
    operations.push(services.dismissAllHireAlerts());
  }
  // Wait for every write before the caller reloads after a partial failure.
  const results = await Promise.allSettled(operations);
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('Some notifications could not be cleared.');
  }
}
