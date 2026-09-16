import { timingSafeEqual } from 'node:crypto';

const equal = (left, right) => {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length || a.length === 0) {
    return false;
  }
  return timingSafeEqual(a, b);
};

export const getBearerToken = (req) => {
  const header = String(req.headers?.authorization || req.headers?.Authorization || '');
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || '';
};

export const isAuthorizedCronRequest = (req, env = process.env) => {
  const token = getBearerToken(req);
  const secrets = [
    env.CRON_SECRET,
    env.FETCH_JOBS_CRON_SECRET,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  if (!token || secrets.length === 0) {
    return false;
  }

  return secrets.some((secret) => equal(token, secret));
};
