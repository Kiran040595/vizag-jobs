/**
 * Cross-tab handoff for "Edit fetched job → /admin/new" prefill.
 *
 * Rationale: when the admin clicks **Edit** on a fetched-jobs card, we want to
 * open the create-job page in a new tab so the original review list stays
 * intact. React Router's `location.state` doesn't survive `window.open`, and
 * the prefill payload (description, responsibilities, eligibility…) is too
 * large for query-string transport. We stash it in `localStorage` under a
 * random key, put just the key in the URL, and consume-once on the new tab.
 *
 * Stored values are already form-ready (i.e. `deserializeJobForForm` has been
 * applied) so the consumer must NOT deserialize again.
 */

const PREFIX = 'vizagjobs:admin-new-job-prefill:';
const TTL_MS = 60 * 60 * 1000; // 1 hour — anything older is abandoned.

const safeLocalStorage = () => {
  try {
    if (typeof window === 'undefined') return null;
    const ls = window.localStorage;
    // Probe — Safari private mode throws on setItem.
    const probe = '__vizagjobs_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
};

const purgeExpired = (ls) => {
  try {
    const now = Date.now();
    const stale = [];
    for (let i = 0; i < ls.length; i += 1) {
      const key = ls.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      try {
        const entry = JSON.parse(ls.getItem(key) || 'null');
        if (!entry || typeof entry.createdAt !== 'number' || now - entry.createdAt > TTL_MS) {
          stale.push(key);
        }
      } catch {
        stale.push(key);
      }
    }
    for (const key of stale) {
      ls.removeItem(key);
    }
  } catch {
    /* ignore */
  }
};

const generateId = () => {
  try {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

/**
 * Persist a form-ready prefill object and return the lookup id.
 *
 * @param {Record<string, unknown>} prefill - already-deserialized form values
 * @returns {string|null} id to embed in the URL, or null if storage unavailable
 */
export function stashAdminJobPrefill(prefill) {
  const ls = safeLocalStorage();
  if (!ls || !prefill || typeof prefill !== 'object') return null;

  purgeExpired(ls);

  const id = generateId();
  const key = `${PREFIX}${id}`;
  try {
    ls.setItem(key, JSON.stringify({ createdAt: Date.now(), prefill }));
    return id;
  } catch {
    return null;
  }
}

/**
 * One-shot read: returns the stored prefill and immediately deletes it so a
 * page refresh doesn't replay an old edit. Returns `null` for unknown/expired
 * ids or when localStorage is unavailable.
 *
 * @param {string|null|undefined} id
 * @returns {Record<string, unknown>|null}
 */
export function consumeAdminJobPrefill(id) {
  const ls = safeLocalStorage();
  if (!ls || !id) return null;

  const key = `${PREFIX}${id}`;
  let raw = null;
  try {
    raw = ls.getItem(key);
    ls.removeItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const entry = JSON.parse(raw);
    if (!entry?.prefill || typeof entry.prefill !== 'object') return null;
    if (typeof entry.createdAt === 'number' && Date.now() - entry.createdAt > TTL_MS) {
      return null;
    }
    return entry.prefill;
  } catch {
    return null;
  }
}
