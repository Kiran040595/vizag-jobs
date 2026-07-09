/**
 * Unit tests for src/lib/adminExternalFetchPersistence.js
 *
 * Run with:  node tests/admin-external-fetch-persistence.test.mjs
 *
 * The module reads/writes via `window.localStorage`. We polyfill a minimal
 * in-memory localStorage on the global, plus a `window` shim, before the
 * import so the helpers see them on first evaluation.
 */

class MemoryStorage {
  constructor() {
    this.map = new Map();
    this.failOnSet = false;
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    if (this.failOnSet) {
      throw new Error('QuotaExceededError');
    }
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
  get length() {
    return this.map.size;
  }
}

const storage = new MemoryStorage();
globalThis.window = { localStorage: storage };

const STORAGE_KEY = 'vizagjobs:admin-external-fetch:v1';
const SCHEMA_VERSION = 1;

const {
  ADMIN_FETCH_SNAPSHOT_TTL_MS,
  loadAdminFetchSnapshot,
  saveAdminFetchSnapshot,
  clearAdminFetchSnapshot,
} = await import('../src/lib/adminExternalFetchPersistence.js');

let pass = 0;
let fail = 0;
const trail = [];

const ok = (cond, label) => {
  if (cond) {
    pass += 1;
    trail.push(`  OK    ${label}`);
  } else {
    fail += 1;
    trail.push(`  FAIL  ${label}`);
  }
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label}  (got ${JSON.stringify(a)})`);
const section = (name) => trail.push(`\n${name}\n${'-'.repeat(name.length)}`);

const sampleSnapshot = () => ({
  fetchedAt: Date.now(),
  activeSource: 'naukri',
  fetchPayload: { ok: true, jobs: [] },
  reviewJobs: [{ id: 'a', title: 'Engineer', slug: 'engineer-a' }],
  skippedKeys: ['skipped-1'],
  importErrors: { 'k1': 'duplicate' },
  seoErrors: {},
  linkedInPostPreset: 'general',
  linkedInCustomSearchUrl: '',
});

// ------------------------------------------------------------
section('Round-trip: save → load returns the same shape');
{
  storage.clear();
  const snap = sampleSnapshot();
  saveAdminFetchSnapshot(snap);
  const restored = loadAdminFetchSnapshot();
  ok(restored !== null, 'load returns a snapshot after save');
  eq(restored?.activeSource, 'naukri', 'activeSource preserved');
  eq(restored?.reviewJobs?.length, 1, 'reviewJobs preserved');
  eq(restored?.skippedKeys, ['skipped-1'], 'skippedKeys preserved');
  eq(restored?.importErrors, { k1: 'duplicate' }, 'importErrors preserved');
  eq(restored?.linkedInPostPreset, 'general', 'linkedInPostPreset preserved');
}

// ------------------------------------------------------------
section('TTL: snapshot older than 24h is dropped on load');
{
  storage.clear();
  const oldSnap = { ...sampleSnapshot(), fetchedAt: Date.now() - (ADMIN_FETCH_SNAPSHOT_TTL_MS + 60_000) };
  saveAdminFetchSnapshot(oldSnap);
  const restored = loadAdminFetchSnapshot();
  ok(restored === null, 'expired snapshot returns null');
  ok(storage.getItem(STORAGE_KEY) === null, 'expired snapshot is wiped from storage');
}

// ------------------------------------------------------------
section('Version mismatch: returns null and wipes');
{
  storage.clear();
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...sampleSnapshot(), version: SCHEMA_VERSION + 999 }),
  );
  const restored = loadAdminFetchSnapshot();
  ok(restored === null, 'wrong-version snapshot returns null');
  ok(storage.getItem(STORAGE_KEY) === null, 'wrong-version snapshot is wiped');
}

// ------------------------------------------------------------
section('Corrupt JSON: returns null and wipes');
{
  storage.clear();
  storage.setItem(STORAGE_KEY, '{not valid json');
  const restored = loadAdminFetchSnapshot();
  ok(restored === null, 'corrupt JSON returns null');
  ok(storage.getItem(STORAGE_KEY) === null, 'corrupt entry is wiped');
}

// ------------------------------------------------------------
section('Invalid shape: defensive defaults applied');
{
  storage.clear();
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: SCHEMA_VERSION,
      fetchedAt: Date.now(),
      // Intentionally pass garbage types for fields the loader should defend.
      reviewJobs: 'should-be-array',
      skippedKeys: { not: 'array' },
      importErrors: 'should-be-object',
      linkedInPostPreset: 42,
    }),
  );
  const restored = loadAdminFetchSnapshot();
  ok(restored !== null, 'invalid-shape snapshot still loads (with defaults)');
  eq(restored?.reviewJobs, [], 'reviewJobs falls back to []');
  eq(restored?.skippedKeys, [], 'skippedKeys falls back to []');
  eq(restored?.importErrors, {}, 'importErrors falls back to {}');
  eq(restored?.linkedInPostPreset, 'general', 'linkedInPostPreset falls back to "general"');
}

// ------------------------------------------------------------
section('clear: removes the snapshot');
{
  storage.clear();
  saveAdminFetchSnapshot(sampleSnapshot());
  ok(storage.getItem(STORAGE_KEY) !== null, 'precondition: snapshot saved');
  clearAdminFetchSnapshot();
  ok(storage.getItem(STORAGE_KEY) === null, 'clearAdminFetchSnapshot removes the entry');
  ok(loadAdminFetchSnapshot() === null, 'load returns null after clear');
}

// ------------------------------------------------------------
section('save: silently no-ops on storage failure (e.g. quota)');
{
  storage.clear();
  storage.failOnSet = true;
  let threw = false;
  try {
    saveAdminFetchSnapshot(sampleSnapshot());
  } catch {
    threw = true;
  }
  ok(!threw, 'save does not throw when storage rejects setItem');
  storage.failOnSet = false;
}

// ------------------------------------------------------------
section('Empty storage: load returns null without writing');
{
  storage.clear();
  ok(loadAdminFetchSnapshot() === null, 'fresh storage → null');
  ok(storage.length === 0, 'load did not write anything');
}

// ------------------------------------------------------------
console.log(trail.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
