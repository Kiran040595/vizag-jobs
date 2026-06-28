/** @typedef {'published' | 'seo_failed' | 'publish_failed' | 'skipped_pre_seo' | 'skipped_post_seo' | 'skipped_batch_duplicate' | 'cancelled'} NaukriAutomationJobStatus */

/**
 * @typedef {Object} NaukriAutomationJobEntry
 * @property {string} key
 * @property {string} title
 * @property {string} company
 * @property {string} applyLink
 * @property {string} sourceUrl
 * @property {NaukriAutomationJobStatus} status
 * @property {string} reason
 * @property {string} [publishedSlug]
 * @property {string} [error]
 */

/**
 * @typedef {Object} NaukriAutomationReport
 * @property {string} runId
 * @property {string} startedAt
 * @property {string} [finishedAt]
 * @property {boolean} [cancelled]
 * @property {string} [apifyRunId]
 * @property {Object} stats
 * @property {NaukriAutomationJobEntry[]} jobs
 */

export const NAUKRI_AUTOMATION_REPORT_STORAGE_KEY = 'vizagjobs:naukri-automation-report:v1';

export function createEmptyAutomationReport(channel = 'naukri', channelLabel = 'Naukri') {
  return {
    channel,
    channelLabel,
    runId: `run-${channel}-${Date.now().toString(36)}`,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    cancelled: false,
    apifyRunId: null,
    stats: {
      fetched: 0,
      queued: 0,
      skippedPreSeo: 0,
      skippedBatchDuplicate: 0,
      seoOk: 0,
      seoFailed: 0,
      skippedPostSeo: 0,
      published: 0,
      publishFailed: 0,
    },
    jobs: [],
  };
}

export function summarizeAutomationReport(report) {
  const byStatus = {};
  for (const entry of report?.jobs ?? []) {
    byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
  }
  return byStatus;
}

export function buildAutomationReportFilename(report, extension = 'json') {
  const channel = report?.channel || 'naukri';
  const stamp = (report?.startedAt || new Date().toISOString()).slice(0, 19).replace(/[:T]/g, '-');
  return `${channel}-automation-report-${stamp}.${extension}`;
}

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export function buildAutomationReportCsv(report) {
  const headers = ['title', 'company', 'status', 'reason', 'error', 'apply_link', 'source_url', 'published_slug'];
  const rows = (report?.jobs ?? []).map((entry) =>
    [
      entry.title,
      entry.company,
      entry.status,
      entry.reason,
      entry.error,
      entry.applyLink,
      entry.sourceUrl,
      entry.publishedSlug,
    ]
      .map(csvEscape)
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

export function downloadAutomationReport(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = buildAutomationReportFilename(report, 'json');
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadAutomationReportCsv(report) {
  const blob = new Blob([buildAutomationReportCsv(report)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = buildAutomationReportFilename(report, 'csv');
  anchor.click();
  URL.revokeObjectURL(url);
}

export function saveAutomationReport(report) {
  try {
    localStorage.setItem(NAUKRI_AUTOMATION_REPORT_STORAGE_KEY, JSON.stringify(report));
  } catch {
    /* quota or private mode */
  }
}

export function loadAutomationReport() {
  try {
    const raw = localStorage.getItem(NAUKRI_AUTOMATION_REPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearAutomationReport() {
  localStorage.removeItem(NAUKRI_AUTOMATION_REPORT_STORAGE_KEY);
}

export const AUTOMATION_STATUS_LABELS = {
  published: { label: 'Published', className: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
  seo_failed: { label: 'SEO failed', className: 'bg-rose-100 text-rose-900 border-rose-200' },
  publish_failed: { label: 'Publish failed', className: 'bg-rose-100 text-rose-900 border-rose-200' },
  skipped_pre_seo: { label: 'Skipped (before SEO)', className: 'bg-amber-100 text-amber-900 border-amber-200' },
  skipped_post_seo: { label: 'Skipped (after SEO)', className: 'bg-amber-100 text-amber-900 border-amber-200' },
  skipped_batch_duplicate: { label: 'Duplicate in batch', className: 'bg-slate-100 text-slate-800 border-slate-200' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};
