/**
 * Utility functions for candidate-facing job hiring progress & application transparency.
 *
 * Rules:
 * 1. Progress is only unlocked when totalApplications > 50 AND employer/admin has acted on at least one application.
 * 2. If locked, total application counts and funnel metrics are concealed to maintain privacy and calm UX.
 */

export const MIN_APPLICATIONS_TO_UNLOCK = 50;

export const HIRING_STAGE_LABELS = {
  reviewing: 'Actively reviewing applications',
  shortlisting: 'Shortlisting candidates',
  interviewing: 'Interviews in progress',
  hiring_completed: 'Hiring completed',
  actively_hiring: 'Actively hiring',
};

export const HIRING_STAGE_STYLES = {
  reviewing: 'border-blue-200 bg-blue-50 text-blue-700',
  shortlisting: 'border-violet-200 bg-violet-50 text-violet-700',
  interviewing: 'border-amber-200 bg-amber-50 text-amber-800',
  hiring_completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  actively_hiring: 'border-cyan-200 bg-cyan-50 text-cyan-700',
};

export const mapHiringProgressRow = (row) => {
  if (!row) return null;

  const total = Number(row.total_applications ?? row.totalApplications);
  const totalApplications = Number.isFinite(total) && total > 0 ? total : null;
  const unlocked = Boolean(row.unlocked && totalApplications !== null && totalApplications > MIN_APPLICATIONS_TO_UNLOCK);

  return {
    jobId: row.job_id || row.jobId || null,
    unlocked,
    totalApplications: unlocked ? totalApplications : null,
    viewedCount: unlocked ? Math.max(0, Number(row.viewed_count ?? row.viewedCount) || 0) : null,
    shortlistedCount: unlocked ? Math.max(0, Number(row.shortlisted_count ?? row.shortlistedCount) || 0) : null,
    interviewScheduledCount: unlocked ? Math.max(0, Number(row.interview_scheduled_count ?? row.interviewScheduledCount) || 0) : null,
    hiredCount: unlocked ? Math.max(0, Number(row.hired_count ?? row.hiredCount) || 0) : null,
    hiringStage: unlocked ? String((row.hiring_stage ?? row.hiringStage) || 'actively_hiring') : null,
    lastActivityAt: unlocked ? (row.last_activity_at || row.lastActivityAt || null) : null,
  };
};

export const isHiringProgressUnlocked = (progress) => {
  return Boolean(
    progress &&
    progress.unlocked &&
    typeof progress.totalApplications === 'number' &&
    progress.totalApplications > MIN_APPLICATIONS_TO_UNLOCK,
  );
};

export const getHiringStageLabel = (stage) => {
  const key = String(stage || '').toLowerCase();
  return HIRING_STAGE_LABELS[key] || 'Actively hiring';
};

export const getHiringStageBadgeStyle = (stage) => {
  const key = String(stage || '').toLowerCase();
  return HIRING_STAGE_STYLES[key] || 'border-slate-200 bg-slate-100 text-slate-700';
};

export const formatHiringProgressSummary = (progress) => {
  if (!isHiringProgressUnlocked(progress)) {
    return 'Application submitted · Waiting for employer review';
  }

  const parts = [];
  if (progress.viewedCount > 0) {
    parts.push(`${progress.viewedCount} viewed`);
  }
  if (progress.shortlistedCount > 0) {
    parts.push(`${progress.shortlistedCount} shortlisted`);
  }
  if (progress.interviewScheduledCount > 0) {
    parts.push(`${progress.interviewScheduledCount} interview${progress.interviewScheduledCount === 1 ? '' : 's'} scheduled`);
  }
  if (progress.hiredCount > 0) {
    parts.push(`${progress.hiredCount} hired`);
  }

  if (parts.length === 0) {
    return `${progress.totalApplications} applications received · Review in progress`;
  }

  return `Company activity: ${parts.join(' · ')}`;
};
