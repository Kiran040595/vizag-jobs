import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import JobList from '../components/JobList';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { getJobCategoryPageConfig } from '../lib/jobCategoryPages';
import { sortJobsForListing } from '../lib/jobFilters';
import { toAbsoluteUrl } from '../lib/site';
import { jobMatchesSearchText, useCachedPublicJobs } from '../lib/useCachedPublicJobs';

export default function BranchJobsInVizagPage({ categoryId }) {
  const config = getJobCategoryPageConfig(categoryId);
  const [searchTerm, setSearchTerm] = useState('');
  const { allJobs, isLoading, loadError } = useCachedPublicJobs();

  const filteredJobs = useMemo(() => {
    if (!config) return [];
    return sortJobsForListing(
      allJobs.filter(
        (job) => config.matchesJob(job) && jobMatchesSearchText(job, searchTerm),
      ),
    );
  }, [allJobs, config, searchTerm]);

  if (!config) {
    return <Navigate to="/jobs" replace />;
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.headline,
    url: toAbsoluteUrl(config.path),
    description: config.seoDescription,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      <SEO
        title={config.seoTitle}
        description={config.seoDescription}
        keywords={config.seoKeywords}
        canonical={config.path}
        structuredData={structuredData}
      />
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">{config.headline}</h1>
          <p className="mt-4 text-lg text-slate-600">{config.subheadline}</p>
        </div>

        <HeroSection searchTerm={searchTerm} onSearch={setSearchTerm} />

        {isLoading ? <LoadingSpinner /> : null}
        {loadError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm">
            {loadError}
          </p>
        ) : null}

        <p className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm">
          {filteredJobs.length} {config.countLabel} jobs match your search
        </p>

        <h2 className="text-2xl font-semibold text-slate-800">Latest {config.label} in Vizag</h2>
        <JobList jobs={filteredJobs} />

        <div className="prose prose-slate mx-auto max-w-4xl">
          <h2>{config.introTitle}</h2>
          <p>{config.introBody}</p>
          <p>
            Browse other fields:{' '}
            <Link to="/jobs/it">IT jobs</Link>,{' '}
            <Link to="/jobs/civil">civil jobs</Link>,{' '}
            <Link to="/jobs/mechanical">mechanical jobs</Link>,{' '}
            <Link to="/jobs/engineering">all engineering jobs</Link>, and{' '}
            <Link to="/jobs/fresher">fresher jobs</Link> in Vizag.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
