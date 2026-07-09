/**
 * Send Naukri automation summary email via Supabase Edge Function.
 */

export function getSendAutomationSummaryUrl() {
  const base = import.meta.env.VITE_SUPABASE_URL?.trim()?.replace(/\/$/, '');
  if (!base) {
    return '';
  }
  return `${base}/functions/v1/send-automation-summary`;
}

/**
 * @param {string} accessToken Admin JWT
 * @param {Record<string, unknown>} report
 * @param {{ to?: string }} [options]
 */
export async function sendAutomationSummaryEmail(accessToken, report, options = {}) {
  const url = getSendAutomationSummaryUrl();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url) {
    throw new Error('Missing VITE_SUPABASE_URL.');
  }
  if (!anon) {
    throw new Error('Missing VITE_SUPABASE_ANON_KEY.');
  }
  if (!accessToken) {
    throw new Error('Admin session required to send email summary.');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${accessToken}`,
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
