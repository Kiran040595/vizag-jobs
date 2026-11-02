import { useEffect, useState } from 'react';
import { isPushSupported, isWebNotificationSupported } from '../../lib/webPush';
import { subscribeStudentToPush } from '../../services/webPushSubscriptions';

const DISMISS_KEY = 'vizag_student_push_prompt_later_v1';

export default function StudentPushOptInCard({ userId }) {
  const [permission, setPermission] = useState(() => (isWebNotificationSupported() ? Notification.permission : 'unsupported'));
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('new matching jobs and important application updates');
  const [preferences, setPreferences] = useState({ matching: true, direct: true, applications: true });

  useEffect(() => {
    if (!isPushSupported() || permission !== 'default') return;
    let dismissedUntil = 0;
    try {
      dismissedUntil = Number(window.localStorage?.getItem(DISMISS_KEY) || 0);
    } catch {
      // ignore
    }
    setVisible(dismissedUntil < Date.now());
  }, [permission]);

  useEffect(() => {
    const handleContextPrompt = (event) => {
      setReason(event.detail?.reason || 'new matching jobs and important application updates');
      setVisible(true);
    };
    window.addEventListener('vizag:push-context-prompt', handleContextPrompt);
    return () => window.removeEventListener('vizag:push-context-prompt', handleContextPrompt);
  }, []);

  if (!visible || permission !== 'default') return null;

  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await subscribeStudentToPush(userId);
      if (result.ok) {
        try {
        window.localStorage?.setItem('vizag_student_push_preferences_v1', JSON.stringify(preferences));
        window.localStorage?.setItem('vizag_student_push_optin_attempt_v1', new Date().toISOString());
      } catch {
        // Storage blocked
      }
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
    try {
      window.localStorage?.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    } catch {
      // Storage blocked
    }
    setVisible(false);
  };

  return (
    <section className="mb-5 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-indigo-50 p-4 shadow-sm sm:p-5" aria-label="Enable job notifications">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden="true">🔔</span>
          <div>
            <h2 className="text-sm font-bold text-slate-950 sm:text-base">Never miss a matching Vizag job</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">Get alerts for {reason}.</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
              {Object.entries({ matching: 'Matching jobs', direct: 'Direct company jobs', applications: 'Application updates' }).map(([key, label]) => <label key={key} className="inline-flex items-center gap-1"><input type="checkbox" checked={preferences[key]} onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}
            </div>
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
