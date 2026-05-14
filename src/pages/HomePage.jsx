import { useEffect, useMemo, useState, useCallback } from 'react';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import JobList from '../components/JobList';
import StatsSection from '../components/StatsSection';
import CTASection from '../components/CTASection';
import BlogTeaserSection from '../components/BlogTeaserSection';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchJobs } from '../services/jobs';

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [allJobs, setAllJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Refresh jobs in background
  const refreshJobsInBackground = useCallback(async () => {
    setIsBackgroundRefreshing(true);
    try {
      const jobs = await fetchJobs({}, true); // Force refresh
      if (jobs.length > 0) {
        setAllJobs(jobs);
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
      setIsBackgroundRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadJobs = async () => {
      // First, try to load from sessionStorage (expires after 5 minutes)
      const cachedData = sessionStorage.getItem('vizagJobs');
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
      if (cachedData) {
        try {
          const { jobs, timestamp } = JSON.parse(cachedData);
          const now = Date.now();

          // Check if cache is still valid (less than 5 minutes old)
          if (jobs && jobs.length > 0 && (now - timestamp) < CACHE_DURATION) {
            setAllJobs(jobs);
            setIsLoading(false);

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
        const jobs = await fetchJobs();
        if (!isMounted) return;

        if (jobs.length > 0) {
          setAllJobs(jobs);
          const cacheData = {
            jobs,
            timestamp: Date.now()
          };
          sessionStorage.setItem('vizagJobs', JSON.stringify(cacheData));
          setLoadError('');
          return;
        }

        setLoadError('No jobs found. Please check back later.');
      } catch (error) {
        if (!isMounted) return;
        console.error('Error fetching jobs:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load jobs. Please try refreshing the page.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadJobs();

    return () => {
      isMounted = false;
    };
  }, [refreshJobsInBackground]);

  const filteredJobs = useMemo(
    () =>
      allJobs.filter(
        (job) =>
          job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.company.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [allJobs, searchTerm]
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

        <BlogTeaserSection />

        <StatsSection />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
