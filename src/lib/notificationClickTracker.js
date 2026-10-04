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
  const notifId = urlParams.get('notif_id') || '';
  const jobId = urlParams.get('job_id') || '';

  if (utmSource !== 'web_push' && !notifId) {
    return;
  }

  const pathMatch = window.location.pathname.match(/^\/job\/([^/?#]+)/i);
  const jobSlug = pathMatch ? decodeURIComponent(pathMatch[1]) : '';
  const trackingKey = notifId || jobId || (utmSource === 'web_push' ? jobSlug : '');

  if (!trackingKey) {
    return;
  }

  const seen = getSeenNotifIds();
  if (seen.includes(trackingKey)) {
    return;
  }

  markNotifIdSeen(trackingKey);

  let visitorKey = `v_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
  try {
    if (isSupabaseConfigured && supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;
      if (currentUserId) {
        visitorKey = `user:${currentUserId}`;
      }
    }
  } catch {
    // Keep generated visitorKey
  }

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 240) : '';

  // Send ping to API first (service role handles both RPC and fallback storage), with Supabase RPC fallback
  try {
    const response = await fetch('/api/track-notification-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dispatchId: notifId || null,
        jobId: jobId || null,
        jobSlug: jobSlug || null,
        visitorKey,
      }),
    });
    if (response.ok) {
      const payload = await response.json().catch(() => null);
      if (payload?.ok) return;
    }
  } catch {
    // Fall through to direct Supabase RPC
  }

  try {
    if (isSupabaseConfigured && supabase) {
      await supabase.rpc('record_push_notification_open', {
        p_dispatch_id: notifId || null,
        p_job_id: jobId || null,
        p_visitor_key: visitorKey,
        p_user_agent: userAgent,
      });
    }
  } catch {
    // Fail silently
  }
}

