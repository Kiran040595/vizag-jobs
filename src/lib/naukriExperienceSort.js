/**
 * Experience-tier ranking for Naukri Vizag job collection.
 * Keep in sync with supabase/functions/_shared/naukriExperienceSort.ts
 */

/** @typedef {0 | 1 | 2 | 3 | 4} NaukriExperienceTier */

/**
 * @param {string | null | undefined} experience
 * @param {string | null | undefined} [title]
 * @returns {NaukriExperienceTier}
 */
export function naukriExperienceTier(experience, title) {
  const exp = String(experience ?? '').trim().toLowerCase();
  const t = String(title ?? '').trim().toLowerCase();

  if (
    /\bfresher\b/.test(exp) ||
    /^0\s*[-–]/.test(exp) ||
    /^0\s+to\s+/i.test(exp) ||
    /\b0\s*(?:yr|yrs|year|years)\b/.test(exp) ||
    /\bentry[\s-]?level\b/.test(exp) ||
    /\btrainee\b/.test(exp) ||
    /\bintern(?:ship)?\b/.test(exp) ||
    /\bfresher\b|\btrainee\b|\bintern\b/.test(t)
  ) {
    return 0;
  }

  const range = exp.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*(?:yr|yrs|year|years)?/);
  if (range) {
    const min = Number(range[1]);
    if (min === 0) return 0;
    if (min <= 2) return 1;
    if (min <= 5) return 2;
    return 3;
  }

  const single = exp.match(/(\d+)\s*\+?\s*(?:yr|yrs|year|years)/);
  if (single) {
    const n = Number(single[1]);
    if (n === 0) return 0;
    if (n <= 2) return 1;
    if (n <= 5) return 2;
    return 3;
  }

  if (!exp || exp === 'not specified') {
    return 4;
  }

  return 4;
}

function postedAtMs(posted_at) {
  if (!posted_at?.trim()) return 0;
  const ms = Date.parse(posted_at);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * @template {import('./naukriExperienceSort.js').NaukriExperienceJobLike} T
 * @param {T} a
 * @param {T} b
 */
export function compareNaukriJobsByExperience(a, b) {
  const tierDiff =
    naukriExperienceTier(a.experience, a.title) - naukriExperienceTier(b.experience, b.title);
  if (tierDiff !== 0) {
    return tierDiff;
  }
  return postedAtMs(b.posted_at) - postedAtMs(a.posted_at);
}

/**
 * @template {import('./naukriExperienceSort.js').NaukriExperienceJobLike} T
 * @param {T[]} jobs
 * @param {{ maxJobs?: number, fresherRatio?: number }} [options]
 * @returns {T[]}
 */
export function prioritizeNaukriJobsByExperience(jobs, options = {}) {
  const sorted = [...jobs].sort(compareNaukriJobsByExperience);
  const maxJobs = options.maxJobs;
  if (!maxJobs || maxJobs >= sorted.length) {
    return sorted;
  }

  const ratio = Math.min(1, Math.max(0.1, options.fresherRatio ?? 0.75));
  const fresherSlots = Math.ceil(maxJobs * ratio);
  const fresherPool = sorted.filter((j) => naukriExperienceTier(j.experience, j.title) <= 1);
  const experiencedPool = sorted.filter((j) => naukriExperienceTier(j.experience, j.title) > 1);

  const picked = [];
  const seen = new Set();

  for (const job of fresherPool) {
    if (picked.length >= fresherSlots) break;
    picked.push(job);
    seen.add(job);
  }

  for (const job of experiencedPool) {
    if (picked.length >= maxJobs) break;
    picked.push(job);
    seen.add(job);
  }

  if (picked.length < maxJobs) {
    for (const job of sorted) {
      if (picked.length >= maxJobs) break;
      if (!seen.has(job)) {
        picked.push(job);
        seen.add(job);
      }
    }
  }

  return picked.slice(0, maxJobs);
}
