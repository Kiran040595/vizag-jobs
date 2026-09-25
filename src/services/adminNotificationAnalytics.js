import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

export function parseUserAgentDetails(uaString) {
  const ua = String(uaString || '').toLowerCase();
  let deviceType = 'Desktop';
  if (/mobile|android|iphone|ipod/i.test(ua)) {
    deviceType = 'Mobile';
  } else if (/tablet|ipad/i.test(ua)) {
    deviceType = 'Tablet';
  }

  let os = 'Other';
  if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) os = 'iOS';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('cros')) os = 'Chrome OS';

  let browser = 'Other';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/') || ua.includes('crios/')) browser = 'Chrome';
  else if (ua.includes('firefox/') || ua.includes('fxios/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('samsungbrowser')) browser = 'Samsung Internet';
  else if (ua.includes('opr/') || ua.includes('opera/')) browser = 'Opera';

  return { deviceType, os, browser };
}

const safeQuery = async (queryBuilder, fallback = { data: [] }) => {
  try {
    const res = await queryBuilder;
    return res?.error ? fallback : res;
  } catch {
    return fallback;
  }
};

export const fetchNotificationAnalyticsData = async () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase client is not configured.');
  }

  // 1. First attempt: call backend API route /api/admin-push-stats with admin bearer token
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (token) {
      const response = await fetch('/api/admin-push-stats', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const payload = await response.json();
        if (payload?.ok) {
          return payload;
        }
      }
    }
  } catch {
    // API route not reachable or in Vite dev server mode; fall through to direct queries
  }

  // 2. Direct client query fallback (with resilient try-catches for tables)
  const [
    subscriptionsRes,
    dispatchesRes,
    opensRes,
    jobAlertsRes,
    replyNotificationsRes,
    vapidConfigRes,
  ] = await Promise.all([
    safeQuery(
      supabase
        .from('web_push_subscriptions')
        .select('id, user_id, user_agent, created_at, updated_at, endpoint')
        .order('created_at', { ascending: false }),
    ),
    safeQuery(
      supabase
        .from('push_notification_dispatches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
    ),
    safeQuery(
      supabase
        .from('push_notification_opens')
        .select('id, dispatch_id, job_id, visitor_key, user_agent, opened_at')
        .order('opened_at', { ascending: false })
        .limit(50),
    ),
    safeQuery(
      supabase
        .from('job_alerts')
        .select('id, job_id, title, preview, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ),
    safeQuery(
      supabase
        .from('reply_notifications')
        .select('id, is_read, kind, created_at'),
    ),
    safeQuery(
      supabase
        .from('web_push_config')
        .select('public_key, subject')
        .eq('id', 1)
        .maybeSingle(),
      { data: null },
    ),
  ]);

  const subscriptions = subscriptionsRes.data || [];
  const dispatches = dispatchesRes.data || [];
  const opens = opensRes.data || [];
  const jobAlerts = jobAlertsRes.data || [];
  const replyNotifications = replyNotificationsRes.data || [];

  const totalSubscribers = subscriptions.length;
  let registeredCount = 0;
  let anonymousCount = 0;
  const deviceCounts = { Mobile: 0, Desktop: 0, Tablet: 0 };
  const osCounts = {};
  const browserCounts = {};

  const formattedSubscribers = subscriptions.map((sub, index) => {
    const isRegistered = Boolean(sub.user_id);
    if (isRegistered) registeredCount += 1;
    else anonymousCount += 1;

    const uaInfo = parseUserAgentDetails(sub.user_agent);
    deviceCounts[uaInfo.deviceType] = (deviceCounts[uaInfo.deviceType] || 0) + 1;
    osCounts[uaInfo.os] = (osCounts[uaInfo.os] || 0) + 1;
    browserCounts[uaInfo.browser] = (browserCounts[uaInfo.browser] || 0) + 1;

    return {
      id: sub.id,
      key: `sub-${sub.id || index}`,
      isRegistered,
      userId: sub.user_id ? `${sub.user_id.slice(0, 8)}...` : null,
      deviceType: uaInfo.deviceType,
      os: uaInfo.os,
      browser: uaInfo.browser,
      userAgentSnippet: sub.user_agent ? sub.user_agent.slice(0, 75) : 'Unknown',
      createdAt: sub.created_at,
      updatedAt: sub.updated_at,
    };
  });

  let totalPushesSent = 0;
  let totalPushesFailed = 0;
  let totalOpens = 0;
  for (const d of dispatches) {
    totalPushesSent += d.sent_count || 0;
    totalPushesFailed += d.failed_count || 0;
    totalOpens += d.open_count || 0;
  }

  const overallCtr = totalPushesSent > 0
    ? ((totalOpens / totalPushesSent) * 100).toFixed(1)
    : '0.0';

  const totalInAppSent = replyNotifications.length;
  const totalInAppRead = replyNotifications.filter((r) => r.is_read).length;
  const inAppReadRate = totalInAppSent > 0
    ? ((totalInAppRead / totalInAppSent) * 100).toFixed(1)
    : '0.0';

  const vapidConfigured = Boolean(
    import.meta.env.VITE_VAPID_PUBLIC_KEY || vapidConfigRes.data?.public_key,
  );

  return {
    ok: true,
    stats: {
      totalSubscribers,
      registeredCount,
      anonymousCount,
      totalDispatches: dispatches.length,
      totalPushesSent,
      totalPushesFailed,
      totalOpens,
      overallCtr,
      totalJobAlerts: jobAlerts.length,
      totalInAppSent,
      totalInAppRead,
      inAppReadRate,
      vapidConfigured,
    },
    deviceBreakdown: {
      devices: deviceCounts,
      operatingSystems: osCounts,
      browsers: browserCounts,
    },
    recentDispatches: dispatches.slice(0, 30),
    recentOpens: opens.slice(0, 30),
    recentJobAlerts: jobAlerts.slice(0, 15),
    subscribers: formattedSubscribers.slice(0, 50),
  };
};

export const sendTestPushNotification = async ({ title, body, url }) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    throw new Error('You must be signed in as an administrator.');
  }

  const response = await fetch('/api/admin-push-stats', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'send_test_push',
      title,
      body,
      url,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Server responded with ${response.status}`);
  }

  return data;
};
