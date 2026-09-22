import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import JobList from '../components/JobList';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { sortJobsForListing } from '../lib/jobFilters';
import { isDirectPosting } from '../lib/jobDirectPosting';
import { toAbsoluteUrl } from '../lib/site';
import { jobMatchesSearchText, useCachedPublicJobs } from '../lib/useCachedPublicJobs';

export default function DirectJobsInVizagPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { allJobs, isLoading, loadError } = useCachedPublicJobs();

  const directJobs = useMemo(
    () =>
      sortJobsForListing(
        allJobs.filter(
          (job) => isDirectPosting(job) && jobMatchesSearchText(job, searchTerm),
        ),
      ),
    [allJobs, searchTerm],
  );

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Direct Company Jobs in Vizag',
    url: toAbsoluteUrl('/jobs/vizagjobs'),
    description:
      'Verified jobs posted directly by local companies and employers in Visakhapatnam. Apply directly on Vizag Jobs.',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-white">
      <SEO
        title="Direct Company Jobs in Vizag | Verified Openings in Visakhapatnam 2026"
        description="Browse verified jobs posted directly by local companies and employers in Visakhapatnam. Apply directly on Vizag Jobs with no third-party redirects."
        keywords="Direct Company Jobs Vizag, Vizag Direct Hiring, Company Openings Visakhapatnam, Verified Jobs Vizag, Apply Directly Vizag"
        canonical="/jobs/vizagjobs"
        structuredData={structuredData}
      />
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 py-5 pb-mobile-chrome sm:gap-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-800 shadow-sm sm:text-sm">
            <span>🏢</span>
            <span>Verified Local Employers</span>
          </div>
          <h1 className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">
            Direct Company Jobs in Vizag
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600 sm:text-lg">
            Job openings posted directly by local companies and employers in Visakhapatnam. Apply
            directly on our platform without navigating third-party job boards.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              to="/employer/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Post a Job for Your Company
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Browse All Jobs
            </Link>
          </div>
        </div>

        <HeroSection searchTerm={searchTerm} onSearch={setSearchTerm} />

        {isLoading ? <LoadingSpinner /> : null}

        {loadError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm">
            {loadError}
          </p>
        ) : null}

        <p className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-2.5 text-sm font-medium text-emerald-900 shadow-sm">
          <strong className="font-semibold">{directJobs.length}</strong> verified direct company{' '}
          {directJobs.length === 1 ? 'opening' : 'openings'} available in Visakhapatnam
        </p>

        <h2 className="text-2xl font-bold text-slate-800">Featured Direct Openings</h2>
        <JobList jobs={directJobs} />

        <div className="prose prose-slate mx-auto max-w-4xl pt-6">
          <h2>Why Apply to Direct Company Jobs on Vizag Jobs?</h2>
          <p>
            Unlike automated scrapes from broad job aggregators, direct company postings on{' '}
            <strong>JobsInVizag.in</strong> are submitted directly by authenticated local employers,
            HR managers, and recruitment teams in Visakhapatnam.
          </p>

          <h3>Advantages of Direct Openings:</h3>
          <ul>
            <li>
              <strong>Direct HR Visibility:</strong> Your application, resume, and profile reach the
              hiring manager's inbox immediately without getting lost in third-party databases.
            </li>
            <li>
              <strong>Easy On-Site Application:</strong> Apply with your registered student profile
              or resume with one click — no redundant logins or redirect loops.
            </li>
            <li>
              <strong>Verified Legitimacy:</strong> All direct job posts are screened to prevent
              consultancy fee scams and ensure authentic local opportunities.
            </li>
            <li>
              <strong>Transparent Status Tracking:</strong> Track whether your application has been
              reviewed, shortlisted, or scheduled for an interview directly on your dashboard.
            </li>
          </ul>

          <h3>For Employers in Visakhapatnam:</h3>
          <p>
            Looking to hire talented candidates, fresh graduates, or experienced professionals in
            Vizag?{' '}
            <Link to="/employer/register" className="font-semibold text-emerald-700 underline">
              Create an Employer Account
            </Link>{' '}
            and publish your openings directly to thousands of active local job seekers.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
