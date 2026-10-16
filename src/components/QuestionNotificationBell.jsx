import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pushToast } from '../lib/toast';
import { loadNotificationInbox, clearNotificationInbox } from '../lib/notificationInbox';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useEmployerAuth } from '../hooks/useEmployerAuth';
import { useStudentAuth } from '../hooks/useStudentAuth';
import {
  dismissQuestionNotification,
  dismissAllQuestionNotifications,
  fetchQuestionNotifications,
  formatQuestionAsker,
  formatQuestionTime,
  markQuestionNotificationRead,
} from '../services/jobQuestions';
import {
  FEEDBACK_TYPE_LABELS,
  dismissFeedbackNotification,
  dismissAllFeedbackNotifications,
  fetchFeedbackNotifications,
  formatFeedbackAuthor,
  formatFeedbackTime,
  markFeedbackNotificationRead,
} from '../services/siteFeedback';
import {
  dismissReplyNotification,
  dismissAllReplyNotifications,
  fetchReplyNotifications,
  formatReplyNotificationTime,
  markReplyNotificationRead,
  replyNotificationKindLabel,
} from '../services/replyNotifications';
import { supabase } from '../lib/supabaseClient';
import { isWebNotificationSupported } from '../lib/webPush';

export default function QuestionNotificationBell(props) {
  const admin = useAdminAuth();
  const employer = useEmployerAuth();
  const student = useStudentAuth();
  const identity = [admin.user?.id, admin.isAdmin, employer.user?.id, employer.isEmployer,
    student.session?.user?.id, student.isStudent, admin.isLoading, employer.isLoading, student.isLoading].join(':');
  return <NotificationBellInbox key={identity} {...props} />;
}

