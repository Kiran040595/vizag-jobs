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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

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
            return;
          }
        } catch (error) {
          console.error('Error parsing cached jobs:', error);
        }
      }

      // If no cache, expired cache, or empty cache, fetch from API
      try {
        const jobs = await fetchJobsFromGoogleSheets();
        if (!isMounted) return;

        if (jobs.length > 0) {
          setAllJobs(jobs);
          // Cache with timestamp
          const cacheData = {
            jobs,
            timestamp: Date.now()
          };
          sessionStorage.setItem('vizagJobs', JSON.stringify(cacheData));
          setLoadError('');
          return;
        }

        setLoadError('No jobs found. Please check back later.');
      } catch {
        if (!isMounted) return;
        setLoadError('Could not load jobs. Please check your connection.');
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
  }, []);

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
        </p>
        <JobList jobs={filteredJobs} />
        <StatsSection />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
