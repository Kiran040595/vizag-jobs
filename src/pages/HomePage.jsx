import { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import CategoriesSection from '../components/CategoriesSection';
import JobList from '../components/JobList';
import StatsSection from '../components/StatsSection';
import CTASection from '../components/CTASection';
import Footer from '../components/Footer';
import { fallbackJobs } from '../data/fallbackJobs';
import { fetchJobsFromGoogleSheets } from '../services/googleSheets';

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [allJobs, setAllJobs] = useState(fallbackJobs);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadJobs = async () => {
      try {
        const jobs = await fetchJobsFromGoogleSheets();
        if (!isMounted) return;

        if (jobs.length > 0) {
          setAllJobs(jobs);
          setLoadError('');
          return;
        }

        setLoadError('No rows found in Google Sheets. Showing fallback jobs.');
      } catch {
        if (!isMounted) return;
        setLoadError('Could not load jobs from Google Sheets. Showing fallback jobs.');
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      <Navbar />
      <HeroSection searchTerm={searchTerm} onSearch={setSearchTerm} />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <CategoriesSection />
        {isLoading ? (
          <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm">
            Loading jobs from Google Sheets...
          </p>
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
