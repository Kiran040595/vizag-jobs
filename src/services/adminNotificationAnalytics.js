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

  let apiPayload = null;

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
          const alertsLen = payload.recentJobAlerts?.length || 0;
          const jobsLen = payload.jobAnalytics?.length || 0;
          if (jobsLen > 0 || alertsLen === 0) {
            return payload;
          }
          apiPayload = payload;
        }
      }
    }
  } catch {
    // API route not reachable or in Vite dev server mode; fall through to direct queries
  }

  // 2. Direct client query fallback (or enrichment if API returned unmerged job_alerts)
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
        .limit(200),
    ),
    safeQuery(
      supabase
        .from('job_alerts')
        .select('id, job_id, title, preview, link_path, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
    ),
    safeQuery(
      supabase
        .from('reply_notifications')
        .select('id, user_id, ref_id, is_read, kind, created_at')
        .eq('kind', 'new_job'),
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
  const rawDispatches = dispatchesRes.data || apiPayload?.recentDispatches || [];
  const rawOpens = opensRes.data || apiPayload?.recentOpens || [];
  const jobAlerts =
    (jobAlertsRes.data && jobAlertsRes.data.length > 0)
      ? jobAlertsRes.data
      : apiPayload?.recentJobAlerts || [];
  const replyNotifications = replyNotificationsRes.data || [];

  const allJobIds = [
    ...new Set(
      [
        ...rawDispatches.map((d) => d.job_id),
        ...jobAlerts.map((a) => a.job_id),
        ...rawOpens.map((o) => o.job_id),
      ].filter(Boolean),
    ),
  ];

  const jobsRes =
    allJobIds.length > 0
      ? await safeQuery(
          supabase
            .from('jobs')
            .select(
              'id, title, company, location, slug, created_by, reviewed_by, reviewed_at, posted_at, status, source_name, apply_click_count, application_count, seo_meta',
            )
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
            .select('user_id, company_name, contact_name, contact_email')
            .in('user_id', creatorIds),
        )
      : { data: [] };
  const employersByUserId = Object.fromEntries((employersRes.data || []).map((e) => [e.user_id, e]));

  let totalSubscribers = apiPayload?.stats?.totalSubscribers ?? subscriptions.length;
  let registeredCount = apiPayload?.stats?.registeredCount ?? 0;
  let anonymousCount = apiPayload?.stats?.anonymousCount ?? 0;
  const deviceCounts = apiPayload?.deviceBreakdown?.devices || { Mobile: 0, Desktop: 0, Tablet: 0 };
  const osCounts = apiPayload?.deviceBreakdown?.operatingSystems || {};
  const browserCounts = apiPayload?.deviceBreakdown?.browsers || {};

  const formattedSubscribers =
    apiPayload?.subscribers?.length > 0
      ? apiPayload.subscribers
      : subscriptions.map((sub, index) => {
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

  if (!apiPayload?.subscribers?.length) {
    totalSubscribers = subscriptions.length;
  }

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
    if (employer || job?.created_by || job?.reviewed_by) return 'auto_employer';
    return 'auto_admin';
  };

  // Merge dispatches from push_notification_dispatches, job.seo_meta._push_dispatches, and job_alerts
  const dispatches = [...rawDispatches];
  const seenDispatchIds = new Set(dispatches.map((d) => String(d.id)));

  for (const job of jobsRes.data || []) {
    const metaDispatches = job?.seo_meta?._push_dispatches;
    if (Array.isArray(metaDispatches)) {
      for (const md of metaDispatches) {
        if (md && md.id && !seenDispatchIds.has(String(md.id))) {
          seenDispatchIds.add(String(md.id));
          dispatches.push({
            ...md,
            job_id: md.job_id || job.id,
          });
        }
      }
    }
  }

  const autoDispatchedJobIds = new Set(
    dispatches
      .filter((d) => {
        if (!d.job_id || d.is_test) return false;
        const t = String(d.trigger_type || '');
        const tag = String(d.tag || '');
        return !t.startsWith('manual') && !tag.includes('__manual');
      })
      .map((d) => d.job_id),
  );

  for (const alert of jobAlerts) {
    if (!alert.job_id || autoDispatchedJobIds.has(alert.job_id)) continue;
    autoDispatchedJobIds.add(alert.job_id);

    const job = jobsById[alert.job_id] || null;
    const employer = job?.created_by ? employersByUserId[job.created_by] : null;
    const isEmployerJob = Boolean(employer || job?.created_by || job?.reviewed_by);
    const triggerType = isEmployerJob ? 'auto_employer' : 'auto_admin';

    const eligibleSubs = subscriptions.filter(
      (sub) => !job?.created_by || sub.user_id !== job.created_by,
    );
    const subsAtAlertTime = eligibleSubs.filter(
      (sub) => !sub.created_at || new Date(sub.created_at) <= new Date(alert.created_at),
    );
    const targetCount =
      subsAtAlertTime.length > 0
        ? subsAtAlertTime.length
        : eligibleSubs.length > 0
          ? eligibleSubs.length
          : totalSubscribers;

    const synthId = String(alert.id || `alert-${alert.job_id}`);
    if (!seenDispatchIds.has(synthId)) {
      seenDispatchIds.add(synthId);
      dispatches.push({
        id: synthId,
        job_id: alert.job_id,
        title: alert.title || `New job: ${job?.title || 'Vizag opening'}`,
        body:
          alert.preview ||
          [job?.company, job?.location || 'Visakhapatnam'].filter(Boolean).join(' · '),
        url: alert.link_path || (job?.slug ? `/job/${job.slug}` : '/jobs'),
        tag: `job-alert-${alert.job_id}__${triggerType}`,
        trigger_type: triggerType,
        is_test: false,
        sent_by: job?.reviewed_by || job?.created_by || null,
        target_subscribers: targetCount,
        sent_count: targetCount,
        failed_count: 0,
        open_count: 0,
        created_at: alert.created_at,
        updated_at: alert.created_at,
      });
    }
  }

  dispatches.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const dispatchesById = Object.fromEntries(dispatches.map((d) => [d.id, d]));
  const latestDispatchByJobId = {};
  for (const d of dispatches) {
    if (d.job_id && !latestDispatchByJobId[d.job_id]) {
      latestDispatchByJobId[d.job_id] = d;
    }
  }

  const opens = [...rawOpens];
  const seenOpenKeys = new Set(
    opens.map((o) => `${o.dispatch_id || o.job_id || 'none'}::${o.visitor_key || o.id}`),
  );

  for (const job of jobsRes.data || []) {
    const metaOpens = job?.seo_meta?._push_opens;
    if (Array.isArray(metaOpens)) {
      for (const mo of metaOpens) {
        const dispatchId = mo.dispatch_id || latestDispatchByJobId[job.id]?.id || null;
        const vKey = mo.visitor_key || mo.id || `anon-${mo.opened_at}`;
        const dedupKey = `${dispatchId || job.id}::${vKey}`;
        if (!seenOpenKeys.has(dedupKey)) {
          seenOpenKeys.add(dedupKey);
          opens.push({
            id: mo.id || dedupKey,
            dispatch_id: dispatchId,
            job_id: job.id,
            visitor_key: vKey,
            user_agent: mo.user_agent || '',
            opened_at: mo.opened_at || job.posted_at,
          });
        }
      }
    }
  }

  const subByUserId = Object.fromEntries(
    subscriptions.filter((s) => s.user_id).map((s) => [s.user_id, s]),
  );
  for (const rn of replyNotifications) {
    if (!rn.is_read || !rn.ref_id) continue;
    const linkedDispatch = latestDispatchByJobId[rn.ref_id] || null;
    const dispatchId = linkedDispatch?.id || null;
    const vKey = rn.user_id ? `user:${rn.user_id}` : `inapp:${rn.id}`;
    const dedupKey = `${dispatchId || rn.ref_id}::${vKey}`;
    const jobKey = `${rn.ref_id}::${vKey}`;
    if (!seenOpenKeys.has(dedupKey) && !seenOpenKeys.has(jobKey)) {
      seenOpenKeys.add(dedupKey);
      seenOpenKeys.add(jobKey);
      const userSub = rn.user_id ? subByUserId[rn.user_id] : null;
      opens.push({
        id: `rn-${rn.id}`,
        dispatch_id: dispatchId,
        job_id: rn.ref_id,
        visitor_key: vKey,
        user_agent: userSub?.user_agent || '',
        opened_at: rn.created_at,
      });
    }
  }

  opens.sort((a, b) => new Date(b.opened_at || 0) - new Date(a.opened_at || 0));

  const openCountByDispatchId = {};
  for (const open of opens) {
    const targetDispatchId =
      open.dispatch_id || (open.job_id ? latestDispatchByJobId[open.job_id]?.id : null);
    if (targetDispatchId) {
      openCountByDispatchId[targetDispatchId] =
        (openCountByDispatchId[targetDispatchId] || 0) + 1;
    }
  }

  const enrichedOpens = opens.map((open) => {
    const uaInfo = parseUserAgentDetails(open.user_agent);
    const linkedDispatch = open.dispatch_id ? dispatchesById[open.dispatch_id] : null;
    const jobId = open.job_id || linkedDispatch?.job_id || null;
    const job = jobId ? jobsById[jobId] : null;
    return {
      ...open,
      job_id: jobId,
      jobTitle:
        job?.title ||
        (linkedDispatch?.title ? linkedDispatch.title.replace(/^New job:\s*/i, '') : 'Broadcast Alert'),
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
    const resolvedOpenCount = Math.max(d.open_count || 0, openCountByDispatchId[d.id] || 0);
    totalPushesSent += d.sent_count || 0;
    totalPushesFailed += d.failed_count || 0;
    totalOpens += resolvedOpenCount;

    const job = d.job_id ? jobsById[d.job_id] : null;
    const employer = job?.created_by ? employersByUserId[job.created_by] : null;
    const isEmployerJob = Boolean(employer || job?.created_by || job?.reviewed_by);
    const triggerType = resolveTriggerType(d, job, employer);
    const isAuto = triggerType === 'auto_employer' || triggerType === 'auto_admin';

    if (isAuto) autoDispatchesCount += 1;
    else manualDispatchesCount += 1;

    const jobTitle = job?.title || (d.title ? d.title.replace(/^New job:\s*/i, '') : 'Custom Broadcast');
    const jobCompany = job?.company || employer?.company_name || null;
    const jobLocation = job?.location || null;
    const jobPath = job ? `/job/${job.slug || job.id}` : d.url || '/jobs';
    const posterRole = isEmployerJob ? 'Company / Employer' : 'Admin';
    const posterName =
      employer?.company_name || (isEmployerJob ? jobCompany || 'Direct Employer' : 'Vizag Jobs Admin');

    if (d.job_id) {
      const existing = jobAnalyticsMap.get(d.job_id) || {
        jobId: d.job_id,
        title: jobTitle,
        company: jobCompany || (isEmployerJob ? 'Direct Employer' : 'Vizag Jobs'),
        location: jobLocation || 'Visakhapatnam',
        url: jobPath,
        status: job?.status || 'published',
        postedAt: job?.posted_at || d.created_at,
        posterRole,
        posterName,
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
      existing.totalOpens += resolvedOpenCount;
      if (new Date(d.created_at) > new Date(existing.lastSentAt)) {
        existing.lastSentAt = d.created_at;
      }
      jobAnalyticsMap.set(d.job_id, existing);
    }

    return {
      ...d,
      open_count: resolvedOpenCount,
      triggerType,
      isAuto,
      jobTitle,
      jobCompany,
      jobLocation,
      jobPath,
      posterRole,
      posterName,
    };
  });

  for (const open of enrichedOpens) {
    if (open.job_id && jobAnalyticsMap.has(open.job_id)) {
      jobAnalyticsMap.get(open.job_id).clicks.push(open);
    }
  }

  const jobAnalytics = Array.from(jobAnalyticsMap.values())
    .map((item) => {
      const opensCount = Math.max(item.totalOpens || 0, item.clicks.length);
      return {
        ...item,
        totalOpens: opensCount,
        ctr: item.totalSent > 0 ? ((opensCount / item.totalSent) * 100).toFixed(1) : '0.0',
      };
    })
    .sort((a, b) => new Date(b.lastSentAt || 0) - new Date(a.lastSentAt || 0));

  const overallCtr = totalPushesSent > 0
    ? ((totalOpens / totalPushesSent) * 100).toFixed(1)
    : '0.0';

  const totalInAppSent = apiPayload?.stats?.totalInAppSent ?? replyNotifications.length;
  const totalInAppRead =
    apiPayload?.stats?.totalInAppRead ?? replyNotifications.filter((r) => r.is_read).length;
  const inAppReadRate = totalInAppSent > 0
    ? ((totalInAppRead / totalInAppSent) * 100).toFixed(1)
    : '0.0';

  const vapidConfigured = Boolean(
    apiPayload?.stats?.vapidConfigured ||
      import.meta.env.VITE_VAPID_PUBLIC_KEY ||
      vapidConfigRes.data?.public_key,
  );

  return {
    ok: true,
    stats: {
      totalSubscribers,
      registeredCount,
      anonymousCount,
      totalDispatches: enrichedDispatches.length,
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
