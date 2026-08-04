/** Best-effort in-memory rate limit for serverless (per isolate). */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 30;

/** @type {Map<string, number[]>} */
const hitsByKey = new Map();

const prune = (timestamps, now) => timestamps.filter((ts) => now - ts < WINDOW_MS);

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(',')[0].trim();
  }
  return (
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}

/**
 * @param {string} key
 * @returns {{ ok: true } | { ok: false, retryAfterSec: number }}
 */
export function checkRateLimit(key) {
  const now = Date.now();
  const previous = prune(hitsByKey.get(key) || [], now);

  if (previous.length >= MAX_REQUESTS) {
    const oldest = previous[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
    hitsByKey.set(key, previous);
    return { ok: false, retryAfterSec };
  }

  previous.push(now);
  hitsByKey.set(key, previous);

  // Cap map size to avoid unbounded growth in long-lived isolates.
  if (hitsByKey.size > 5_000) {
    const firstKey = hitsByKey.keys().next().value;
    if (firstKey) hitsByKey.delete(firstKey);
  }

  return { ok: true };
}
