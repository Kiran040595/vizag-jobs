import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import {
  serializePushSubscription,
  isPushSupported,
  getVapidPublicKey,
  urlBase64ToUint8Array,
} from '../lib/webPush.js';

const expirationToIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const saveWebPushSubscription = async (subscription, userId = null) => {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, skipped: true, reason: 'config' };
  }

  const payload = serializePushSubscription(subscription);
  if (!payload) {
    return { ok: false, skipped: true, reason: 'subscription' };
  }

  const { error } = await supabase.rpc('register_web_push_subscription', {
    p_endpoint: payload.endpoint,
    p_p256dh: payload.keys.p256dh,
    p_auth: payload.keys.auth,
    p_expiration: expirationToIso(payload.expirationTime),
    p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 240) : null,
  });

  if (error) {
    console.warn('Could not save web push subscription:', error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, userId: userId || null };
};

export const deleteWebPushSubscription = async (endpoint) => {
  if (!isSupabaseConfigured || !supabase || !endpoint) {
    return { ok: false, skipped: true };
  }

  const { error } = await supabase.rpc('unregister_web_push_subscription', {
    p_endpoint: endpoint,
  });
  if (error) {
    console.warn('Could not delete web push subscription:', error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
};

/**
 * Opt-in helper: Requests browser notification permission, obtains service worker push subscription,
 * and saves it linked to the student's user ID.
 * @param {string | null} userId - Authenticated student user UUID
 * @returns {Promise<{ ok: boolean, permission?: string, subscription?: any, error?: string }>}
 */
export const subscribeStudentToPush = async (userId = null) => {
  if (!isPushSupported()) {
    return { ok: false, error: 'Push notifications are not supported on this browser or device.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, permission, error: 'Notification permission was not granted.' };
  }

  const registration =
    window.__vizagJobsSwRegistration ||
    (await navigator.serviceWorker?.ready.catch(() => null));

  if (!registration?.pushManager) {
    return { ok: false, error: 'Service worker push manager is not available.' };
  }

  const vapidKey = getVapidPublicKey();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  const result = await saveWebPushSubscription(subscription, userId);
  return { ok: result?.ok !== false, subscription, permission: 'granted' };
};
