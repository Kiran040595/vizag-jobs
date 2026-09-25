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
          supabase
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
          supabase
            .from('employer_profiles')
            .select('user_id, company_name, contact_name, email')
            .in('user_id', creatorIds),
        )
      : { data: [] };
  const employersByUserId = Object.fromEntries((employersRes.data || []).map((e) => [e.user_id, e]));

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
    const uaInfo = parseUserAgentDetails(open.user_agent);
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
