import { pipelineConfig } from './pipeline-env.mjs';

export function getSendAutomationSummaryUrl() {
  const base = pipelineConfig.supabaseUrl;
  if (!base) return '';
  return `${base}/functions/v1/send-automation-summary`;
}

/**
 * Email automation report via Supabase Edge Function + Resend.
 * @param {Record<string, unknown>} report
 * @param {{ to?: string }} [options]
 */
export async function sendAutomationSummaryEmail(report, options = {}) {
  const url = getSendAutomationSummaryUrl();
  if (!url) {
    throw new Error('Missing SUPABASE_URL for email summary.');
  }
  if (!pipelineConfig.cronSecret) {
    throw new Error('Missing FETCH_JOBS_CRON_SECRET for email summary.');
  }
  if (!pipelineConfig.supabaseAnonKey) {
    throw new Error('Missing SUPABASE_ANON_KEY for email summary.');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: pipelineConfig.supabaseAnonKey,
      Authorization: `Bearer ${pipelineConfig.cronSecret}`,
      'x-fetch-jobs-cron-secret': pipelineConfig.cronSecret,
    },
    body: JSON.stringify({
      report,
      to: options.to,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `Email summary failed (${res.status})`);
  }

  return data;
}
