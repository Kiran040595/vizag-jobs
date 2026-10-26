import { supabase } from './supabaseClient.js';

const DEFAULT_ORIGIN =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://jobsinvizag.in';

/**
 * Formats date/time for interview scheduled notifications.
 */
export function formatInterviewNotificationTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Builds the notification payload for an application status change.
 */
export function buildApplicationStatusPushPayload({
  applicationId,
  jobTitle = 'Job Application',
  companyName = 'Company',
  status,
  viewType = null,
  interviewScheduledAt = null,
  origin = DEFAULT_ORIGIN,
} = {}) {
  const normStatus = String(status || '').trim().toLowerCase();
  const normViewType = String(viewType || '').trim().toLowerCase();
  const cleanTitle = String(jobTitle || 'Job Application').slice(0, 80);
  const cleanCompany = String(companyName || 'Company').slice(0, 80);
  const site = origin.replace(/\/$/, '');

  let title = `Application Update: ${cleanTitle}`;
  let body = `${cleanCompany} has updated your application status.`;

  if (normStatus === 'interview_scheduled') {
    const timeText = formatInterviewNotificationTime(interviewScheduledAt);
    title = `🎉 Interview Scheduled: ${cleanTitle}`;
    body = timeText
      ? `${cleanCompany} scheduled an interview with you for ${timeText}. Tap to view location and instructions.`
      : `${cleanCompany} scheduled an interview with you. Tap to view location and instructions.`;
  } else if (normStatus === 'shortlisted') {
    title = `⭐ Profile Shortlisted: ${cleanTitle}`;
    body = `Great news! ${cleanCompany} has shortlisted your profile for the next round.`;
  } else if (normStatus === 'reviewed' || normStatus === 'viewed') {
    if (normViewType === 'phone') {
      title = `👀 Contact Viewed: ${cleanTitle}`;
      body = `${cleanCompany} just viewed your mobile number for ${cleanTitle}.`;
    } else if (normViewType === 'email') {
      title = `👀 Contact Viewed: ${cleanTitle}`;
      body = `${cleanCompany} just viewed your email address for ${cleanTitle}.`;
    } else if (normViewType === 'resume') {
      title = `👀 Resume Viewed: ${cleanTitle}`;
      body = `${cleanCompany} just opened and viewed your resume for ${cleanTitle}.`;
    } else {
      title = `👀 Resume Viewed: ${cleanTitle}`;
      body = `${cleanCompany} just reviewed your application and profile.`;
    }
  } else if (normStatus === 'hired') {
    title = `🎊 Congratulations! Hired at ${cleanCompany}`;
    body = `${cleanCompany} marked your application as Hired for ${cleanTitle}!`;
  } else if (normStatus === 'rejected') {
    title = `Application Update: ${cleanTitle}`;
    body = `${cleanCompany} has concluded review of your application for ${cleanTitle}.`;
  }

  const trackingUrl = `${site}/student/applied-jobs?application=${encodeURIComponent(
    applicationId || '',
  )}&utm_source=web_push`;

  return {
    title,
    body,
    url: trackingUrl,
    linkPath: `/student/applied-jobs?application=${applicationId || ''}`,
    tag: `app-status-${applicationId || 'update'}`,
    icon: `${site}/icon-192x192.png`,
    badge: `${site}/icon-192x192.png`,
    data: {
      url: trackingUrl,
      applicationId: applicationId || null,
      status: normStatus,
      viewType: normViewType || null,
    },
  };
}

/**
 * Triggers the web push notification endpoint when an application status changes.
 * Called by admin or employer status actions. Non-blocking (runs in background).
 */
export async function notifyApplicationStatusChange({
  applicationId,
  jobId,
  studentUserId,
  newStatus,
  oldStatus,
  viewType = null,
  forceNotify = false,
  interviewScheduledAt = null,
  interviewMode = null,
  interviewLocation = null,
  interviewInstructions = null,
}) {
  if (!applicationId || !studentUserId || !newStatus) {
    return { ok: false, skipped: true, reason: 'missing_params' };
  }

  // Do not send notifications for initial applied/submitted state
  const normNew = String(newStatus).toLowerCase();
  const normOld = String(oldStatus || '').toLowerCase();
  if (normNew === 'submitted' || normNew === 'applied') {
    return { ok: true, skipped: true, reason: 'initial_submission' };
  }
  if (normOld && normOld === normNew && !interviewScheduledAt && !viewType && !forceNotify) {
    return { ok: true, skipped: true, reason: 'status_unchanged' };
  }

  if (!supabase) {
    return { ok: false, skipped: true, reason: 'supabase_unavailable' };
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { ok: false, skipped: true, reason: 'no_session' };
    }

    const payload = {
      applicationId,
      jobId,
      studentUserId,
      newStatus: normNew,
      viewType: viewType || undefined,
      interviewScheduledAt,
      interviewMode,
      interviewLocation,
      interviewInstructions,
    };

    const res = await fetch('/api/notify-application-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data?.ok !== false, data };
  } catch (err) {
    console.warn('Could not dispatch application status push notification:', err?.message);
    return { ok: false, error: err?.message };
  }
}
