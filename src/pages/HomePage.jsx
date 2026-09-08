import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import JobList from '../components/JobList';
import JobFilters from '../components/JobFilters';
import Pagination from '../components/Pagination';
import StatsSection from '../components/StatsSection';
import CTASection from '../components/CTASection';
import JobCategoryBrowse from '../components/JobCategoryBrowse';
import BlogTeaserSection from '../components/BlogTeaserSection';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import JobsForYou from '../components/JobsForYou';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { JOB_LIST_SESSION_CACHE_TTL_MS, fetchJobs } from '../services/jobs';
import { readHomeBootstrapJobs } from '../lib/homePageBootstrap';
import {
  readCachedPublicJobs,
  writeCachedPublicJobs,
} from '../lib/publicJobsSessionCache';
import { computeSiteStats } from '../lib/siteStats';
import {
  CATEGORY_OPTIONS,
  DEFAULT_FILTERS,
  PAGE_SIZE,
  applyJobFilters,
  paginate,
  readFiltersFromSearchParams,
  writeFiltersToSearchParams,
} from '../lib/jobFilters';

const SEARCH_DEBOUNCE_MS = 300;
const CACHE_TTL_MS = JOB_LIST_SESSION_CACHE_TTL_MS;
// Trigger a background refresh once we're within the last minute of the TTL.
const CACHE_STALE_AT_MS = Math.max(CACHE_TTL_MS - 60_000, Math.floor(CACHE_TTL_MS * 0.8));

/** Hero's existing select uses these labels; map between them and the URL ids. */
const CATEGORY_LABEL_TO_ID = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.label, o.id]));
const CATEGORY_ID_TO_LABEL = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.id, o.label]));

