import { useState, useEffect } from 'react';
import { isPushSupported, isWebNotificationSupported } from '../../lib/webPush.js';
import { subscribeStudentToPush } from '../../services/webPushSubscriptions.js';

export default function ApplicationPushOptInCard({
  jobTitle = 'this job',
  jobCompany = 'the employer',
  studentUserId = null,
  onOptInSuccess = null,
  variant = 'card',
}) {
  const [permission, setPermission] = useState(() =>
    isWebNotificationSupported() ? Notification.permission : 'unsupported',
  );
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribedSuccess, setSubscribedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isWebNotificationSupported()) return;
    setPermission(Notification.permission);
  }, []);

  if (!isPushSupported() && permission !== 'granted') {
    return null;
  }

  const handleSubscribe = async () => {
    setErrorMsg('');
    setIsSubscribing(true);
    try {
      const res = await subscribeStudentToPush(studentUserId);
      if (res.ok) {
        setSubscribedSuccess(true);
        setPermission('granted');
        if (onOptInSuccess) onOptInSuccess();
      } else {
        if (res.permission) setPermission(res.permission);
        setErrorMsg(res.error || 'Could not enable notifications.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not enable notifications.');
    } finally {
      setIsSubscribing(false);
    }
  };

  // State: Successfully subscribed or permission already granted
  if (subscribedSuccess || permission === 'granted') {
    if (variant === 'banner') {
      return (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-900">
          <span className="text-base text-emerald-600">✓</span>
          <span>
            Instant push alerts active on this device! We&apos;ll notify you when employers update your applications.
          </span>
        </div>
      );
    }

    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs text-emerald-950">
        <div className="flex items-center gap-2">
          <span className="text-base text-emerald-600">✓</span>
          <p className="font-bold">Instant status notifications active!</p>
        </div>
        <p className="mt-1 text-[11px] text-emerald-800">
          We&apos;ll send an alert directly to this device as soon as {jobCompany || 'the employer'} views your resume, shortlists your profile, or schedules an interview.
        </p>
      </div>
    );
  }

  // State: Blocked/Denied in browser
  if (permission === 'denied') {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-semibold">⚠️ Browser notifications are blocked</p>
        <p className="mt-0.5 text-[11px] text-amber-800">
          To get real-time alerts when {jobCompany || 'employers'} update your job application, allow notifications for this site in your browser address bar settings.
        </p>
      </div>
    );
  }

  // Banner variant (for applied jobs page)
  if (variant === 'banner') {
    return (
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔔</span>
          <div>
            <p className="text-sm font-bold text-slate-900">
              Get notified when employers update your application
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              Turn on push alerts on this device so you don&apos;t miss interview invitations or shortlist updates.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={isSubscribing}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {isSubscribing ? '⏳ Activating…' : '🔔 Turn on Push Alerts'}
        </button>
      </div>
    );
  }

  // Card variant (default, for modal after applying)
  return (
    <div className="mt-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/90 to-purple-50/90 p-4 text-left sm:p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🔔</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-950">
            Get instant alerts when your status changes
          </h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Allow browser notifications on this device to get alerted the moment{' '}
            <strong className="text-slate-800">{jobCompany || 'the employer'}</strong> reviews your resume, shortlists your profile, or schedules an interview for{' '}
            <strong className="text-slate-800">{jobTitle || 'this position'}</strong>.
          </p>

          {errorMsg ? (
            <p className="mt-2 text-xs text-rose-700">⚠️ {errorMsg}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={isSubscribing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {isSubscribing ? '⏳ Activating…' : '🔔 Turn on Push Notifications'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
