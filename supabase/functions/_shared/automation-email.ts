const STATUS_LABELS: Record<string, string> = {
  published: 'Published',
  seo_failed: 'SEO failed',
  publish_failed: 'Publish failed',
  skipped_pre_seo: 'Skipped (before SEO)',
  skipped_post_seo: 'Skipped (after SEO)',
  skipped_batch_duplicate: 'Duplicate in batch',
  cancelled: 'Cancelled',
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export type AutomationReport = {
  channel?: string;
  channelLabel?: string;
  runId?: string;
  startedAt?: string;
  finishedAt?: string;
  cancelled?: boolean;
  apifyRunId?: string | null;
  stats?: Record<string, number>;
  jobs?: Array<{
    title?: string;
    company?: string;
    status?: string;
    reason?: string;
    error?: string;
    applyLink?: string;
    publishedSlug?: string;
  }>;
};

export function buildAutomationSummaryEmail(
  report: AutomationReport,
  options: { siteName?: string; adminUrl?: string } = {},
) {
  const siteName = options.siteName || 'Vizag Jobs';
  const adminUrl = options.adminUrl || 'https://jobsinvizag.in/admin/fetch';
  const stats = report?.stats || {};
  const jobs = Array.isArray(report?.jobs) ? report.jobs : [];
  const startedAt = report?.startedAt ? new Date(report.startedAt) : new Date();
  const finishedAt = report?.finishedAt ? new Date(report.finishedAt) : new Date();

  const channelLabel = report?.channelLabel || report?.channel || 'Naukri';
  const subject = `${channelLabel} automation: ${stats.published ?? 0} published / ${stats.fetched ?? jobs.length} fetched — ${startedAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

  const summaryLines = [
    `Fetched: ${stats.fetched ?? jobs.length}`,
    `Queued: ${stats.queued ?? 0}`,
    `Published: ${stats.published ?? 0}`,
    `Skipped (pre-SEO): ${stats.skippedPreSeo ?? 0}`,
    `Skipped (batch duplicate): ${stats.skippedBatchDuplicate ?? 0}`,
    `Skipped (post-SEO): ${stats.skippedPostSeo ?? 0}`,
    `SEO failed: ${stats.seoFailed ?? 0}`,
    `Publish failed: ${stats.publishFailed ?? 0}`,
  ];

  const textRows = jobs.map((job) => {
    const status = STATUS_LABELS[job.status || ''] || job.status;
    const detail = job.reason || job.error || '';
    return `- ${job.title || 'Untitled'} @ ${job.company || 'Unknown'} | ${status}${detail ? ` | ${detail}` : ''}`;
  });

  const text = [
    `${siteName} — ${channelLabel} automation summary`,
    '',
    `Run: ${report?.runId || 'unknown'}`,
    `Started: ${startedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
    `Finished: ${finishedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
    report?.apifyRunId ? `Apify run: ${report.apifyRunId}` : '',
    '',
    'Summary',
    ...summaryLines.map((line) => `  ${line}`),
    '',
    'Jobs',
    ...(textRows.length > 0 ? textRows : ['  (no job rows recorded)']),
    '',
    `Admin: ${adminUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const tableRows = jobs
    .map((job) => {
      const status = STATUS_LABELS[job.status || ''] || job.status;
      const detail = job.reason || job.error || '—';
      const apply = job.applyLink
        ? `<a href="${escapeHtml(job.applyLink)}">${escapeHtml(job.applyLink).slice(0, 60)}${String(job.applyLink).length > 60 ? '…' : ''}</a>`
        : '—';
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">
          <strong>${escapeHtml(job.title || 'Untitled')}</strong><br/>
          <span style="color:#64748b;font-size:12px;">${escapeHtml(job.company || 'Unknown')}</span>
          ${job.publishedSlug ? `<br/><span style="font-family:monospace;font-size:11px;color:#059669;">slug: ${escapeHtml(job.publishedSlug)}</span>` : ''}
        </td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px;">${escapeHtml(status)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#334155;">${escapeHtml(detail)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:11px;">${apply}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;">
  <div style="max-width:720px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
      <h1 style="margin:0 0 8px;font-size:20px;">${escapeHtml(siteName)} — ${escapeHtml(channelLabel)} automation</h1>
      <p style="margin:0 0 16px;color:#64748b;font-size:14px;">
        Run <code style="background:#f1f5f9;padding:2px 6px;border-radius:6px;">${escapeHtml(report?.runId || 'unknown')}</code>
        · ${escapeHtml(startedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))} IST
      </p>
      <div style="margin-bottom:20px;">
        ${summaryLines
          .map(
            (line) =>
              `<span style="display:inline-block;margin:0 8px 8px 0;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600;">${escapeHtml(line)}</span>`,
          )
          .join('')}
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f8fafc;text-align:left;">
            <th style="padding:10px;font-size:11px;text-transform:uppercase;color:#64748b;">Job</th>
            <th style="padding:10px;font-size:11px;text-transform:uppercase;color:#64748b;">Status</th>
            <th style="padding:10px;font-size:11px;text-transform:uppercase;color:#64748b;">Reason</th>
            <th style="padding:10px;font-size:11px;text-transform:uppercase;color:#64748b;">Apply link</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="4" style="padding:16px;color:#64748b;">No job rows recorded.</td></tr>'}
        </tbody>
      </table>
      <p style="margin:24px 0 0;font-size:13px;">
        <a href="${escapeHtml(adminUrl)}" style="color:#0891b2;font-weight:600;">Open admin fetch page</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}
