import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useEmployerAuth } from '../hooks/useEmployerAuth';
import { useStudentAuth } from '../hooks/useStudentAuth';
import {
  fetchQuestionNotifications,
  fetchUnreadQuestionNotificationCount,
  formatQuestionAsker,
  formatQuestionTime,
  markQuestionNotificationRead,
} from '../services/jobQuestions';
import {
  FEEDBACK_TYPE_LABELS,
  fetchFeedbackNotifications,
  fetchUnreadFeedbackNotificationCount,
  formatFeedbackAuthor,
  formatFeedbackTime,
  markFeedbackNotificationRead,
} from '../services/siteFeedback';
import {
  fetchReplyNotifications,
  fetchUnreadReplyNotificationCount,
  formatReplyNotificationTime,
  markReplyNotificationRead,
  replyNotificationKindLabel,
} from '../services/replyNotifications';

export default function QuestionNotificationBell({ className = '' }) {
  const { isAdmin, user: adminUser, isLoading: isAdminLoading } = useAdminAuth();
  const { isEmployer, user: employerUser, isLoading: isEmployerLoading } = useEmployerAuth();
  const { isStudent, session: studentSession, isLoading: isStudentLoading } = useStudentAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [questionNotifications, setQuestionNotifications] = useState([]);
  const [feedbackNotifications, setFeedbackNotifications] = useState([]);
  const [replyNotifications, setReplyNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef(null);

  const moderatorUser = adminUser || employerUser;
  const studentUser = studentSession?.user || null;
  const canModerate = Boolean(moderatorUser && (isAdmin || isEmployer));
  const isStudentViewer = Boolean(studentUser && isStudent);
  const inboxUserId = studentUser?.id || (isEmployer ? employerUser?.id : null) || null;
  const canViewBell = canModerate || isStudentViewer;
  const authLoading = isAdminLoading || isEmployerLoading || isStudentLoading;

  const loadNotifications = useCallback(async () => {
    if (!canViewBell) {
      setQuestionNotifications([]);
      setFeedbackNotifications([]);
      setReplyNotifications([]);
      setUnreadCount(0);
      return;
    }

    setIsLoading(true);
    try {
      let questionUnread = 0;
      let feedbackUnread = 0;
      let replyUnread = 0;

      if (canModerate && moderatorUser?.id) {
        const questionPromise = Promise.all([
          fetchQuestionNotifications(moderatorUser.id),
          fetchUnreadQuestionNotificationCount(moderatorUser.id),
        ]);

        const feedbackPromise = isAdmin
          ? Promise.all([
              fetchFeedbackNotifications(moderatorUser.id),
              fetchUnreadFeedbackNotificationCount(moderatorUser.id),
            ])
          : Promise.resolve([[], 0]);

        const [[questions, qUnread], [feedback, fUnread]] = await Promise.all([
          questionPromise,
          feedbackPromise,
        ]);

        setQuestionNotifications(questions);
        setFeedbackNotifications(feedback);
        questionUnread = qUnread;
        feedbackUnread = fUnread;
      } else {
        setQuestionNotifications([]);
        setFeedbackNotifications([]);
      }

      // Students: replies + application status. Employers: new applications.
      if (inboxUserId && (isStudentViewer || isEmployer)) {
        const [replies, rUnread] = await Promise.all([
          fetchReplyNotifications(inboxUserId),
          fetchUnreadReplyNotificationCount(inboxUserId),
        ]);
        setReplyNotifications(replies);
        replyUnread = rUnread;
      } else {
        setReplyNotifications([]);
      }

      setUnreadCount(questionUnread + feedbackUnread + replyUnread);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    canModerate,
    canViewBell,
    inboxUserId,
    isAdmin,
    isEmployer,
    isStudentViewer,
    moderatorUser?.id,
  ]);

  useEffect(() => {
    if (authLoading) return undefined;
    loadNotifications();

    const intervalId = window.setInterval(loadNotifications, 60_000);
    return () => window.clearInterval(intervalId);
  }, [authLoading, loadNotifications]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const combinedNotifications = useMemo(() => {
    const items = [
      ...replyNotifications.map((notification) => ({
        kind: 'reply',
        id: `reply-${notification.id}`,
        notificationId: notification.id,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        data: notification,
      })),
      ...questionNotifications.map((notification) => ({
        kind: 'job_question',
        id: `question-${notification.id}`,
        notificationId: notification.id,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        data: notification,
      })),
      ...feedbackNotifications.map((notification) => ({
        kind: 'site_feedback',
        id: `feedback-${notification.id}`,
        notificationId: notification.id,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        data: notification,
      })),
    ];

    return items.sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return rightTime - leftTime;
    });
  }, [feedbackNotifications, questionNotifications, replyNotifications]);

  if (authLoading || !canViewBell) {
    return null;
  }

  const handleOpenQuestionNotification = async (notification) => {
    if (!moderatorUser?.id) return;

    try {
      if (!notification.isRead) {
        await markQuestionNotificationRead({
          notificationId: notification.id,
          userId: moderatorUser.id,
        });
      }
    } catch (error) {
      console.error('Failed to mark question notification read:', error);
    }

    setIsOpen(false);
    loadNotifications();
  };

  const handleOpenFeedbackNotification = async (notification) => {
    if (!moderatorUser?.id) return;

    try {
      if (!notification.isRead) {
        await markFeedbackNotificationRead({
          notificationId: notification.id,
          userId: moderatorUser.id,
        });
      }
    } catch (error) {
      console.error('Failed to mark feedback notification read:', error);
    }

    setIsOpen(false);
    loadNotifications();
  };

  const handleOpenReplyNotification = async (notification) => {
    if (!inboxUserId) return;

    try {
      if (!notification.isRead) {
        await markReplyNotificationRead({
          notificationId: notification.id,
          userId: inboxUserId,
        });
      }
    } catch (error) {
      console.error('Failed to mark reply notification read:', error);
    }

    setIsOpen(false);
    loadNotifications();
  };

  const subtitle = isEmployer && !isStudentViewer
    ? 'New applications and job questions'
    : isStudentViewer && !canModerate
      ? 'Application updates and replies'
      : 'Pending moderation items and your replies';

  const emptyLabel = isEmployer && !isStudentViewer
    ? 'No new applications yet. When students apply to your jobs, they show up here.'
    : isStudentViewer && !canModerate
      ? 'No updates yet. Apply to jobs or ask a question while signed in to get notified here.'
      : 'No pending items right now.';

  return (
    <div className={`relative ${className}`.trim()} ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen((current) => !current);
          if (!isOpen) {
            loadNotifications();
          }
        }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Notifications</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
            ) : null}

            {!isLoading && combinedNotifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">{emptyLabel}</p>
            ) : null}

            {!isLoading
              ? combinedNotifications.map((item) => {
                  if (item.kind === 'reply') {
                    const notification = item.data;
                    const kindLabel = replyNotificationKindLabel(notification.kind);
                    const accentClass =
                      notification.kind === 'new_application'
                        ? 'text-cyan-700'
                        : notification.kind === 'application_status'
                          ? 'text-indigo-700'
                          : 'text-emerald-700';
                    const unreadBg =
                      notification.kind === 'new_application'
                        ? 'bg-cyan-50/50'
                        : notification.kind === 'application_status'
                          ? 'bg-indigo-50/50'
                          : 'bg-emerald-50/50';

                    return (
                      <Link
                        key={item.id}
                        to={notification.linkPath}
                        onClick={() => handleOpenReplyNotification(notification)}
                        className={`block border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 ${
                          item.isRead ? 'bg-white' : unreadBg
                        }`}
                      >
                        <p className={`text-[11px] font-semibold uppercase tracking-wide ${accentClass}`}>
                          {kindLabel}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">
                          {notification.title}
                        </p>
                        {notification.preview ? (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-600">{notification.preview}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-500">
                          {formatReplyNotificationTime(notification.createdAt)}
                        </p>
                      </Link>
                    );
                  }

                  if (item.kind === 'job_question') {
                    const notification = item.data;
                    const question = notification.question;
                    const job = notification.job;
                    const jobPath = notification.jobPath;

                    if (!question || !job || !jobPath) {
                      return null;
                    }

                    return (
                      <Link
                        key={item.id}
                        to={`${jobPath}?question=${question.id}`}
                        onClick={() => handleOpenQuestionNotification(notification)}
                        className={`block border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 ${
                          item.isRead ? 'bg-white' : 'bg-cyan-50/40'
                        }`}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                          Job question
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">{question.body}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {job.title} · {job.company}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatQuestionAsker(question)} · {formatQuestionTime(question.createdAt)}
                        </p>
                      </Link>
                    );
                  }

                  const notification = item.data;
                  const feedback = notification.feedback;

                  if (!feedback) {
                    return null;
                  }

                  const typeLabel = FEEDBACK_TYPE_LABELS[feedback.feedbackType] || 'Site feedback';

                  return (
                    <Link
                      key={item.id}
                      to={`/admin/feedback?feedback=${feedback.id}`}
                      onClick={() => handleOpenFeedbackNotification(notification)}
                      className={`block border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 ${
                        item.isRead ? 'bg-white' : 'bg-amber-50/50'
                      }`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                        Site feedback · {typeLabel}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">{feedback.body}</p>
                      {feedback.pageUrl ? (
                        <p className="mt-1 text-xs text-slate-600">From page: {feedback.pageUrl}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500">
                        {formatFeedbackAuthor(feedback)} · {formatFeedbackTime(feedback.createdAt)}
                      </p>
                    </Link>
                  );
                })
              : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
