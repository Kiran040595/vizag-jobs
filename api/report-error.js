import { readJsonBody, sendJson, setCors } from './_lib/http.js';
import { createServiceClient } from './_lib/supabaseAuth.js';

// In-memory cache to rate-limit identical errors and prevent email inbox flooding
const RECENT_REPORT_TIMES = new Map();
const THROTTLE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function shouldThrottle(fingerprint) {
  const now = Date.now();
  const lastTime = RECENT_REPORT_TIMES.get(fingerprint);
  if (lastTime && now - lastTime < THROTTLE_WINDOW_MS) {
    return true;
  }
  // Clean old entries to keep memory bounded
  if (RECENT_REPORT_TIMES.size > 200) {
    for (const [key, time] of RECENT_REPORT_TIMES.entries()) {
      if (now - time > THROTTLE_WINDOW_MS) {
        RECENT_REPORT_TIMES.delete(key);
      }
    }
  }
  RECENT_REPORT_TIMES.set(fingerprint, now);
  return false;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const body = (typeof req.body === 'object' && req.body !== null) ? req.body : await readJsonBody(req);
    const {
      message = 'Unknown error',
      stack = '',
      componentStack = '',
      context = 'unhandled',
      url = '',
      pathname = '/',
      userAgent = 'Unknown',
      screen = 'Unknown',
      timestamp = new Date().toISOString(),
      test = false,
    } = body;

    // Log to Vercel Runtime Logs so it's instantly searchable in Vercel Dashboard
    console.error(`[Client Bug Alert] [${context}] ${pathname}: ${message}`, {
      url,
      screen,
      userAgent,
      stack: stack.slice(0, 500),
    });

    const fingerprint = `${pathname}::${message}::${String(stack).split('\n')[0] || ''}`;
    const isThrottled = test ? false : shouldThrottle(fingerprint);

    // Save to Supabase table if table exists
    try {
      const client = createServiceClient();
      if (client) {
        await client.from('site_error_logs').insert({
          error_message: String(message).slice(0, 500),
          stack_trace: String(stack).slice(0, 2000),
          component_stack: String(componentStack).slice(0, 2000),
          context: String(context).slice(0, 100),
          url: String(url).slice(0, 500),
          pathname: String(pathname).slice(0, 255),
          user_agent: String(userAgent).slice(0, 500),
          screen_size: String(screen).slice(0, 50),
          created_at: timestamp,
        });
      }
    } catch {
      // Ignore if site_error_logs table does not exist
    }

    // Send email alert via Resend
    let emailResult = { attempted: false };
    const resendApiKey = (process.env.RESEND_API_KEY || '').trim();

    if (!resendApiKey) {
      emailResult = {
        attempted: false,
        sent: false,
        reason: 'RESEND_API_KEY environment variable is missing on Vercel.',
      };
      console.warn('[Client Bug Alert] RESEND_API_KEY is not set in Vercel environment variables.');
    } else if (isThrottled) {
      emailResult = {
        attempted: false,
        sent: false,
        reason: 'Throttled: identical error alert sent within the last 5 minutes.',
      };
    } else {
      const rawRecipientConfig = (process.env.ALERT_EMAIL_RECIPIENT || 'kkumardadi@gmail.com, kiran@jobsinvizag.in').trim();
      const fromEmail = (process.env.RESEND_FROM_EMAIL || 'Vizag Jobs Alerts <onboarding@resend.dev>').trim();
      const isSandboxFrom = fromEmail.includes('@resend.dev');

      // Resend test sandbox (onboarding@resend.dev) only allows delivery to the account email (kkumardadi@gmail.com)
      const toRecipients = isSandboxFrom
        ? ['kkumardadi@gmail.com']
        : rawRecipientConfig.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);

      const subject = `🚨 [Bug Alert] ${String(message).slice(0, 50)} on ${pathname}`;

      emailResult = {
        attempted: true,
        recipients: toRecipients,
        from: fromEmail,
      };

      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="background: #ef4444; color: #ffffff; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 18px; font-weight: bold;">🚨 VizagJobs Production Error Alert</h2>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: bold; width: 130px;">Error Message:</td>
              <td style="padding: 8px 0; color: #dc2626; font-weight: bold;">${escapeHtml(message)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Page URL:</td>
              <td style="padding: 8px 0;"><a href="${escapeHtml(url)}" style="color: #0284c7; text-decoration: none;">${escapeHtml(url)}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Context / Source:</td>
              <td style="padding: 8px 0; color: #334155;">${escapeHtml(context)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: bold;">User Device:</td>
              <td style="padding: 8px 0; color: #334155;">${escapeHtml(userAgent)} (${escapeHtml(screen)})</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: bold;">Timestamp:</td>
              <td style="padding: 8px 0; color: #334155;">${escapeHtml(timestamp)}</td>
            </tr>
          </table>

          ${stack ? `
            <div style="margin-top: 16px;">
              <div style="font-weight: bold; color: #334155; font-size: 13px; margin-bottom: 6px;">Stack Trace:</div>
              <pre style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 12px; color: #0f172a; overflow-x: auto; white-space: pre-wrap; font-family: monospace;">${escapeHtml(stack)}</pre>
            </div>
          ` : ''}

          ${componentStack ? `
            <div style="margin-top: 16px;">
              <div style="font-weight: bold; color: #334155; font-size: 13px; margin-bottom: 6px;">Component Stack:</div>
              <pre style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 12px; color: #0f172a; overflow-x: auto; white-space: pre-wrap; font-family: monospace;">${escapeHtml(componentStack)}</pre>
            </div>
          ` : ''}

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
            Sent automatically by VizagJobs Error Reporter · <a href="https://jobsinvizag.in" style="color: #64748b;">jobsinvizag.in</a>
          </div>
        </div>
      `;

      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: toRecipients,
            subject,
            html: htmlBody,
          }),
        });

        const resendData = await resendRes.json().catch(() => ({}));
        if (!resendRes.ok) {
          const errMsg = resendData?.message || resendData?.error || `HTTP ${resendRes.status}`;
          console.error('[Client Bug Alert] Resend API error:', resendRes.status, errMsg);

          // If Resend failed because recipient was not allowed in free sandbox, retry sending to kkumardadi@gmail.com
          if (resendRes.status === 403 && (!toRecipients.includes('kkumardadi@gmail.com') || toRecipients.length > 1)) {
            console.warn('[Client Bug Alert] Retrying delivery directly to kkumardadi@gmail.com...');
            const retryRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Vizag Jobs Alerts <onboarding@resend.dev>',
                to: ['kkumardadi@gmail.com'],
                subject,
                html: htmlBody,
              }),
            });
            const retryData = await retryRes.json().catch(() => ({}));
            if (retryRes.ok) {
              emailResult.sent = true;
              emailResult.id = retryData?.id;
              emailResult.deliveredTo = ['kkumardadi@gmail.com'];
            } else {
              emailResult.sent = false;
              emailResult.error = retryData?.message || errMsg;
              emailResult.status = retryRes.status;
            }
          } else {
            emailResult.sent = false;
            emailResult.error = errMsg;
            emailResult.status = resendRes.status;
          }
        } else {
          console.log('[Client Bug Alert] Email sent successfully via Resend:', resendData?.id);
          emailResult.sent = true;
          emailResult.id = resendData?.id;
        }
      } catch (emailErr) {
        console.error('[Client Bug Alert] Failed to fetch Resend API:', emailErr);
        emailResult.sent = false;
        emailResult.error = emailErr.message;
      }
    }

    return sendJson(res, 200, {
      ok: true,
      throttled: isThrottled,
      email: emailResult,
    });
  } catch (err) {
    console.error('[Client Bug Alert] Handler failure:', err);
    return sendJson(res, 500, { error: 'Failed to process error report.' });
  }
}
