import { useState } from 'react';
import {
  AUTOMATION_STATUS_LABELS,
  downloadAutomationReport,
  downloadAutomationReportCsv,
  summarizeAutomationReport,
} from '../../lib/naukriAutomationReport';

function StatusPill({ status }) {
  const meta = AUTOMATION_STATUS_LABELS[status] || {
    label: status,
    className: 'bg-slate-100 text-slate-800 border-slate-200',
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export default function NaukriAutomationReportPanel({
  report,
  onClear,
  onSendEmail,
  emailSummary,
}) {
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState('');

  if (!report || !Array.isArray(report.jobs) || report.jobs.length === 0) {
    return null;
  }

  const byStatus = summarizeAutomationReport(report);
  const finishedLabel = report.finishedAt
    ? new Date(report.finishedAt).toLocaleString()
    : 'In progress';
  const summary = emailSummary || report.emailSummary;

  const handleSendEmail = async () => {
    if (!onSendEmail) return;
    setEmailBusy(true);
    setEmailError('');
    try {
      await onSendEmail(report);
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Could not send email.');
    } finally {
      setEmailBusy(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950">
            {report.channelLabel ? `${report.channelLabel} automation report` : 'Automation report'}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Run {report.runId} · Started {new Date(report.startedAt).toLocaleString()} · Finished{' '}
            {finishedLabel}
            {report.apifyRunId ? (
              <>
                {' '}
                · Apify <span className="font-mono text-xs">{report.apifyRunId}</span>
              </>
            ) : null}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Download the full report below, or email the same summary to your inbox.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadAutomationReport(report)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            Download JSON
          </button>
          <button
            type="button"
            onClick={() => downloadAutomationReportCsv(report)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            Download CSV
          </button>
          {onSendEmail ? (
            <button
              type="button"
              disabled={emailBusy}
              onClick={handleSendEmail}
              className="rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-900 transition hover:bg-cyan-100 disabled:opacity-50"
            >
              {emailBusy ? 'Sending…' : 'Email summary'}
            </button>
          ) : null}
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Clear report
            </button>
          ) : null}
        </div>
      </div>

      {summary?.to ? (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Email sent to <strong>{summary.to}</strong>
          {summary.sentAt ? ` · ${new Date(summary.sentAt).toLocaleString()}` : ''}
        </p>
      ) : summary?.error ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Email not sent: {summary.error}
        </p>
      ) : null}

      {emailError ? (
        <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {emailError}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
          Fetched: {report.stats?.fetched ?? report.jobs.length}
        </span>
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-900">
          Queued: {report.stats?.queued ?? 0}
        </span>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-900">
          Published: {byStatus.published ?? 0}
        </span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900">
          Skipped: {(byStatus.skipped_pre_seo ?? 0) + (byStatus.skipped_post_seo ?? 0) + (byStatus.skipped_batch_duplicate ?? 0)}
        </span>
        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-900">
          Failed: {(byStatus.seo_failed ?? 0) + (byStatus.publish_failed ?? 0)}
        </span>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Only <strong>queued</strong> jobs go through Make SEO. Most fetched jobs are usually skipped because
        they already exist in the database or have no apply link.
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Reason / detail</th>
              <th className="px-3 py-2">Apply link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.jobs.map((entry) => (
              <tr key={entry.key} className="align-top">
                <td className="px-3 py-3">
                  <p className="font-semibold text-slate-900">{entry.title || 'Untitled'}</p>
                  <p className="text-xs text-slate-600">{entry.company || 'Unknown'}</p>
                  {entry.publishedSlug ? (
                    <p className="mt-1 font-mono text-[10px] text-emerald-700">slug: {entry.publishedSlug}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <StatusPill status={entry.status} />
                </td>
                <td className="px-3 py-3 text-xs text-slate-700">
                  {entry.reason || entry.error || '—'}
                </td>
                <td className="max-w-[14rem] px-3 py-3">
                  {entry.applyLink ? (
                    <a
                      href={entry.applyLink}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all font-mono text-[10px] text-cyan-700 hover:underline"
                    >
                      {entry.applyLink}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">None</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
