/**
 * Experience-tier ranking for Naukri Vizag job collection.
 * Lower tier = fresher / entry-level (higher priority when collecting).
 * Keep in sync with src/lib/naukriExperienceSort.js
 */

export type NaukriExperienceTier = 0 | 1 | 2 | 3 | 4;

export type NaukriExperienceJobLike = {
  experience?: string | null;
  title?: string | null;
  posted_at?: string | null;
};

/** 0=fresher, 1=entry (1-2y), 2=mid (3-5y), 3=senior (6+y), 4=unknown */
export function naukriExperienceTier(
  experience: string | null | undefined,
  title?: string | null,
): NaukriExperienceTier {
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

function postedAtMs(posted_at: string | null | undefined): number {
  if (!posted_at?.trim()) return 0;
  const ms = Date.parse(posted_at);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Sort fresher-first; within the same tier, newer postings first. */
export function compareNaukriJobsByExperience<T extends NaukriExperienceJobLike>(
  a: T,
  b: T,
): number {
  const tierDiff =
    naukriExperienceTier(a.experience, a.title) - naukriExperienceTier(b.experience, b.title);
  if (tierDiff !== 0) {
    return tierDiff;
  }
  return postedAtMs(b.posted_at) - postedAtMs(a.posted_at);
}

export type PrioritizeNaukriJobsOptions = {
  /** Cap returned jobs (e.g. APIFY_NAUKRI_MAX_JOBS). Omit to return all, sorted. */
  maxJobs?: number;
  /** Target share of fresher + entry roles when capping (default 0.75). */
  fresherRatio?: number;
};

/**
 * Order jobs fresher-first and, when maxJobs is set, reserve most slots for
 * fresher/entry roles before filling remaining slots with experienced listings.
 */
export function prioritizeNaukriJobsByExperience<T extends NaukriExperienceJobLike>(
  jobs: T[],
  options: PrioritizeNaukriJobsOptions = {},
): T[] {
  const sorted = [...jobs].sort(compareNaukriJobsByExperience);
  const maxJobs = options.maxJobs;
  if (!maxJobs || maxJobs >= sorted.length) {
    return sorted;
  }

  const ratio = Math.min(1, Math.max(0.1, options.fresherRatio ?? 0.75));
  const fresherSlots = Math.ceil(maxJobs * ratio);
  const fresherPool = sorted.filter((j) => naukriExperienceTier(j.experience, j.title) <= 1);
  const experiencedPool = sorted.filter((j) => naukriExperienceTier(j.experience, j.title) > 1);

  const picked: T[] = [];
  const seen = new Set<T>();

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

export function naukriExperienceSortEnabled(): boolean {
  return (Deno.env.get('APIFY_NAUKRI_EXPERIENCE_SORT') ?? 'true').toLowerCase() !== 'false';
}

export function naukriFresherCollectionRatio(): number {
  const raw = Deno.env.get('APIFY_NAUKRI_FRESHER_RATIO')?.trim();
  if (!raw) return 0.75;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0.75;
  return Math.min(1, Math.max(0.1, n));
}

/** Larger Apify scrape pool so post-collection fresher prioritization has choices. */
export function naukriApifyScrapePoolSize(outputLimit: number): number {
  if (!naukriExperienceSortEnabled()) {
    return outputLimit;
  }
  return Math.min(100, Math.max(outputLimit * 3, 24));
}
