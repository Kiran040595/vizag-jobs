import {
  formatHiringProgressSummary,
  getHiringStageBadgeStyle,
  getHiringStageLabel,
  isHiringProgressUnlocked,
} from '../../lib/hiringProgress';
import { formatApplicationStatus } from '../../lib/applicationStatus';

export default function HiringProgressCard({ progress, applicationStatus }) {
  const isUnlocked = isHiringProgressUnlocked(progress);

  if (!isUnlocked) {
    return (
      <div className="mt-3.5 flex items-start gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-600">
        <span className="text-base leading-none">⏳</span>
        <div className="flex-1">
          <p className="font-semibold text-slate-700">Application submitted · Review pending</p>
          <p className="mt-0.5 text-slate-500">
            Hiring metrics and review progress will display here once the employer begins reviewing applications.
          </p>
        </div>
      </div>
    );
  }

  const stageLabel = getHiringStageLabel(progress.hiringStage);
  const badgeStyle = getHiringStageBadgeStyle(progress.hiringStage);

  return (
    <div className="mt-3.5 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/30 p-3.5 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeStyle}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {stageLabel}
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs">
            👥 {progress.totalApplications} Applicants
          </span>
        </div>
        {applicationStatus ? (
          <span className="text-xs font-medium text-slate-500">
            Your status: <strong className="text-indigo-700">{formatApplicationStatus(applicationStatus)}</strong>
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 text-center shadow-2xs">
          <p className="text-[11px] font-medium text-slate-500">Reviewed</p>
          <p className="mt-0.5 text-base font-bold text-slate-900">
            {progress.viewedCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 text-center shadow-2xs">
          <p className="text-[11px] font-medium text-slate-500">Shortlisted</p>
          <p className="mt-0.5 text-base font-bold text-violet-700">
            {progress.shortlistedCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 text-center shadow-2xs">
          <p className="text-[11px] font-medium text-slate-500">Interviews</p>
          <p className="mt-0.5 text-base font-bold text-amber-700">
            {progress.interviewScheduledCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 text-center shadow-2xs">
          <p className="text-[11px] font-medium text-slate-500">Hired / Joined</p>
          <p className="mt-0.5 text-base font-bold text-emerald-700">
            {progress.hiredCount}
          </p>
        </div>
      </div>

      <p className="mt-2.5 text-[11px] text-slate-500">
        💡 {formatHiringProgressSummary(progress)}
      </p>
    </div>
  );
}
