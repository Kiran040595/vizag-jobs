import { readJsonBody, sendJson, setCors } from './_lib/http.js';
import { sendCustomWebPush } from './_lib/jobWebPush.js';
import { createServiceClient, requireUser } from './_lib/supabaseAuth.js';

async function checkIsAdmin(userId) {
  const admin = createServiceClient();
  if (!admin) return false;
  const { data } = await admin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data?.user_id);
}

function parseUserAgent(uaString) {
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

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const auth = await requireUser(req);
    if (auth.error) {
      sendJson(res, auth.status, { ok: false, error: auth.error });
      return;
    }

    const isAdmin = await checkIsAdmin(auth.user.id);
    if (!isAdmin) {
      sendJson(res, 403, { ok: false, error: 'Admin access required.' });
      return;
    }

    const admin = createServiceClient();
    if (!admin) {
      sendJson(res, 500, { ok: false, error: 'Database service client unavailable.' });
      return;
    }

    // Handle POST actions like Send Test Push
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const action = body.action || 'send_test_push';

      if (action === 'send_test_push') {
        const title = String(body.title || 'Vizag Jobs Test Alert').trim();
        const alertBody = String(body.body || 'This is a test notification from the Admin Dashboard.').trim();
        const url = String(body.url || '').trim();

        const result = await sendCustomWebPush({
          title,
          body: alertBody,
          url,
          sentBy: auth.user.id,
          isTest: true,
        });

        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 400, { ok: false, error: `Unknown action: ${action}` });
      return;
    }

    // GET: Query stats and dashboard data
    const [
      subscriptionsRes,
      dispatchesRes,
      jobAlertsRes,
      replyNotificationsRes,
      vapidConfigRes,
    ] = await Promise.all([
      safeQuery(
        admin
          .from('web_push_subscriptions')
          .select('id, user_id, user_agent, created_at, updated_at, endpoint')
          .order('created_at', { ascending: false }),
      ),
      safeQuery(
        admin
          .from('push_notification_dispatches')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
      ),
      safeQuery(
        admin
          .from('job_alerts')
          .select('id, job_id, title, preview, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
      ),
      safeQuery(
        admin
          .from('reply_notifications')
          .select('id, is_read, created_at')
          .eq('kind', 'new_job'),
      ),
      safeQuery(
        admin
          .from('web_push_config')
          .select('public_key, subject')
          .eq('id', 1)
          .maybeSingle(),
        { data: null },
      ),
    ]);

    const subscriptions = subscriptionsRes.data || [];
    const dispatches = dispatchesRes.data || [];
    const jobAlerts = jobAlertsRes.data || [];
    const replyNotifications = replyNotificationsRes.data || [];

    // Analyze subscriptions
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

      const uaInfo = parseUserAgent(sub.user_agent);
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

    // Analyze dispatches
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

    // In-app alerts
    const totalInAppSent = replyNotifications.length;
    const totalInAppRead = replyNotifications.filter((r) => r.is_read).length;
    const inAppReadRate = totalInAppSent > 0
      ? ((totalInAppRead / totalInAppSent) * 100).toFixed(1)
      : '0.0';

    const vapidConfigured = Boolean(
      process.env.VAPID_PUBLIC_KEY ||
      process.env.VITE_VAPID_PUBLIC_KEY ||
      vapidConfigRes.data?.public_key,
    );

    sendJson(res, 200, {
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
      recentJobAlerts: jobAlerts.slice(0, 15),
      subscribers: formattedSubscribers.slice(0, 50),
    });
  } catch (error) {
    console.error('admin-push-stats error:', error);
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve notification statistics.',
    });
  }
}
