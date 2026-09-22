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
  const urlQuery = searchParams.get('search') || searchParams.get('q') || searchParams.get('company') || '';
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
    if (trimmed) {
      nextParams.set('search', trimmed);
    } else {
      nextParams.delete('search');
      nextParams.delete('q');
      nextParams.delete('company');
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

  const filteredJobs = useMemo(
    () =>
      sortJobsForListing(
        allJobs.filter((job) => jobMatchesSearchText(job, searchTerm)),
      ),
    [allJobs, searchTerm]
  );

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
        {searchTerm ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/90 p-4 text-sm text-cyan-950 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-600 font-bold text-white text-xs shadow-sm">
                🏢
              </span>
              <div>
                <p className="font-semibold text-cyan-900">
                  Showing jobs for <strong className="font-bold text-cyan-950">&quot;{searchTerm}&quot;</strong>
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
            {searchTerm ? `Jobs at "${searchTerm}"` : 'Latest Jobs in Vizag'}
          </h2>
        </div>

        {filteredJobs.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-base font-semibold text-slate-800">
              No direct job openings currently listed for &quot;{searchTerm}&quot;
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

        <div className="prose prose-slate mx-auto max-w-4xl">
          <h2>Job Opportunities in Visakhapatnam</h2>
          <p>Visakhapatnam, commonly known as Vizag, is a rapidly growing city in Andhra Pradesh, India, offering numerous job opportunities across various sectors. From IT and technology to manufacturing and services, Vizag has become a hub for employment in recent years.</p>

          <p>The city's strategic location, excellent infrastructure, and presence of major industries make it an attractive destination for job seekers. Whether you're a fresh graduate looking for your first job or an experienced professional seeking career advancement, Vizag offers diverse opportunities to build your career.</p>

          <h3>Why Choose Jobs in Vizag?</h3>
          <ul>
            <li><strong>Growing Economy:</strong> Vizag's economy is expanding rapidly with investments in sectors like IT, pharmaceuticals, and manufacturing.</li>
            <li><strong>Quality of Life:</strong> The city offers a good work-life balance with beautiful beaches, parks, and a pleasant climate.</li>
            <li><strong>Cost of Living:</strong> Compared to metros like Hyderabad or Bangalore, Vizag offers a more affordable cost of living.</li>
            <li><strong>Educational Institutions:</strong> Presence of reputed universities and technical institutes ensures a steady supply of skilled workforce.</li>
          </ul>

          <h3>Popular Job Sectors in Vizag</h3>
          <p>Vizag's job market spans across multiple industries:</p>
          <ul>
            <li><strong>Information Technology:</strong> Software development, data analysis, cybersecurity, and IT support roles.</li>
            <li><strong>Manufacturing:</strong> Engineering, quality control, and production management positions.</li>
            <li><strong>Healthcare:</strong> Medical professionals, nursing, and healthcare administration roles.</li>
            <li><strong>Education:</strong> Teaching positions in schools, colleges, and training institutes.</li>
            <li><strong>Banking and Finance:</strong> Banking operations, financial analysis, and insurance roles.</li>
          </ul>

          <h3>Career Growth Opportunities</h3>
          <p>Many companies in Vizag offer excellent career progression opportunities. With the city's growing reputation as an industrial hub, professionals can expect competitive salaries, skill development programs, and advancement prospects.</p>

          <p>Whether you're looking for entry-level positions or senior roles, Vizag's job market has something for everyone. The city's welcoming environment and supportive community make it an ideal place to start or advance your career.</p>

          <h3>Finding Your Dream Job in Vizag</h3>
          <p>Our platform connects job seekers with employers across Visakhapatnam. We regularly update our listings to ensure you have access to the latest job opportunities. Use our search functionality to find jobs that match your skills and experience level.</p>

          <p>Start your job search today and discover the exciting career opportunities waiting for you in Vizag!</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
