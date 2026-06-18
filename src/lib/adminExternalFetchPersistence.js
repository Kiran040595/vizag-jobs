/**
 * Persists the admin "Fetch external jobs" page state to localStorage so an
 * admin can review a fetched batch across tab switches, refreshes, and
 * even browser restarts — without losing skipped keys, SEO rewrites, or
 * per-job errors.
 *
 * Single-snapshot model (matches the page's existing behavior — each new
 * fetch overwrites the previous batch). Version-tagged so we can evolve
 * the shape later without breaking restore.
 *
 * TTL exists because admins sometimes leave a fetched batch un-published
 * for a day or two; after 24 h the listings are stale (Naukri/LinkedIn
 * URLs decay, jobs may already be filled), so we drop them automatically
 * on next visit instead of letting them masquerade as "fresh".
 */

const STORAGE_KEY = 'vizagjobs:admin-external-fetch:v1';
const SCHEMA_VERSION = 1;

/** Snapshots older than this on load are discarded. */
export const ADMIN_FETCH_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const safeStorage = () => {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    // Private browsing / disabled localStorage. Persistence becomes a no-op.
    return null;
  }
};

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * @typedef {object} AdminFetchSnapshot
 * @property {number} fetchedAt
 * @property {string | null} activeSource
 * @property {object | null} fetchPayload
 * @property {Array<object>} reviewJobs
 * @property {Array<string>} skippedKeys
 * @property {Record<string, string>} importErrors
 * @property {Record<string, string>} seoErrors
 * @property {string} linkedInPostPreset
 * @property {string} linkedInCustomSearchUrl
 * @property {{ runId: string, readyAt: number, startedAt: number } | null} [naukriPending]
 */

/** @returns {AdminFetchSnapshot | null} */
export function loadAdminFetchSnapshot() {
  const storage = safeStorage();
  if (!storage) return null;

  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt entry — drop it.
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }

  if (!isPlainObject(parsed) || parsed.version !== SCHEMA_VERSION) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }

  const fetchedAt = Number(parsed.fetchedAt);
  if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > ADMIN_FETCH_SNAPSHOT_TTL_MS) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }

  return {
    fetchedAt,
    activeSource: typeof parsed.activeSource === 'string' ? parsed.activeSource : null,
    fetchPayload: isPlainObject(parsed.fetchPayload) ? parsed.fetchPayload : null,
    reviewJobs: Array.isArray(parsed.reviewJobs) ? parsed.reviewJobs : [],
    skippedKeys: Array.isArray(parsed.skippedKeys)
      ? parsed.skippedKeys.filter((k) => typeof k === 'string')
      : [],
    importErrors: isPlainObject(parsed.importErrors) ? parsed.importErrors : {},
    seoErrors: isPlainObject(parsed.seoErrors) ? parsed.seoErrors : {},
    linkedInPostPreset:
      typeof parsed.linkedInPostPreset === 'string' ? parsed.linkedInPostPreset : 'general',
    linkedInCustomSearchUrl:
      typeof parsed.linkedInCustomSearchUrl === 'string' ? parsed.linkedInCustomSearchUrl : '',
    naukriPending:
      isPlainObject(parsed.naukriPending) &&
      typeof parsed.naukriPending.runId === 'string' &&
      Number.isFinite(Number(parsed.naukriPending.readyAt))
        ? {
            runId: parsed.naukriPending.runId,
            readyAt: Number(parsed.naukriPending.readyAt),
            startedAt: Number(parsed.naukriPending.startedAt) || Number(parsed.naukriPending.readyAt),
          }
        : null,
  };
}

/**
 * Save (or replace) the current admin fetch snapshot. Silently no-ops on
 * storage failures (quota exceeded, disabled storage, JSON.stringify cycle).
 *
 * @param {AdminFetchSnapshot} snapshot
 */
export function saveAdminFetchSnapshot(snapshot) {
  const storage = safeStorage();
  if (!storage) return;

  let serialized;
  try {
    serialized = JSON.stringify({ version: SCHEMA_VERSION, ...snapshot });
  } catch {
    return;
  }

  try {
    storage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Quota exceeded or storage denied — leave whatever was there alone.
  }
}

export function clearAdminFetchSnapshot() {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
