import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { supabase, supabasePublic } from '../lib/supabaseClient';
import {
  getVapidPublicKey,
  isPushSupported,
  isWebNotificationSupported,
  readPushPromptDismissed,
  showJobAlertBrowserNotification,
  urlBase64ToUint8Array,
  writePushPromptDismissed,
} from '../lib/webPush';
import { saveWebPushSubscription } from '../services/webPushSubscriptions';

const waitForServiceWorker = async () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    window.__vizagJobsSwRegistration = registration;
    return registration;
  } catch {
    return navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) window.__vizagJobsSwRegistration = reg;
      return reg || null;
    });
  }
};

async function syncPushSubscription(userId) {
  if (!isPushSupported()) {
    return { ok: false, skipped: true };
  }

  const registration = await Promise.race([
    waitForServiceWorker(),
    new Promise((resolve) => {
      window.setTimeout(() => resolve(null), 8000);
    }),
  ]);
  if (!registration?.pushManager) {
    return { ok: false, skipped: true, reason: 'no_sw' };
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(getVapidPublicKey()),
    });
  }

  return saveWebPushSubscription(subscription, userId);
}

const HIDDEN_PREFIXES = ['/admin', '/employer', '/oauth'];

export default function JobAlertNotifications() {
  const location = useLocation();
  const { session } = useStudentAuth();
  const userId = session?.user?.id || null;
  const isHidden = HIDDEN_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));
  const [permission, setPermission] = useState(() =>
    isWebNotificationSupported() ? Notification.permission : 'unsupported',
  );
  const [showPrompt, setShowPrompt] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const refreshPermission = useCallback(() => {
    if (!isWebNotificationSupported()) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    refreshPermission();
    const dismissed = readPushPromptDismissed();
    const canPrompt =
      isWebNotificationSupported() && Notification.permission === 'default' && !dismissed;
    setShowPrompt(canPrompt);
  }, [refreshPermission]);

  useEffect(() => {
    if (!isWebNotificationSupported() || permission !== 'granted') {
      return undefined;
    }

    void syncPushSubscription(userId);

    const client = supabasePublic || supabase;
    if (!client) {
      return undefined;
    }

    const channel = client
      .channel('job-alerts-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_alerts' },
        (payload) => {
          const row = payload?.new;
          if (!row) return;
          showJobAlertBrowserNotification({
            title: row.title,
            body: row.preview,
            linkPath: row.link_path,
            tag: `job-alert-${row.job_id}`,
          });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [permission, userId]);

  const enableNotifications = async () => {
    if (!isWebNotificationSupported()) return;
    setIsBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        writePushPromptDismissed();
        setShowPrompt(false);
        await syncPushSubscription(userId);
      }
    } catch (error) {
      console.warn('Notification permission request failed:', error);
    } finally {
      setIsBusy(false);
    }
  };

  const dismissPrompt = () => {
    writePushPromptDismissed();
    setShowPrompt(false);
  };

  if (isHidden || !showPrompt) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[4.75rem] z-40 flex justify-center px-3 sm:bottom-6 sm:justify-end sm:px-6">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-cyan-200 bg-white p-4 shadow-xl">
        <p className="text-sm font-bold text-slate-900">Get new job alerts</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Turn on browser notifications to hear about jobs as soon as an employer or admin publishes them.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void enableNotifications()}
            disabled={isBusy}
            className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-60"
          >
            {isBusy ? 'Enabling…' : 'Enable notifications'}
          </button>
          <button
            type="button"
            onClick={dismissPrompt}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