function NotificationBellInbox({ className = '' }) {
  const { isAdmin, user: adminUser, isLoading: isAdminLoading } = useAdminAuth();
  const { isEmployer, user: employerUser, isLoading: isEmployerLoading } = useEmployerAuth();
  const { isStudent, session: studentSession, isLoading: isStudentLoading } = useStudentAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [questionNotifications, setQuestionNotifications] = useState([]);
  const [feedbackNotifications, setFeedbackNotifications] = useState([]);
  const [replyNotifications, setReplyNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const panelRef = useRef(null);
  const popupRef = useRef(null);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const requestVersion = useRef(0);
  const mutationPending = useRef(false);
  const popupId = useId();
  const [loadError, setLoadError] = useState('');
  const [position, setPosition] = useState({ top: 80, left: 12 });

  const moderatorUser = isAdmin ? adminUser : isEmployer ? employerUser : null;
  const studentUser = studentSession?.user || null;
  const canModerate = Boolean(moderatorUser && (isAdmin || isEmployer));
  const isStudentViewer = Boolean(studentUser && isStudent);
  const inboxUserId = (isStudentViewer ? studentUser?.id : null) || (isAdmin ? adminUser?.id : null) || (isEmployer ? employerUser?.id : null) || null;
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

    if (mutationPending.current) return;
    const version = ++requestVersion.current;
    setIsLoading(true);
    setLoadError('');
    try {
      const inbox = await loadNotificationInbox({
        moderatorId: canModerate ? moderatorUser?.id : null, inboxUserId, isAdmin,
      }, { fetchQuestionNotifications, fetchFeedbackNotifications, fetchReplyNotifications });
      if (version !== requestVersion.current) return;
      setQuestionNotifications(inbox.questions);
      setFeedbackNotifications(inbox.feedback);
      setReplyNotifications(inbox.replies);
      setUnreadCount(inbox.unreadCount);
    } catch (error) {
      if (version !== requestVersion.current) return;
      console.error('Failed to load notifications:', error);
      setLoadError('Notifications could not be loaded. Please try again.');
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, [
    canModerate,
    canViewBell,
    inboxUserId,
    isAdmin,
    moderatorUser?.id,
  ]);

  const loadNotificationsRef = useRef(loadNotifications);
  useEffect(() => {
    loadNotificationsRef.current = loadNotifications;
  }, [loadNotifications]);

  useEffect(() => {
    if (authLoading) return undefined;
    loadNotifications();

    const intervalId = window.setInterval(() => {
      loadNotificationsRef.current?.();
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
      requestVersion.current += 1;
    };
  }, [authLoading, loadNotifications]);

  useEffect(() => {
    if (authLoading || !inboxUserId || !supabase) return undefined;

    const channelName = `reply-inbox-${inboxUserId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let channel = null;

    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reply_notifications',
            filter: `user_id=eq.${inboxUserId}`,
          },
          () => {
            loadNotificationsRef.current?.();
          },
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`Realtime subscription status for ${channelName}:`, status);
          }
        });
    } catch (error) {
      console.warn('Realtime subscription failed for reply notifications:', error);
    }

    return () => {
      if (channel && supabase) {
        try {
          void supabase.removeChannel(channel);
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [authLoading, inboxUserId]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target) && !popupRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(352, window.innerWidth - 24);
      setPosition({
        top: Math.min(rect.bottom + 8, Math.max(12, window.innerHeight - 240)),
        left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      });
    };
    updatePosition();
    closeRef.current?.focus();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
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
      ...questionNotifications
        .filter((notification) => notification.question && notification.job && notification.jobPath)
        .map((notification) => ({
          kind: 'job_question',
          id: `question-${notification.id}`,
          notificationId: notification.id,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
          data: notification,
        })),
      ...feedbackNotifications
        .filter((notification) => notification.feedback)
        .map((notification) => ({
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

  const handleClearAllNotifications = async () => {
    if (combinedNotifications.length === 0 || isClearing) return;

    if (mutationPending.current) return;
    mutationPending.current = true;
    requestVersion.current += 1;
    setIsLoading(false);
    setIsClearing(true);
    try {
      await clearNotificationInbox({
        moderatorId: canModerate ? moderatorUser?.id : null, inboxUserId, isAdmin,
      }, { dismissAllQuestionNotifications, dismissAllFeedbackNotifications, dismissAllReplyNotifications });
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      pushToast({ type: 'error', message: 'Some notifications could not be cleared. Please retry.' });
    } finally {
      mutationPending.current = false;
      setIsClearing(false);
      await loadNotifications();
    }
  };

  const handleDismissNotification = async (event, item) => {
    event.preventDefault();
    event.stopPropagation();

    if (mutationPending.current) return;
    mutationPending.current = true;
    requestVersion.current += 1;
    setIsLoading(false);
    setIsClearing(true);
    try {
      const dismiss = item.kind === 'reply' ? dismissReplyNotification
        : item.kind === 'job_question' ? dismissQuestionNotification : dismissFeedbackNotification;
      const userId = item.kind === 'reply' ? inboxUserId : moderatorUser?.id;
      await dismiss({ notificationId: item.notificationId, userId });
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
      pushToast({ type: 'error', message: 'Notification could not be dismissed. Please retry.' });
    } finally {
      mutationPending.current = false;
      setIsClearing(false);
      await loadNotifications();
    }
  };

  const handleOpenQuestionNotification = async (notification) => {
    setIsOpen(false);
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
      pushToast({ type: 'error', message: 'Could not mark notification as read. Please retry from the bell.' });
    }

    setIsOpen(false);
    loadNotifications();
  };

  const handleOpenFeedbackNotification = async (notification) => {
    setIsOpen(false);
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
      pushToast({ type: 'error', message: 'Could not mark notification as read. Please retry from the bell.' });
    }

    setIsOpen(false);
    loadNotifications();
  };

  const handleOpenReplyNotification = async (notification) => {
    setIsOpen(false);
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
      pushToast({ type: 'error', message: 'Could not mark notification as read. Please retry from the bell.' });
    }

    setIsOpen(false);
    loadNotifications();
  };

  const subtitle = isAdmin
    ? 'Employer updates, jobs, and moderation'
    : isEmployer && !isStudentViewer
      ? 'New applications and job questions'
      : isStudentViewer && !canModerate
        ? 'Application updates and replies'
        : 'Pending moderation items and your replies';

  const emptyLabel = isAdmin
    ? 'No new notifications right now.'
    : isEmployer && !isStudentViewer
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
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        ref={triggerRef}
        aria-controls={isOpen ? popupId : undefined}
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

      {isOpen ? createPortal(
        <div ref={popupRef} id={popupId} role="region" aria-label="Notifications" style={{ top: position.top, left: position.left, maxHeight: `calc(100dvh - ${position.top}px - 1rem - env(safe-area-inset-bottom, 0px))` }} className="fixed z-[100] flex w-[min(22rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div><p className="text-sm font-bold text-slate-900">Notifications</p>
            <p className="text-xs text-slate-500">{subtitle}</p></div>
            <button ref={closeRef} type="button" aria-label="Close notifications" onClick={() => { setIsOpen(false); triggerRef.current?.focus(); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-cyan-600">×</button>
          </div>

          <div className="min-h-0 max-h-96 overflow-y-auto overscroll-contain break-words">
            {isLoading ? (
              <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
            ) : null}

            {loadError ? (
              <div role="alert" className="px-4 py-4 text-sm text-rose-700">
                <p>{loadError}</p>
                <button type="button" onClick={loadNotifications} disabled={isLoading || isClearing} className="mt-2 min-h-11 rounded-lg border border-rose-200 px-4 font-semibold disabled:opacity-50">Retry</button>
              </div>
            ) : null}

            {!isLoading && !loadError && combinedNotifications.length === 0 ? (
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
                        : notification.kind === 'new_job'
                          ? 'text-sky-700'
                          : notification.kind === 'new_employer'
                            ? 'text-emerald-700'
                            : notification.kind === 'new_employer_job'
                              ? 'text-violet-700'
                              : notification.kind === 'application_status'
                                ? 'text-indigo-700'
                                : 'text-emerald-700';
                    const unreadBg =
                      notification.kind === 'new_application'
                        ? 'bg-cyan-50/50'
                        : notification.kind === 'new_job'
                          ? 'bg-sky-50/50'
                          : notification.kind === 'new_employer'
                            ? 'bg-emerald-50/50'
                            : notification.kind === 'new_employer_job'
                              ? 'bg-violet-50/50'
                              : notification.kind === 'application_status'
                                ? 'bg-indigo-50/50'
                                : 'bg-emerald-50/50';

                    return (
                      <div
                        key={item.id}
                        className={`group relative border-b border-slate-100 transition hover:bg-slate-50/80 ${
                          item.isRead ? 'bg-white' : unreadBg
                        }`}
                      >
                        <Link
                          to={notification.linkPath}
                          onClick={() => handleOpenReplyNotification(notification)}
                          className="block px-4 py-3 pr-16"
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
                        <button
                          type="button"
                          onClick={(e) => handleDismissNotification(e, item)}
                          className="absolute right-2.5 top-3 flex h-11 w-11 items-center justify-center rounded-md text-slate-400 opacity-60 transition hover:bg-slate-200/70 hover:text-slate-700 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          disabled={isClearing}
                          title="Dismiss notification"
                          aria-label="Dismiss notification"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
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
                      <div
                        key={item.id}
                        className={`group relative border-b border-slate-100 transition hover:bg-slate-50/80 ${
                          item.isRead ? 'bg-white' : 'bg-cyan-50/40'
                        }`}
                      >
                        <Link
                          to={`${jobPath}?question=${question.id}`}
                          onClick={() => handleOpenQuestionNotification(notification)}
                          className="block px-4 py-3 pr-16"
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
                        <button
                          type="button"
                          onClick={(e) => handleDismissNotification(e, item)}
                          className="absolute right-2.5 top-3 flex h-11 w-11 items-center justify-center rounded-md text-slate-400 opacity-60 transition hover:bg-slate-200/70 hover:text-slate-700 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          disabled={isClearing}
                          title="Dismiss notification"
                          aria-label="Dismiss notification"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  }

                  const notification = item.data;
                  const feedback = notification.feedback;

                  if (!feedback) {
                    return null;
                  }

                  const typeLabel = FEEDBACK_TYPE_LABELS[feedback.feedbackType] || 'Site feedback';

                  return (
                    <div
                      key={item.id}
                      className={`group relative border-b border-slate-100 transition hover:bg-slate-50/80 ${
                        item.isRead ? 'bg-white' : 'bg-amber-50/50'
                      }`}
                    >
                      <Link
                        to={`/admin/feedback?feedback=${feedback.id}`}
                        onClick={() => handleOpenFeedbackNotification(notification)}
                        className="block px-4 py-3 pr-16"
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
                      <button
                        type="button"
                        onClick={(e) => handleDismissNotification(e, item)}
                        className="absolute right-2.5 top-3 flex h-11 w-11 items-center justify-center rounded-md text-slate-400 opacity-60 transition hover:bg-slate-200/70 hover:text-slate-700 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        disabled={isClearing}
                          title="Dismiss notification"
                        aria-label="Dismiss notification"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })
              : null}
          </div>

          {isStudentViewer &&
          isWebNotificationSupported() &&
          Notification.permission === 'default' ? (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('vizag:enable-push-notifications'));
                setIsOpen(false);
              }}
              className="flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-between gap-2 border-t border-slate-100 bg-sky-50 px-3.5 py-2 text-left text-xs font-medium text-sky-800 transition hover:bg-sky-100"
            >
              <span>Enable browser alerts to hear about new jobs immediately.</span>
              <span className="shrink-0 rounded-md bg-sky-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                Enable
              </span>
            </button>
          ) : null}

          {combinedNotifications.length > 0 ? (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/90 px-3.5 py-2.5">
              <span className="text-xs font-medium text-slate-500">
                {combinedNotifications.length} {combinedNotifications.length === 1 ? 'notification' : 'notifications'}
              </span>
              <button
                type="button"
                onClick={handleClearAllNotifications}
                disabled={isClearing || isLoading}
                className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-3.5 w-3.5 ${isClearing ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {isClearing ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  )}
                </svg>
                <span>{isClearing ? 'Clearing…' : 'Clear all notifications'}</span>
              </button>
            </div>
          ) : null}
        </div>, document.body
      ) : null}
    </div>
  );
}
