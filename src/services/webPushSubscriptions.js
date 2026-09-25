import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { serializePushSubscription } from '../lib/webPush';

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