const initialJobsState = (() => {
  try {
    const bootstrap = readHomeBootstrapJobs();
    if (bootstrap?.length) {
      return { jobs: bootstrap, fromCache: false, cacheAge: 0 };
    }
  } catch {
    // ignore bootstrap parse errors
  }

  const cached = readCachedPublicJobs();
  if (cached?.jobs?.length) {
    return { jobs: cached.jobs, fromCache: true, cacheAge: cached.age };
  }

  return { jobs: [], fromCache: false, cacheAge: 0 };
})();

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useAdminAuth();
  const filters = useMemo(() => {
    const parsed = readFiltersFromSearchParams(searchParams);
    if (!isAdmin && parsed.source !== 'all') {
      return { ...parsed, source: 'all' };
    }
    return parsed;
  }, [searchParams, isAdmin]);

  const [allJobs, setAllJobs] = useState(() => initialJobsState.jobs);
  const [isLoading, setIsLoading] = useState(() => initialJobsState.jobs.length === 0);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Local input state so typing feels snappy. The URL is the source of truth
  // for the *applied* search; we sync to it on a 300ms debounce.
  const [searchInput, setSearchInput] = useState(filters.q);
  const lastUrlQRef = useRef(filters.q);
  const listSectionRef = useRef(null);
  const userInteractedRef = useRef(false);

  // Sync local input ← URL when the URL changes from outside (back/forward,
  // chip removal, clear-all). Don't clobber active typing.
  useEffect(() => {
    if (filters.q !== lastUrlQRef.current) {
      setSearchInput(filters.q);
      lastUrlQRef.current = filters.q;
    }
  }, [filters.q]);

  // Debounce-write input → URL `q` param.
  useEffect(() => {
    if (searchInput === filters.q) return;
    const handle = window.setTimeout(() => {
      lastUrlQRef.current = searchInput;
      const next = writeFiltersToSearchParams({ ...filters, q: searchInput, page: 1 });
      setSearchParams(next, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  useEffect(() => {
    if (isAdmin) {
      return;
    }
    const parsed = readFiltersFromSearchParams(searchParams);
    if (parsed.source === 'all') {
      return;
    }
    setSearchParams(writeFiltersToSearchParams({ ...parsed, source: 'all' }), { replace: true });
  }, [isAdmin, searchParams, setSearchParams]);

  const refreshJobsInBackground = useCallback(async () => {
    setIsBackgroundRefreshing(true);
    try {
      const jobs = await fetchJobs({}, true);
      if (jobs.length > 0) {
        setAllJobs(jobs);
        writeCachedPublicJobs(jobs);
      }
    } catch (error) {
      console.warn('Background refresh failed:', error);
    } finally {
      setIsBackgroundRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchFreshJobs = async () => {
      try {
        const jobs = await fetchJobs();
        if (!isMounted) return;
        if (jobs.length > 0) {
          setAllJobs(jobs);
          writeCachedPublicJobs(jobs);
          setLoadError('');
          return;
        }
        setLoadError('No jobs found. Please check back later.');
      } catch (error) {
        if (!isMounted) return;
        console.error('Error fetching jobs:', error);
        setLoadError(
          error instanceof Error ? error.message : 'Failed to load jobs. Please try refreshing the page.',
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const loadJobs = async () => {
      const cached = readCachedPublicJobs();
      if (cached?.jobs?.length) {
        setAllJobs(cached.jobs);
        setIsLoading(false);
        if (cached.age > CACHE_STALE_AT_MS) {
          void refreshJobsInBackground();
        }
        return;
      }

      // Edge middleware left a first-paint snapshot — show it, then load the full list.
      if (initialJobsState.jobs.length > 0 && !initialJobsState.fromCache) {
        setAllJobs(initialJobsState.jobs);
        setIsLoading(false);
        setIsBackgroundRefreshing(true);
        try {
          const jobs = await fetchJobs({}, true);
          if (!isMounted) return;
          if (jobs.length > 0) {
            setAllJobs(jobs);
            writeCachedPublicJobs(jobs);
            setLoadError('');
          }
        } catch (error) {
          if (!isMounted) return;
          console.warn('Full job refresh after SSR bootstrap failed:', error);
        } finally {
          if (isMounted) setIsBackgroundRefreshing(false);
        }
        return;
      }

      await fetchFreshJobs();
    };

    loadJobs();
    return () => {
      isMounted = false;
    };
  }, [refreshJobsInBackground]);

  // ---------- Filter / pagination derivations ----------
  const filteredJobs = useMemo(() => applyJobFilters(allJobs, filters), [allJobs, filters]);
  const siteStats = useMemo(() => computeSiteStats(allJobs), [allJobs]);
  const pagination = useMemo(
    () => paginate(filteredJobs, filters.page, PAGE_SIZE),
    [filteredJobs, filters.page],
  );

  // If the URL says page=5 but there are only 2 pages of results, snap back.
  useEffect(() => {
    if (pagination.page !== filters.page) {
      const next = writeFiltersToSearchParams({ ...filters, page: pagination.page });
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, filters.page]);

  // ---------- Filter mutators ----------
  const updateFilters = useCallback(
    (partial, options = {}) => {
      const next = { ...filters, ...partial };
      // Any user-driven filter change should reset pagination unless the
      // caller explicitly opts out (e.g. when they're changing the page).
      if (!('page' in partial) && !options.preservePage) {
        next.page = 1;
      }
      userInteractedRef.current = true;
      setSearchParams(writeFiltersToSearchParams(next));
    },
    [filters, setSearchParams],
  );

  const clearAllFilters = useCallback(() => {
    setSearchInput('');
    lastUrlQRef.current = '';
    userInteractedRef.current = true;
    setSearchParams(writeFiltersToSearchParams({ ...DEFAULT_FILTERS }));
  }, [setSearchParams]);

  const handleCategoryChange = useCallback(
    (label) => {
      const id = CATEGORY_LABEL_TO_ID[label] ?? 'all';
      updateFilters({ category: id });
    },
    [updateFilters],
  );

  const handleSearchSubmit = useCallback(
    (value) => {
      // The Hero's submit fires immediately — flush any pending debounce by
      // writing right now.
      lastUrlQRef.current = value;
      setSearchInput(value);
      const next = writeFiltersToSearchParams({ ...filters, q: value, page: 1 });
      setSearchParams(next);
    },
    [filters, setSearchParams],
  );

  const handlePageChange = useCallback(
    (nextPage) => {
      updateFilters({ page: nextPage }, { preservePage: true });
      // Smooth-scroll the user back to the top of the list section.
      window.requestAnimationFrame(() => {
        listSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [updateFilters],
  );

  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Jobs in Vizag',
      alternateName: 'Vizag Jobs',
      url: 'https://jobsinvizag.in',
      description:
        'Find latest jobs in Vizag including IT, fresher, and private jobs in Visakhapatnam. Employers post openings; candidates apply on-site and track status.',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://jobsinvizag.in/?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    }),
    [],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      <SEO
        title="Jobs in Vizag | Latest Job Openings in Visakhapatnam 2026"
        description="Find the latest IT jobs, fresher jobs, part-time jobs and private jobs in Visakhapatnam. Search and filter by category, type, and freshness."
        keywords="Jobs in Vizag, Vizag Jobs, Visakhapatnam Jobs, IT Jobs Vizag, Fresher Jobs Vizag"
        canonical="/"
        structuredData={structuredData}
      />
      <Navbar />
      <HeroSection
        searchTerm={searchInput}
        onSearch={setSearchInput}
        onSubmit={handleSearchSubmit}
        category={CATEGORY_ID_TO_LABEL[filters.category] ?? 'All Categories'}
        onCategoryChange={handleCategoryChange}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-5 pb-mobile-chrome sm:gap-6 sm:px-6 sm:py-10 lg:px-8">
        {isLoading && allJobs.length === 0 ? <LoadingSpinner /> : null}

        {loadError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm">
            {loadError}
          </p>
        ) : null}

        {!isLoading || allJobs.length > 0 ? (
          <>
            <JobsForYou jobs={allJobs} />
            <JobCategoryBrowse />
            <BlogTeaserSection />
            <JobFilters
              filters={filters}
              onUpdate={updateFilters}
              onClearAll={clearAllFilters}
              resultCount={filteredJobs.length}
              isRefreshing={isBackgroundRefreshing}
              isAdmin={isAdmin}
            />
          </>
        ) : null}

        <JobList
          jobs={pagination.items}
          total={filteredJobs.length}
          onResetFilters={clearAllFilters}
          headerRef={listSectionRef}
          isLoading={isLoading && allJobs.length === 0}
        />

        {!isLoading || allJobs.length > 0 ? (
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        ) : null}

        <StatsSection stats={siteStats} isLoading={isLoading && allJobs.length === 0} />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
