import { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import CategoriesSection from '../components/CategoriesSection';
import JobList from '../components/JobList';
import StatsSection from '../components/StatsSection';
import CTASection from '../components/CTASection';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchJobsFromGoogleSheets } from '../services/googleSheets';

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [allJobs, setAllJobs] = useState([]);
  const [displayedJobs, setDisplayedJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [hasMoreJobs, setHasMoreJobs] = useState(true);

  const JOBS_PER_PAGE = 4;

  useEffect(() => {
    let isMounted = true;

    const loadJobs = async () => {
      // First, try to load from sessionStorage (expires after 5 minutes)
      const cachedData = sessionStorage.getItem('vizagJobs');
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
      let hasValidCache = false;

      if (cachedData) {
        try {
          const { jobs, timestamp } = JSON.parse(cachedData);
          const now = Date.now();

          // Check if cache is still valid (less than 5 minutes old)
          if (jobs && jobs.length > 0 && (now - timestamp) < CACHE_DURATION) {
            setAllJobs(jobs);
            setDisplayedJobs(jobs.slice(0, JOBS_PER_PAGE));
            setHasMoreJobs(jobs.length > JOBS_PER_PAGE);
            setIsLoading(false);
            hasValidCache = true;

            // Start background refresh if cache is getting old (older than 4 minutes)
            if ((now - timestamp) > (4 * 60 * 1000)) {
              refreshJobsInBackground();
            }
            return;
          }
        } catch (error) {
          console.error('Error parsing cached jobs:', error);
        }
      }

      // If no valid cache, fetch from API
      await fetchFreshJobs();
    };

    const fetchFreshJobs = async () => {
      try {
        // Initially load only 4 jobs for faster loading
        const jobs = await fetchJobsFromGoogleSheets(false, JOBS_PER_PAGE);
        if (!isMounted) return;

        if (jobs.length > 0) {
          setAllJobs(jobs);
          setDisplayedJobs(jobs);
          setHasMoreJobs(jobs.length >= JOBS_PER_PAGE); // Check if there might be more

          // Cache all jobs in background for future use
          cacheAllJobsInBackground();
          setLoadError('');
          return;
        }

        setLoadError('No jobs found. Please check back later.');
      } catch (error) {
        if (!isMounted) return;
        console.error('Error fetching jobs:', error);
        setLoadError('Failed to load jobs. Please try refreshing the page.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const cacheAllJobsInBackground = async () => {
      try {
        // Cache all jobs in background without limit
        await fetchJobsFromGoogleSheets(true);
      } catch (error) {
        console.warn('Background caching failed:', error);
      }
    };

    const loadMoreJobs = async () => {
      if (isLoadingMore || !hasMoreJobs) return;

      setIsLoadingMore(true);
      try {
        // Load next batch of jobs
        const nextBatchStart = displayedJobs.length;
        const nextBatchEnd = nextBatchStart + JOBS_PER_PAGE;

        // If we have all jobs cached, use them
        if (allJobs.length > displayedJobs.length) {
          const nextJobs = allJobs.slice(nextBatchStart, nextBatchEnd);
          setDisplayedJobs(prev => [...prev, ...nextJobs]);
          setHasMoreJobs(nextBatchEnd < allJobs.length);
        } else {
          // Fetch more jobs from API
          const moreJobs = await fetchJobsFromGoogleSheets(false, nextBatchEnd);
          if (moreJobs.length > displayedJobs.length) {
            const newJobs = moreJobs.slice(nextBatchStart);
            setAllJobs(moreJobs);
            setDisplayedJobs(prev => [...prev, ...newJobs]);
            setHasMoreJobs(moreJobs.length > nextBatchEnd);
          } else {
            setHasMoreJobs(false);
          }
        }
      } catch (error) {
        console.error('Error loading more jobs:', error);
        setLoadError('Failed to load more jobs. Please try again.');
      } finally {
        if (isMounted) {
          setIsLoadingMore(false);
        }
      }
    };

    const refreshJobsInBackground = async () => {
      setIsBackgroundRefreshing(true);
      try {
        const jobs = await fetchJobsFromGoogleSheets(true); // Force refresh
        if (!isMounted) return;

        if (jobs.length > 0) {
          setAllJobs(jobs);
          // Update displayed jobs if we have more jobs now
          const currentDisplayedCount = displayedJobs.length;
          if (jobs.length > currentDisplayedCount) {
            setDisplayedJobs(jobs.slice(0, Math.max(currentDisplayedCount, JOBS_PER_PAGE)));
            setHasMoreJobs(jobs.length > currentDisplayedCount);
          }
          // Update cache with new timestamp
          const cacheData = {
            jobs,
            timestamp: Date.now()
          };
          sessionStorage.setItem('vizagJobs', JSON.stringify(cacheData));
        }
      } catch (error) {
        // Silently fail background refresh - user still has cached data
        console.warn('Background refresh failed:', error);
      } finally {
        if (isMounted) {
          setIsBackgroundRefreshing(false);
        }
      }
    };

    loadJobs();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredJobs = useMemo(
    () =>
      displayedJobs.filter(
        (job) =>
          job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.company.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [displayedJobs, searchTerm]
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Vizag Jobs",
    "url": "https://jobsinvizag.in",
    "description": "Find latest jobs in Vizag including IT jobs, fresher jobs, part-time jobs and private jobs in Visakhapatnam.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://jobsinvizag.in/?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      <SEO
        title="Vizag Jobs | Latest Jobs in Visakhapatnam 2026"
        description="Find latest jobs in Vizag including IT jobs, fresher jobs, part-time jobs and private jobs in Visakhapatnam."
        keywords="Vizag Jobs, Jobs in Vizag, Visakhapatnam Jobs, IT Jobs Vizag, Fresher Jobs Vizag"
        canonical="/"
        structuredData={structuredData}
      />
      <Navbar />
      <HeroSection searchTerm={searchTerm} onSearch={setSearchTerm} />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* <CategoriesSection /> */}
        {isLoading ? (
          <LoadingSpinner />
        ) : null}
        {loadError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm">
            {loadError}
          </p>
        ) : null}
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm">
          {filteredJobs.length} jobs match your search
          {isBackgroundRefreshing && (
            <span className="ml-2 inline-flex items-center text-xs text-blue-600">
              <svg className="mr-1 h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating...
            </span>
          )}
        </p>
        <JobList jobs={filteredJobs} />

        {/* Load More Button */}
        {hasMoreJobs && !searchTerm && (
          <div className="flex justify-center py-6">
            <button
              onClick={loadMoreJobs}
              disabled={isLoadingMore}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  Load More Jobs
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                  </svg>
                </>
              )}
            </button>
          </div>
        )}

        <StatsSection />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
