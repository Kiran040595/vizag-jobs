/**
 * Pure helpers for the public home-page job listing: URL <-> filter state,
 * filter application, and pagination.
 *
 * Conventions:
 * - The URL is the source of truth for filters and page number; `q`,
 *   `category`, `jobType`, `freshness`, `page` are the only recognized params.
 * - "All" / default values are NEVER serialized to the URL — a clean URL
 *   means a clean filter state, and back/forward navigation stays predictable.
 * - All filtering is client-side over the in-memory cache so refresh,
 *   back/forward and shared links all work without re-fetching.
 */

import { isItRelatedJob } from './jobItMatch.js';
import { isPublicFresherListingJob } from './fresherMatch.js';

export const PAGE_SIZE = 12;

export const CATEGORY_OPTIONS = [
  { id: 'all', label: 'All Categories' },
  { id: 'it', label: 'IT & Software' },
  { id: 'non-it', label: 'Non-IT Jobs' },
  { id: 'fresher', label: 'Fresher Jobs' },
  { id: 'walk-in', label: 'Walk-in Interviews' },
];

export const JOB_TYPE_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'full-time', label: 'Full-Time' },
  { id: 'part-time', label: 'Part-Time' },
  { id: 'internship', label: 'Internship' },
  { id: 'contract', label: 'Contract' },
];

export const FRESHNESS_OPTIONS = [
  { id: 'all', label: 'Anytime' },
  { id: '24h', label: 'Last 24 hours', hours: 24 },
  { id: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { id: '30d', label: 'Last 30 days', hours: 24 * 30 },
];

export const DEFAULT_FILTERS = Object.freeze({
  q: '',
  category: 'all',
  jobType: 'all',
  freshness: 'all',
  page: 1,
});

const isOptionId = (id, options) => options.some((opt) => opt.id === id);

export const readFiltersFromSearchParams = (searchParams) => {
  const rawCategory = (searchParams.get('category') ?? 'all').toLowerCase();
  const rawJobType = (searchParams.get('jobType') ?? 'all').toLowerCase();
  const rawFreshness = (searchParams.get('freshness') ?? 'all').toLowerCase();
  const pageNum = Number(searchParams.get('page'));

  return {
    q: searchParams.get('q') ?? '',
    category: isOptionId(rawCategory, CATEGORY_OPTIONS) ? rawCategory : 'all',
    jobType: isOptionId(rawJobType, JOB_TYPE_OPTIONS) ? rawJobType : 'all',
    freshness: isOptionId(rawFreshness, FRESHNESS_OPTIONS) ? rawFreshness : 'all',
    page: Number.isFinite(pageNum) && pageNum > 0 ? Math.floor(pageNum) : 1,
  };
};

/** Build a URLSearchParams that omits defaults, so the canonical URL is the shortest. */
export const writeFiltersToSearchParams = (filters) => {
  const out = new URLSearchParams();
  const trimmed = (filters.q ?? '').trim();
  if (trimmed) out.set('q', trimmed);
  if (filters.category && filters.category !== 'all') out.set('category', filters.category);
  if (filters.jobType && filters.jobType !== 'all') out.set('jobType', filters.jobType);
  if (filters.freshness && filters.freshness !== 'all') out.set('freshness', filters.freshness);
  if (filters.page && filters.page > 1) out.set('page', String(filters.page));
  return out;
};

export const isAnyFilterActive = (filters) =>
  Boolean((filters.q ?? '').trim()) ||
  filters.category !== 'all' ||
  filters.jobType !== 'all' ||
  filters.freshness !== 'all';

const matchesSearchText = (job, q) => {
  if (!q) return true;
  // Listing payload is slim: full `description` is only loaded on the detail
  // page, so search here covers the metadata fields we *do* keep on the card.
  // `shortDescription` is the canonical searchable summary.
  const blob = [
    job.title,
    job.company,
    job.skills,
    job.shortDescription,
    job.category,
    job.location,
    job.experience,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return blob.includes(q);
};

const normalizeJobType = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .trim();

const matchesJobType = (job, wanted) => {
  if (wanted === 'all') return true;
  const v = normalizeJobType(job.jobType);
  if (!v) return false;
  if (v === wanted) return true;
  // Tolerate small variants ("internships" / "fulltime" etc.)
  if (wanted === 'internship' && v.startsWith('intern')) return true;
  if (wanted === 'full-time' && (v === 'fulltime' || v === 'full time')) return true;
  if (wanted === 'part-time' && (v === 'parttime' || v === 'part time')) return true;
  return false;
};

const matchesCategory = (job, category) => {
  if (category === 'all') return true;
  if (category === 'it') return isItRelatedJob(job);
  if (category === 'non-it') return !isItRelatedJob(job);
  if (category === 'fresher') {
    return isPublicFresherListingJob(job);
  }
  if (category === 'walk-in') {
    const t = `${job.title ?? ''} ${job.description ?? ''} ${job.shortDescription ?? ''}`.toLowerCase();
    return t.includes('walk-in') || t.includes('walk in') || t.includes('walkin');
  }
  return true;
};

const matchesFreshness = (job, freshnessId) => {
  if (freshnessId === 'all') return true;
  const opt = FRESHNESS_OPTIONS.find((o) => o.id === freshnessId);
  if (!opt?.hours) return true;
  const ts = Date.parse(job.postedAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= opt.hours * 3_600_000;
};

export const applyJobFilters = (jobs, filters) => {
  if (!Array.isArray(jobs) || jobs.length === 0) return [];
  const q = (filters.q ?? '').trim().toLowerCase();
  return jobs.filter(
    (job) =>
      matchesCategory(job, filters.category) &&
      matchesJobType(job, filters.jobType) &&
      matchesFreshness(job, filters.freshness) &&
      matchesSearchText(job, q),
  );
};

/**
 * Slice a list into a single page. Always returns at least one page even when
 * the list is empty, so the UI doesn't have to special-case `totalPages === 0`.
 */
export const paginate = (list, page, pageSize = PAGE_SIZE) => {
  const safeList = Array.isArray(list) ? list : [];
  const total = safeList.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = safeList.slice(start, start + pageSize);
  return { page: safePage, pageSize, total, totalPages, items };
};

/**
 * Build the array of "page tokens" to render in the pagination UI.
 *
 * Output is a mix of page numbers and the literal string `'…'` (ellipsis), e.g.
 * `[1, '…', 4, 5, 6, '…', 12]`. Always shows the first/last page and a small
 * window around the current page.
 */
export const buildPaginationItems = (currentPage, totalPages, windowSize = 1) => {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const out = [];
  const lo = Math.max(2, currentPage - windowSize);
  const hi = Math.min(totalPages - 1, currentPage + windowSize);

  out.push(1);
  if (lo > 2) out.push('…');
  for (let p = lo; p <= hi; p += 1) out.push(p);
  if (hi < totalPages - 1) out.push('…');
  out.push(totalPages);

  return out;
};
