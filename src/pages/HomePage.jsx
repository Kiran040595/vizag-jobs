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
import { JOB_LIST_SESSION_CACHE_TTL_MS, fetchJobs } from '../services/jobs';
import { filterProcessedJobsForPublicDisplay } from '../lib/jobDisplayWindow';
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
const CACHE_KEY = 'vizagJobs_v2';
const CACHE_TTL_MS = JOB_LIST_SESSION_CACHE_TTL_MS;
// Trigger a background refresh once we're within the last minute of the TTL.
const CACHE_STALE_AT_MS = Math.max(CACHE_TTL_MS - 60_000, Math.floor(CACHE_TTL_MS * 0.8));

/** Hero's existing select uses these labels; map between them and the URL ids. */
const CATEGORY_LABEL_TO_ID = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.label, o.id]));
const CATEGORY_ID_TO_LABEL = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.id, o.label]));

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFiltersFromSearchParams(searchParams), [searchParams]);

  const [allJobs, setAllJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const refreshJobsInBackground = useCallback(async () => {
    setIsBackgroundRefreshing(true);
    try {
      const jobs = await fetchJobs({}, true);
      if (jobs.length > 0) {
        setAllJobs(jobs);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ jobs, timestamp: Date.now() }));
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
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ jobs, timestamp: Date.now() }));
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
      const cachedRaw = sessionStorage.getItem(CACHE_KEY);
      if (cachedRaw) {
        try {
          const { jobs, timestamp } = JSON.parse(cachedRaw);
          const age = Date.now() - Number(timestamp);
          if (Array.isArray(jobs) && jobs.length > 0 && age < CACHE_TTL_MS) {
            const visible = filterProcessedJobsForPublicDisplay(jobs);
            if (visible.length > 0) {
              setAllJobs(visible);
              setIsLoading(false);
              if (age > CACHE_STALE_AT_MS) refreshJobsInBackground();
              return;
            }
          }
        } catch (err) {
          console.error('Error parsing cached jobs:', err);
        }
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
        'Find latest jobs in Vizag including IT jobs, fresher jobs, part-time jobs and private jobs in Visakhapatnam.',
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
        {isLoading ? <LoadingSpinner /> : null}

        {loadError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm">
            {loadError}
          </p>
        ) : null}

        {!isLoading ? (
          <>
            <JobCategoryBrowse />
            <BlogTeaserSection />
            <JobFilters
            filters={filters}
            onUpdate={updateFilters}
            onClearAll={clearAllFilters}
            resultCount={filteredJobs.length}
            isRefreshing={isBackgroundRefreshing}
          />
          </>
        ) : null}

        <JobList
          jobs={pagination.items}
          total={filteredJobs.length}
          onResetFilters={clearAllFilters}
          headerRef={listSectionRef}
        />

        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
        />

        <StatsSection stats={siteStats} isLoading={isLoading} />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
