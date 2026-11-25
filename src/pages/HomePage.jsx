import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import JobSourceTabs from '../components/JobSourceTabs';
import CommunityQaSection from '../components/CommunityQaSection';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { useEmployerAuth } from '../hooks/useEmployerAuth';
import { usePaginatedPublicJobs } from '../hooks/usePaginatedPublicJobs';
import { rankJobsForStudent } from '../lib/studentJobMatch';
import {
  fetchJobs,
  fetchPublicJobStats,
  readCachedPublicJobStats,
} from '../services/jobs';
import { readHomeBootstrapJobs } from '../lib/homePageBootstrap';
import { readCachedPublicJobs } from '../lib/publicJobsSessionCache';
import { computeSiteStats } from '../lib/siteStats';
import { countCompanyCareerJobs, countDirectJobs } from '../lib/jobDirectPosting';
import {
  CATEGORY_OPTIONS,
  DEFAULT_FILTERS,
  PAGE_SIZE,
  applyJobFilters,
  isAnyFilterActive,
  paginate,
  readFiltersFromSearchParams,
  writeFiltersToSearchParams,
} from '../lib/jobFilters';

const SEARCH_DEBOUNCE_MS = 300;
const MATCHING_POOL_LIMIT = 250;

/** Hero's existing select uses these labels; map between them and the URL ids. */
const CATEGORY_LABEL_TO_ID = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.label, o.id]));
const CATEGORY_ID_TO_LABEL = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.id, o.label]));

