import { useEffect, useState } from 'react';
import { isPushSupported, isWebNotificationSupported } from '../../lib/webPush';
import { subscribeStudentToPush } from '../../services/webPushSubscriptions';

const DISMISS_KEY = 'vizag_student_push_prompt_later_v1';

export default function StudentPushOptInCard({ userId }) {
  const [permission, setPermission] = useState(() => (isWebNotificationSupported() ? Notification.permission : 'unsupported'));
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isPushSupported() || permission !== 'default') return;
    const dismissedUntil = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    setVisible(dismissedUntil < Date.now());
  }, [permission]);

  if (!visible || permission !== 'default') return null;

  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await subscribeStudentToPush(userId);
      if (result.ok) {
        setPermission('granted');
        setVisible(false);
      } else {
        setPermission(result.permission || permission);
        setError(result.error || 'Could not enable notifications.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable notifications.');
    } finally {
      setBusy(false);
    }
  };

  const later = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setVisible(false);
  };

  return (
    <section className="mb-5 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-indigo-50 p-4 shadow-sm sm:p-5" aria-label="Enable job notifications">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden="true">🔔</span>
          <div>
            <h2 className="text-sm font-bold text-slate-950 sm:text-base">Never miss a matching Vizag job</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">Get instant alerts for new jobs, direct company openings, and important application updates.</p>
            {error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2 sm:flex-col lg:flex-row">
          <button type="button" onClick={() => void enable()} disabled={busy} className="min-h-11 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60">{busy ? 'Enabling…' : 'Enable job alerts'}</button>
          <button type="button" onClick={later} className="min-h-11 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-white hover:text-slate-700">Not now</button>
        </div>
      </div>
    </section>
  );
}
