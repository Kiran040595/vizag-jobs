const STORAGE_KEY = 'vizagjobs:apply-visitor-id';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value) => UUID_RE.test(String(value || '').trim());

export const getOrCreateApplyVisitorId = () => {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (isUuid(existing)) {
      return existing.toLowerCase();
    }
    const next = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
};

/** Stable per-person key. Logged-in users always map to user:<uuid>. */
export const buildApplyClickVisitorKey = (userId) => {
  const uid = String(userId || '').trim().toLowerCase();
  if (isUuid(uid)) {
    return `user:${uid}`;
  }
  return `anon:${getOrCreateApplyVisitorId()}`;
};