const initialSsrJobs = (() => {
  try {
    return readHomeBootstrapJobs() || [];
  } catch {
    return [];
  }
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

  const { isStudent, profile, profileComplete, session } = useStudentAuth();
  const { isEmployer } = useEmployerAuth();

  // Stats (~250 bytes cached 5 min in sessionStorage)
  const [publicStats, setPublicStats] = useState(() => readCachedPublicJobStats());

  // On-demand job pool ONLY loaded if a signed-in student opens "Jobs for You" tab
  const [matchingPool, setMatchingPool] = useState(() => readCachedPublicJobs()?.jobs || null);
  const [isMatchingLoading, setIsMatchingLoading] = useState(false);
  const [matchingError, setMatchingError] = useState('');

  // Local input state so typing feels snappy. The URL is the source of truth
  // for the *applied* search; we sync to it on a 300ms debounce.
  const [searchInput, setSearchInput] = useState(filters.q);
  const lastUrlQRef = useRef(filters.q);
  const listSectionRef = useRef(null);
  const userInteractedRef = useRef(false);

  // Sync local input <- URL when the URL changes from outside (back/forward,
  // chip removal, clear-all). Don't clobber active typing.
  useEffect(() => {
    if (filters.q !== lastUrlQRef.current) {
      setSearchInput(filters.q);
      lastUrlQRef.current = filters.q;
    }
  }, [filters.q]);

  // Debounce-write input -> URL `q` param.
  useEffect(() => {
    if (searchInput === filters.q) return;
    const handle = window.setTimeout(() => {
      lastUrlQRef.current = searchInput;
      const next = writeFiltersToSearchParams({ ...filters, company: '', q: searchInput, page: 1 });
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

  // Fetch tiny ~250-byte aggregate counts for tabs and StatsSection
  useEffect(() => {
    let isMounted = true;
    if (readCachedPublicJobStats()) {
      return undefined;
    }
    fetchPublicJobStats()
      .then((nextStats) => {
        if (isMounted && nextStats) {
          setPublicStats(nextStats);
        }
      })
      .catch(() => {
        // Fallback stats below remain graceful
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Only fetch the matching pool if signed-in student views the "Jobs for You" tab
  useEffect(() => {
    if (filters.tab !== 'matching' || !session || !isStudent || !profileComplete) {
      return undefined;
    }
    if (Array.isArray(matchingPool) && matchingPool.length > 0) {
      return undefined;
    }

    let isMounted = true;
    setIsMatchingLoading(true);
    setMatchingError('');

    fetchJobs({ limit: MATCHING_POOL_LIMIT })
      .then((jobs) => {
        if (!isMounted) return;
        setMatchingPool(Array.isArray(jobs) ? jobs : []);
      })
      .catch((error) => {
        if (!isMounted) return;
        setMatchingError(
          error instanceof Error ? error.message : 'Failed to load personalized job matches.',
        );
      })
      .finally(() => {
        if (isMounted) setIsMatchingLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [filters.tab, isStudent, matchingPool, profileComplete, session]);

  // Serve Page 1-2 directly from SSR bootstrap if unfiltered and SSR rows exist
  const canServeFromSsr = useMemo(() => {
    if (initialSsrJobs.length === 0) return false;
    if (isAnyFilterActive(filters)) return false;
    const neededEnd = filters.page * PAGE_SIZE;
    return filters.page >= 1 && neededEnd <= initialSsrJobs.length;
  }, [filters]);

  const paginatedResult = usePaginatedPublicJobs({
    tab: filters.tab,
    category: filters.category,
    jobType: filters.jobType,
    freshness: filters.freshness,
    source: filters.source,
    company: filters.company,
    search: filters.q,
    page: filters.page,
    pageSize: PAGE_SIZE,
    enabled: filters.tab !== 'matching' && !canServeFromSsr,
  });

  // Matching tab derivations (runs only when matchingPool is populated)
  const matchingJobsRanked = useMemo(() => {
    if (!session || !isStudent || !profileComplete || !profile || !Array.isArray(matchingPool)) {
      return null;
    }
    return rankJobsForStudent(matchingPool, profile, 100);
  }, [isStudent, matchingPool, profile, profileComplete, session]);

  const matchingCandidateJobs = useMemo(() => {
    if (!Array.isArray(matchingJobsRanked)) return [];
    return matchingJobsRanked.map((item) => ({
      ...item.job,
      _matchReasons: item.reasons,
      _eligibility: item.eligibility,
      _matchScore: item.score,
    }));
  }, [matchingJobsRanked]);

  const matchingFiltered = useMemo(() => {
    if (filters.tab !== 'matching' || !session || !isStudent || !profileComplete) {
      return [];
    }
    return applyJobFilters(matchingCandidateJobs, filters, { preserveOrder: true });
  }, [filters, isStudent, matchingCandidateJobs, profileComplete, session]);

  // Unified pagination object across SSR, server-side RPC, and matching tab
  const pagination = useMemo(() => {
    if (filters.tab === 'matching') {
      return paginate(matchingFiltered, filters.page, PAGE_SIZE);
    }
    if (canServeFromSsr) {
      const ssrTotal = publicStats?.activeJobs || initialSsrJobs.length;
      const totalPages = Math.max(1, Math.ceil(ssrTotal / PAGE_SIZE));
      const start = (filters.page - 1) * PAGE_SIZE;
      return {
        page: filters.page,
        pageSize: PAGE_SIZE,
        total: ssrTotal,
        totalPages,
        items: initialSsrJobs.slice(start, start + PAGE_SIZE),
      };
    }
    return {
      page: paginatedResult.page,
      pageSize: PAGE_SIZE,
      total: paginatedResult.total,
      totalPages: paginatedResult.totalPages,
      items: paginatedResult.items,
    };
  }, [canServeFromSsr, filters.page, filters.tab, matchingFiltered, paginatedResult, publicStats?.activeJobs]);

  const isLoading = filters.tab === 'matching'
    ? isMatchingLoading && matchingCandidateJobs.length === 0
    : !canServeFromSsr && paginatedResult.isLoading;

  const isBackgroundRefreshing = filters.tab === 'matching'
    ? isMatchingLoading && matchingCandidateJobs.length > 0
    : !canServeFromSsr && paginatedResult.isFetching && paginatedResult.items.length > 0;

  const loadError = filters.tab === 'matching'
    ? matchingError
    : (!canServeFromSsr ? paginatedResult.loadError : '');

  // Fallback counts when publicStats hasn't loaded yet
  const fallbackPool = matchingPool || initialSsrJobs;
  const fallbackSiteStats = useMemo(
    () => (fallbackPool.length > 0 ? computeSiteStats(fallbackPool) : null),
    [fallbackPool],
  );
  const directJobsCount = publicStats?.directCount ?? countDirectJobs(fallbackPool);
  const companyCareerJobsCount = publicStats?.companyCount ?? countCompanyCareerJobs(fallbackPool);
  const totalJobsCount =
    publicStats?.activeJobs ??
    (!isAnyFilterActive(filters) && pagination.total > 0 ? pagination.total : fallbackPool.length);

  const siteStats = useMemo(() => {
    if (publicStats) {
      return {
        activeJobs: publicStats.activeJobs,
        companies: publicStats.companies,
        newThisWeek: publicStats.newThisWeek,
        categories: publicStats.categories,
        postedToday: publicStats.postedToday,
      };
    }
    return fallbackSiteStats;
  }, [fallbackSiteStats, publicStats]);

  const jobListTitle = useMemo(() => {
    if (filters.tab === 'matching') return 'Jobs Matching Your Profile';
    if (filters.tab === 'direct') return 'Jobs Posted on VizagJobs';
    if (filters.tab === 'company') return 'Official Company Job Openings';
    return 'Recent Job Openings';
  }, [filters.tab]);

  const jobListSubtitle = useMemo(() => {
    if (filters.tab === 'matching' && isStudent && profileComplete) {
      return 'Ranked from your skills, target roles, fresher eligibility, and preferred locations.';
    }
    return '';
  }, [filters.tab, isStudent, profileComplete]);

  const matchingEmptyState = useMemo(() => {
    if (filters.tab !== 'matching') {
      return null;
    }
    if (!session || !isStudent) {
      return (
        <div className="py-6 text-center sm:py-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cyan-100 text-3xl">
            ✨
          </div>
          <h3 className="mt-4 text-xl font-bold text-slate-900">Get Jobs Matching Your Profile</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Sign in or create a free student profile to see personalized job recommendations tailored to your skills, qualifications, and preferred roles in Vizag.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/student/login?next=/?tab=matching"
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              Student Sign In
            </Link>
            <Link
              to="/student/register?next=/?tab=matching"
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              Create Free Account
            </Link>
          </div>
        </div>
      );
    }
    if (!profileComplete) {
      return (
        <div className="py-6 text-center sm:py-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-3xl">
            🎯
          </div>
          <h3 className="mt-4 text-xl font-bold text-slate-900">Complete your profile to see matched jobs</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Add your degree, skills, and primary target role in your student profile. We&apos;ll automatically match and score openings for you.
          </p>
          <div className="mt-6">
            <Link
              to="/student/profile"
              className="inline-flex items-center rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition"
            >
              Complete Profile Now
            </Link>
          </div>
        </div>
      );
    }
    if (!isMatchingLoading && matchingCandidateJobs.length === 0) {
      return (
        <div className="py-6 text-center sm:py-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-3xl">
            🔍
          </div>
          <h3 className="mt-4 text-xl font-bold text-slate-900">No jobs match your profile yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            We scan and add verified Visakhapatnam job openings daily. Try updating your target roles or adding more skills to broaden your matches.
          </p>
          <div className="mt-6">
            <Link
              to="/student/profile"
              className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              Update Profile Preferences
            </Link>
          </div>
        </div>
      );
    }
    return null;
  }, [filters.tab, isMatchingLoading, isStudent, matchingCandidateJobs.length, profileComplete, session]);

  // Snap back only after loading finishes so direct ?page=3 visits don't reset early
  useEffect(() => {
    if (isLoading || isBackgroundRefreshing) return;
    if (pagination.page !== filters.page) {
      const next = writeFiltersToSearchParams({ ...filters, page: pagination.page });
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isBackgroundRefreshing, pagination.page, filters.page]);

  // ---------- Filter mutators ----------
  const updateFilters = useCallback(
    (partial, options = {}) => {
      const next = { ...filters, ...partial };
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
      lastUrlQRef.current = value;
      setSearchInput(value);
      const next = writeFiltersToSearchParams({ ...filters, company: '', q: value, page: 1 });
      setSearchParams(next);
    },
    [filters, setSearchParams],
  );

  const handlePageChange = useCallback(
    (nextPage) => {
      updateFilters({ page: nextPage }, { preservePage: true });
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
        {isLoading && pagination.items.length === 0 ? <LoadingSpinner /> : null}

        {loadError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm">
            {loadError}
          </p>
        ) : null}

        <JobSourceTabs
          activeTab={filters.tab}
          onTabChange={(nextTab) => updateFilters({ tab: nextTab })}
          totalCount={totalJobsCount}
          directCount={directJobsCount}
          companyCount={companyCareerJobsCount}
          matchingCount={matchingJobsRanked ? matchingJobsRanked.length : null}
          showMatchingTab={!isEmployer}
          isStudent={Boolean(session && isStudent)}
          profileComplete={Boolean(profileComplete)}
        />
        <JobFilters
          filters={filters}
          onUpdate={updateFilters}
          onClearAll={clearAllFilters}
          resultCount={pagination.total}
          isRefreshing={isBackgroundRefreshing}
          isAdmin={isAdmin}
        />

        <JobList
          jobs={pagination.items}
          total={pagination.total}
          title={jobListTitle}
          subtitle={jobListSubtitle}
          emptyState={matchingEmptyState}
          onResetFilters={clearAllFilters}
          headerRef={listSectionRef}
          isLoading={isLoading && pagination.items.length === 0}
        />

        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
        />

        <JobCategoryBrowse />
        <BlogTeaserSection />
        <CommunityQaSection />

        <StatsSection stats={siteStats} isLoading={!siteStats} />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
