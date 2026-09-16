import { timingSafeEqual } from 'node:crypto';

const header = (req, name) => {
  const lower = name.toLowerCase();
  const headers = req.headers || {};
  const match = Object.keys(headers).find((key) => key.toLowerCase() === lower);
  return match ? String(headers[match] || '') : '';
};

const equal = (left, right) => {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length || a.length === 0) {
    return false;
  }
  return timingSafeEqual(a, b);
};

export const getBearerToken = (req) => {
  const match = /^Bearer\s+(.+)$/i.exec(header(req, 'authorization'));
  return match?.[1]?.trim() || '';
};

export const isVercelPlatformCron = (req) => {
  const userAgent = header(req, 'user-agent');
  const schedule = header(req, 'x-vercel-cron-schedule').trim();
  return userAgent.includes('vercel-cron') && Boolean(schedule);
};

export const isAuthorizedCronRequest = (req, env = process.env) => {
  if (isVercelPlatformCron(req)) {
    return true;
  }

  const token = getBearerToken(req);
  const secrets = [
    env.CRON_SECRET,
    env.FETCH_JOBS_CRON_SECRET,
    env.SUPABASE_SERVICE_ROLE_KEY,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  if (!token || secrets.length === 0) {
    return false;
  }

  return secrets.some((secret) => equal(token, secret));
};
