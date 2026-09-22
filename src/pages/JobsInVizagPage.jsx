import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import JobList from '../components/JobList';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { sortJobsForListing } from '../lib/jobFilters';
import { toAbsoluteUrl } from '../lib/site';
import { jobMatchesSearchText, useCachedPublicJobs } from '../lib/useCachedPublicJobs';

export default function JobsInVizagPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const companyQuery = searchParams.get('company') || '';
  const textQuery = searchParams.get('search') || searchParams.get('q') || '';
  const urlQuery = companyQuery || textQuery;
  const [searchTerm, setSearchTerm] = useState(urlQuery);
  const listHeadingRef = useRef(null);

  const { allJobs, isLoading, loadError } = useCachedPublicJobs();

  // Sync searchTerm when URL query params change (e.g. navigation from companies directory or back/forward)
  useEffect(() => {
    setSearchTerm(urlQuery);
    if (urlQuery && listHeadingRef.current) {
      listHeadingRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [urlQuery]);

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    const nextParams = new URLSearchParams(searchParams);
    const trimmed = val.trim();
    // User typing clears exact company mode and switches to global text search
    nextParams.delete('company');
    if (trimmed) {
      nextParams.set('search', trimmed);
    } else {
      nextParams.delete('search');
      nextParams.delete('q');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('search');
    nextParams.delete('q');
    nextParams.delete('company');
    setSearchParams(nextParams, { replace: true });
  };

  const filteredJobs = useMemo(() => {
    // If exact company name is specified via ?company=, match ONLY exact company name
    if (companyQuery) {
      const target = companyQuery.trim().toLowerCase().replace(/\s+/g, ' ');
      return sortJobsForListing(
        allJobs.filter(
          (job) => (job.company || '').trim().toLowerCase().replace(/\s+/g, ' ') === target,
        ),
      );
    }

    return sortJobsForListing(
      allJobs.filter((job) => jobMatchesSearchText(job, searchTerm)),
    );
  }, [allJobs, companyQuery, searchTerm]);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Jobs in Vizag",
    "url": toAbsoluteUrl('/jobs'),
    "description": "Browse all available jobs in Visakhapatnam including IT, fresher, part-time and experienced positions."
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      <SEO
        title="Jobs in Vizag | All Job Opportunities in Visakhapatnam 2026"
        description="Browse all job opportunities in Vizag. Find IT jobs, fresher jobs, part-time jobs and experienced positions in Visakhapatnam."
        keywords="Jobs in Vizag, Visakhapatnam Jobs, All Jobs Vizag, Job Opportunities Vizag"
        canonical="/jobs"
        structuredData={structuredData}
      />
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 py-5 pb-mobile-chrome sm:gap-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Jobs in Vizag</h1>
          <p className="mt-4 text-lg text-slate-600">Discover all job opportunities in Visakhapatnam</p>
        </div>

        <HeroSection searchTerm={searchTerm} onSearch={handleSearchChange} />

        {isLoading ? (
          <LoadingSpinner />
        ) : null}
        {loadError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm">
            {loadError}
          </p>
        ) : null}

        {/* Company / Keyword Filter Active Banner */}
        {companyQuery ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/90 p-4 text-sm text-cyan-950 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-600 font-bold text-white text-xs shadow-sm">
                🏢
              </span>
              <div>
                <p className="font-semibold text-cyan-900">
                  Showing jobs for company: <strong className="font-bold text-cyan-950">&quot;{companyQuery}&quot;</strong>
                </p>
                <p className="text-xs text-cyan-700">
                  {filteredJobs.length} {filteredJobs.length === 1 ? 'live opening' : 'live openings'} in Visakhapatnam (exact match)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClearSearch}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300 bg-white px-3.5 py-2 text-xs font-bold text-cyan-900 shadow-sm transition hover:bg-cyan-100 hover:text-cyan-950"
            >
              <span>✕ Show all jobs ({allJobs.length})</span>
            </button>
          </div>
        ) : searchTerm ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/90 p-4 text-sm text-cyan-950 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-600 font-bold text-white text-xs shadow-sm">
                🔍
              </span>
              <div>
                <p className="font-semibold text-cyan-900">
                  Showing jobs matching <strong className="font-bold text-cyan-950">&quot;{searchTerm}&quot;</strong>
                </p>
                <p className="text-xs text-cyan-700">
                  {filteredJobs.length} {filteredJobs.length === 1 ? 'opening' : 'openings'} found in Visakhapatnam
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClearSearch}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300 bg-white px-3.5 py-2 text-xs font-bold text-cyan-900 shadow-sm transition hover:bg-cyan-100 hover:text-cyan-950"
            >
              <span>✕ Show all jobs ({allJobs.length})</span>
            </button>
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm">
            {filteredJobs.length} jobs match your search
          </p>
        )}

        <div ref={listHeadingRef} className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-800">
            {companyQuery
              ? `Jobs at "${companyQuery}"`
              : searchTerm
              ? `Jobs matching "${searchTerm}"`
              : 'Latest Jobs in Vizag'}
          </h2>
        </div>

        {filteredJobs.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-base font-semibold text-slate-800">
              No direct job openings currently listed for &quot;{companyQuery || searchTerm}&quot;
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try searching with another keyword or explore other top employers in Visakhapatnam.
            </p>
            <button
              type="button"
              onClick={handleClearSearch}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow hover:bg-slate-800"
            >
              <span>View all available jobs →</span>
            </button>
          </div>
        ) : (
          <JobList jobs={filteredJobs} />
        )}

      </main>

      <Footer />
    </div>
  );
}
