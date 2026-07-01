import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useEmployerAuth } from '../hooks/useEmployerAuth';
import {
  fetchQuestionNotifications,
  fetchUnreadQuestionNotificationCount,
  formatQuestionAsker,
  formatQuestionTime,
  markQuestionNotificationRead,
} from '../services/jobQuestions';

export default function QuestionNotificationBell() {
  const { isAdmin, user: adminUser, isLoading: isAdminLoading } = useAdminAuth();
  const { isEmployer, user: employerUser, isLoading: isEmployerLoading } = useEmployerAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef(null);

  const user = adminUser || employerUser;
  const canModerate = Boolean(user && (isAdmin || isEmployer));
  const authLoading = isAdminLoading || isEmployerLoading;

  const loadNotifications = useCallback(async () => {
    if (!user?.id || !canModerate) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setIsLoading(true);
    try {
      const [items, count] = await Promise.all([
        fetchQuestionNotifications(user.id),
        fetchUnreadQuestionNotificationCount(user.id),
      ]);
      setNotifications(items);
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load question notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [canModerate, user?.id]);

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

  if (authLoading || !canModerate) {
    return null;
  }

  const handleOpenNotification = async (notification) => {
    if (!user?.id) return;

    try {
      if (!notification.isRead) {
        await markQuestionNotificationRead({
          notificationId: notification.id,
          userId: user.id,
        });
      }
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }

    setIsOpen(false);
    loadNotifications();
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen((current) => !current);
          if (!isOpen) {
            loadNotifications();
          }
        }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        aria-label={`Job question notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
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
            <p className="text-sm font-bold text-slate-900">Job questions</p>
            <p className="text-xs text-slate-500">New doubts waiting for review</p>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
            ) : null}

            {!isLoading && notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No pending questions right now.</p>
            ) : null}

            {!isLoading
              ? notifications.map((notification) => {
                  const question = notification.question;
                  const job = notification.job;
                  const jobPath = notification.jobPath;

                  if (!question || !job || !jobPath) {
                    return null;
                  }

                  return (
                    <Link
                      key={notification.id}
                      to={`${jobPath}?question=${question.id}`}
                      onClick={() => handleOpenNotification(notification)}
                      className={`block border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 ${
                        notification.isRead ? 'bg-white' : 'bg-cyan-50/40'
                      }`}
                    >
                      <p className="line-clamp-2 text-sm font-medium text-slate-900">{question.body}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {job.title} · {job.company}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatQuestionAsker(question)} · {formatQuestionTime(question.createdAt)}
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
