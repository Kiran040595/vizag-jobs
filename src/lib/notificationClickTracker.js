import { isSupabaseConfigured, supabase } from './supabaseClient';

const SEEN_NOTIF_KEY = 'vj_push_tracked_ids';

const getSeenNotifIds = () => {
  try {
    const raw = sessionStorage.getItem(SEEN_NOTIF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const markNotifIdSeen = (id) => {
  try {
    const ids = getSeenNotifIds();
    if (!ids.includes(id)) {
      ids.push(id);
      sessionStorage.setItem(SEEN_NOTIF_KEY, JSON.stringify(ids.slice(-50)));
    }
  } catch {
    // Ignore storage errors
  }
};

export async function checkAndTrackNotificationClick() {
  if (typeof window === 'undefined') return;

  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm_source');
  const notifId = urlParams.get('notif_id');

  if (utmSource !== 'web_push' || !notifId) {
    return;
  }

  const seen = getSeenNotifIds();
  if (seen.includes(notifId)) {
    return;
  }

  markNotifIdSeen(notifId);

  // Send ping to API or Supabase
  try {
    if (isSupabaseConfigured && supabase) {
      await supabase.rpc('record_push_notification_open', {
        p_dispatch_id: notifId,
        p_user_agent: navigator.userAgent.slice(0, 240),
      });
    } else {
      await fetch('/api/track-notification-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatchId: notifId }),
      });
    }
  } catch {
    // Fail silently
  }
}
