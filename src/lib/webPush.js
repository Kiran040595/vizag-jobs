const PROMPT_DISMISSED_KEY = 'vizag_job_push_prompt_dismissed_v1';

export const getVapidPublicKey = () =>
  String(import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();

export const isWebNotificationSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

export const isPushSupported = () =>
  isWebNotificationSupported() &&
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  Boolean(getVapidPublicKey());

export const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
};

export const serializePushSubscription = (subscription) => {
  if (!subscription) return null;
  const json = typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription;
  const keys = json?.keys || {};
  if (!json?.endpoint || !keys.p256dh || !keys.auth) {
    return null;
  }
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime || null,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  };
};

export const readPushPromptDismissed = () => {
  try {
    return window.localStorage.getItem(PROMPT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

export const writePushPromptDismissed = () => {
  try {
    window.localStorage.setItem(PROMPT_DISMISSED_KEY, '1');
  } catch {
    // ignore quota / private mode
  }
};

export const clearPushPromptDismissed = () => {
  try {
    window.localStorage.removeItem(PROMPT_DISMISSED_KEY);
  } catch {
    // ignore
  }
};

export const showJobAlertBrowserNotification = (alert) => {
  if (!isWebNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const title = alert?.title || 'New job on Vizag Jobs';
  const options = {
    body: alert?.body || alert?.preview || 'A new job was just published.',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: alert?.tag || 'vizag-job-alert',
    renotify: true,
    data: {
      url: alert?.linkPath || '/jobs',
    },
  };

  try {
    const registration = window.__vizagJobsSwRegistration;
    if (registration?.showNotification) {
      void registration.showNotification(title, options);
      return true;
    }
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      if (alert?.linkPath) {
        window.location.assign(alert.linkPath);
      }
      notification.close();
    };
    return true;
  } catch (error) {
    console.warn('Could not show job notification:', error);
    return false;
  }
};
