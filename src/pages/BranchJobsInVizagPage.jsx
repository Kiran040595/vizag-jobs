import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import JobList from '../components/JobList';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { getJobCategoryPageConfig, JOB_CATEGORY_PAGES } from '../lib/jobCategoryPages';
import { sortJobsForListing } from '../lib/jobFilters';
import { toAbsoluteUrl } from '../lib/site';
import { jobMatchesSearchText, useCachedPublicJobs } from '../lib/useCachedPublicJobs';

const RELATED_LINKS = [
  { to: '/jobs/it', label: 'IT jobs' },
  { to: '/jobs/banking', label: 'banking jobs' },
  { to: '/jobs/sales', label: 'sales jobs' },
  { to: '/jobs/fresher', label: 'fresher jobs' },
  { to: '/jobs/engineering', label: 'engineering jobs' },
];

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

  const related = RELATED_LINKS.filter((link) => link.to !== config.path).slice(0, 4);
  const moreCategories = JOB_CATEGORY_PAGES.filter((page) => page.id !== config.id).slice(0, 6);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: config.headline,
    headline: config.headline,
    description: config.seoDescription,
    url: toAbsoluteUrl(config.path),
    inLanguage: 'en-IN',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Jobs in Vizag',
      url: toAbsoluteUrl('/'),
    },
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

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 py-5 pb-mobile-chrome sm:gap-8 sm:px-6 sm:py-10 lg:px-8">
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
          {isLoading ? 'Loading' : filteredJobs.length} {config.countLabel} jobs match your search
        </p>

        <h2 className="text-2xl font-semibold text-slate-800">Latest {config.label} in Vizag</h2>
        <JobList jobs={filteredJobs} isLoading={isLoading && filteredJobs.length === 0} />

        <article className="prose prose-slate mx-auto max-w-4xl">
          <h2>{config.introTitle}</h2>
          <p>{config.introBody}</p>

          {(config.guideSections || []).map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              {section.body ? <p>{section.body}</p> : null}
              {Array.isArray(section.items) && section.items.length > 0 ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          <p>
            Browse related openings:{' '}
            {related.map((link, index) => (
              <span key={link.to}>
                {index > 0 ? ', ' : null}
                <Link to={link.to}>{link.label}</Link>
              </span>
            ))}
            , and more categories below.
          </p>

          <h3>More job categories in Vizag</h3>
          <ul>
            {moreCategories.map((page) => (
              <li key={page.id}>
                <Link to={page.path}>{page.headline}</Link>
              </li>
            ))}
            <li>
              <Link to="/jobs/it">IT Jobs in Vizag</Link>
            </li>
            <li>
              <Link to="/jobs/fresher">Fresher Jobs in Vizag</Link>
            </li>
            <li>
              <Link to="/jobs/part-time">Part-time Jobs in Vizag</Link>
            </li>
          </ul>
        </article>
      </main>

      <Footer />
    </div>
  );
}
