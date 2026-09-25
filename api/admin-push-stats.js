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
      opensRes,
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
          .from('push_notification_opens')
          .select('id, dispatch_id, job_id, visitor_key, user_agent, opened_at')
          .order('opened_at', { ascending: false })
          .limit(200),
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
    const opens = opensRes.data || [];
    const jobAlerts = jobAlertsRes.data || [];
    const replyNotifications = replyNotificationsRes.data || [];

    // Fetch jobs and employer profiles referenced by dispatches, alerts, and opens
    const allJobIds = [
      ...new Set(
        [
          ...dispatches.map((d) => d.job_id),
          ...jobAlerts.map((a) => a.job_id),
          ...opens.map((o) => o.job_id),
        ].filter(Boolean),
      ),
    ];

    const jobsRes =
      allJobIds.length > 0
        ? await safeQuery(
            admin
              .from('jobs')
              .select('id, title, company, location, slug, created_by, posted_at, status, source_name')
              .in('id', allJobIds),
          )
        : { data: [] };
    const jobsById = Object.fromEntries((jobsRes.data || []).map((j) => [j.id, j]));

    const creatorIds = [...new Set((jobsRes.data || []).map((j) => j.created_by).filter(Boolean))];
    const employersRes =
      creatorIds.length > 0
        ? await safeQuery(
            admin
              .from('employer_profiles')
              .select('user_id, company_name, contact_name, email')
              .in('user_id', creatorIds),
          )
        : { data: [] };
    const employersByUserId = Object.fromEntries((employersRes.data || []).map((e) => [e.user_id, e]));

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

    // Helper to resolve triggerType
    const resolveTriggerType = (dispatch, job, employer) => {
      if (dispatch.trigger_type && dispatch.trigger_type !== 'auto') {
        return dispatch.trigger_type;
      }
      const tag = String(dispatch.tag || '');
      if (tag.includes('__manual_admin')) return 'manual_admin';
      if (tag.includes('__auto_employer')) return 'auto_employer';
      if (tag.includes('__auto_admin')) return 'auto_admin';
      if (tag.includes('__manual_test') || dispatch.is_test) return 'manual_test';
      if (tag.includes('__manual_custom')) return 'manual_custom';
      if (!dispatch.job_id) return 'manual_custom';
      if (employer) return 'auto_employer';
      return 'auto_admin';
    };

    const dispatchesById = Object.fromEntries(dispatches.map((d) => [d.id, d]));

    const enrichedOpens = opens.map((open) => {
      const uaInfo = parseUserAgent(open.user_agent);
      const linkedDispatch = open.dispatch_id ? dispatchesById[open.dispatch_id] : null;
      const jobId = open.job_id || linkedDispatch?.job_id || null;
      const job = jobId ? jobsById[jobId] : null;
      return {
        ...open,
        job_id: jobId,
        jobTitle: job?.title || (linkedDispatch?.title ? linkedDispatch.title.replace(/^New job:\s*/i, '') : 'Broadcast Alert'),
        jobCompany: job?.company || null,
        jobSlug: job?.slug || null,
        deviceType: uaInfo.deviceType,
        os: uaInfo.os,
        browser: uaInfo.browser,
      };
    });

    // Analyze dispatches & build job-wise analytics
    let totalPushesSent = 0;
    let totalPushesFailed = 0;
    let totalOpens = 0;
    let autoDispatchesCount = 0;
    let manualDispatchesCount = 0;
    const jobAnalyticsMap = new Map();

    const enrichedDispatches = dispatches.map((d) => {
      totalPushesSent += d.sent_count || 0;
      totalPushesFailed += d.failed_count || 0;
      totalOpens += d.open_count || 0;

      const job = d.job_id ? jobsById[d.job_id] : null;
      const employer = job?.created_by ? employersByUserId[job.created_by] : null;
      const triggerType = resolveTriggerType(d, job, employer);
      const isAuto = triggerType === 'auto_employer' || triggerType === 'auto_admin';

      if (isAuto) autoDispatchesCount += 1;
      else manualDispatchesCount += 1;

      const jobTitle = job?.title || (d.title ? d.title.replace(/^New job:\s*/i, '') : 'Custom Broadcast');
      const jobCompany = job?.company || employer?.company_name || null;
      const jobLocation = job?.location || null;
      const jobPath = job ? `/job/${job.slug || job.id}` : d.url || '/jobs';

      if (d.job_id) {
        const existing = jobAnalyticsMap.get(d.job_id) || {
          jobId: d.job_id,
          title: jobTitle,
          company: jobCompany || 'Direct Employer',
          location: jobLocation || 'Visakhapatnam',
          url: jobPath,
          status: job?.status || 'published',
          postedAt: job?.posted_at || d.created_at,
          posterRole: employer ? 'Company / Employer' : 'Admin',
          posterName: employer?.company_name || jobCompany || 'Vizag Jobs Admin',
          dispatchesCount: 0,
          autoCount: 0,
          manualCount: 0,
          triggers: [],
          totalTarget: 0,
          totalSent: 0,
          totalFailed: 0,
          totalOpens: 0,
          lastSentAt: d.created_at,
          clicks: [],
        };

        existing.dispatchesCount += 1;
        if (isAuto) existing.autoCount += 1;
        else existing.manualCount += 1;
        if (!existing.triggers.includes(triggerType)) {
          existing.triggers.push(triggerType);
        }
        existing.totalTarget += d.target_subscribers || 0;
        existing.totalSent += d.sent_count || 0;
        existing.totalFailed += d.failed_count || 0;
        existing.totalOpens += d.open_count || 0;
        if (new Date(d.created_at) > new Date(existing.lastSentAt)) {
          existing.lastSentAt = d.created_at;
        }
        jobAnalyticsMap.set(d.job_id, existing);
      }

      return {
        ...d,
        triggerType,
        isAuto,
        jobTitle,
        jobCompany,
        jobLocation,
        jobPath,
        posterRole: employer ? 'Company / Employer' : 'Admin',
        posterName: employer?.company_name || jobCompany || 'Admin',
      };
    });

    for (const open of enrichedOpens) {
      if (open.job_id && jobAnalyticsMap.has(open.job_id)) {
        jobAnalyticsMap.get(open.job_id).clicks.push(open);
      }
    }

    const jobAnalytics = Array.from(jobAnalyticsMap.values()).map((item) => ({
      ...item,
      ctr: item.totalSent > 0 ? ((item.totalOpens / item.totalSent) * 100).toFixed(1) : '0.0',
    }));

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
        autoDispatchesCount,
        manualDispatchesCount,
        totalJobsNotified: jobAnalytics.length,
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
      jobAnalytics,
      recentDispatches: enrichedDispatches.slice(0, 50),
      recentOpens: enrichedOpens.slice(0, 50),
      recentJobAlerts: jobAlerts.slice(0, 20),
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
