import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { serializePushSubscription } from '../lib/webPush';

export const saveWebPushSubscription = async (subscription, userId = null) => {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, skipped: true, reason: 'config' };
  }

  const payload = serializePushSubscription(subscription);
  if (!payload) {
    return { ok: false, skipped: true, reason: 'subscription' };
  }

  const row = {
    endpoint: payload.endpoint,
    p256dh: payload.keys.p256dh,
    auth: payload.keys.auth,
    expiration_time: payload.expirationTime,
    user_id: userId || null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 240) : null,
  };

  const { error } = await supabase.from('web_push_subscriptions').upsert(row, {
    onConflict: 'endpoint',
  });

  if (error) {
    console.warn('Could not save web push subscription:', error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
};

export const deleteWebPushSubscription = async (endpoint) => {
  if (!isSupabaseConfigured || !supabase || !endpoint) {
    return { ok: false, skipped: true };
  }

  const { error } = await supabase.from('web_push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) {
    console.warn('Could not delete web push subscription:', error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
};
