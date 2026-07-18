import { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import JobList from '../components/JobList';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { JOB_LIST_SESSION_CACHE_TTL_MS, fetchJobs } from '../services/jobs';
import { filterProcessedJobsForPublicDisplay } from '../lib/jobDisplayWindow';
import { sortJobsForListing } from '../lib/jobFilters';
import { isItRelatedJob } from '../lib/jobItMatch';
import { toAbsoluteUrl } from '../lib/site';

const jobMatchesSearchText = (job, raw) => {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  // Listing payload is slim — full `description` lives only on the detail
  // page now. Search the metadata fields actually present on the card.
  const blob = [
    job.title,
    job.company,
    job.skills,
    job.shortDescription,
    job.category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return blob.includes(q);
};

export default function ItJobsInVizagPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [allJobs, setAllJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadJobs = async () => {
      const cachedData = sessionStorage.getItem('vizagJobs_v2');
      const CACHE_DURATION = JOB_LIST_SESSION_CACHE_TTL_MS;

      if (cachedData) {
        try {
          const { jobs, timestamp } = JSON.parse(cachedData);
          const now = Date.now();

          if (jobs && jobs.length > 0 && (now - timestamp) < CACHE_DURATION) {
            const visibleJobs = filterProcessedJobsForPublicDisplay(jobs);
            if (visibleJobs.length > 0) {
              setAllJobs(visibleJobs);
              setIsLoading(false);
              return;
            }
          }
        } catch (error) {
          console.error('Error parsing cached jobs:', error);
        }
      }

      // If no cache, expired cache, or empty cache, fetch from API
      try {
        const jobs = await fetchJobs();
        if (!isMounted) return;

        if (jobs.length > 0) {
          setAllJobs(jobs);
          // Cache with timestamp
          const cacheData = {
            jobs,
            timestamp: Date.now()
          };
          sessionStorage.setItem('vizagJobs_v2', JSON.stringify(cacheData));
          setLoadError('');
          return;
        }

        setLoadError('No jobs found. Please check back later.');
      } catch (error) {
        if (!isMounted) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load jobs. Please check your connection.');
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
      sortJobsForListing(
        allJobs.filter(
          (job) =>
            isItRelatedJob(job) && jobMatchesSearchText(job, searchTerm)
        ),
      ),
    [allJobs, searchTerm]
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "IT Jobs in Vizag",
    "url": toAbsoluteUrl('/jobs/it'),
    "description": "Find IT jobs in Visakhapatnam including software development, data analysis, and tech positions."
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      <SEO
        title="IT Jobs in Vizag | Software & Tech Jobs in Visakhapatnam 2026"
        description="Discover IT jobs in Vizag including software engineering, data analysis, web development and tech positions in Visakhapatnam."
        keywords="IT Jobs Vizag, Software Jobs Vizag, Tech Jobs Visakhapatnam, IT Careers Vizag"
        canonical="/jobs/it"
        structuredData={structuredData}
      />
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 py-5 pb-mobile-chrome sm:gap-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">IT Jobs in Vizag</h1>
          <p className="mt-4 text-lg text-slate-600">Find software and technology job opportunities in Visakhapatnam</p>
        </div>

        <HeroSection searchTerm={searchTerm} onSearch={setSearchTerm} />

        {isLoading ? (
          <LoadingSpinner />
        ) : null}
        {loadError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm">
            {loadError}
          </p>
        ) : null}
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm">
          {filteredJobs.length} IT jobs match your search
        </p>

        <h2 className="text-2xl font-semibold text-slate-800">Latest IT Jobs in Vizag</h2>
        <JobList jobs={filteredJobs} />

        <div className="prose prose-slate mx-auto max-w-4xl">
          <h2>Information Technology Jobs in Visakhapatnam</h2>
          <p>Visakhapatnam has emerged as a significant IT hub in Andhra Pradesh, attracting tech companies and startups. The city's IT sector offers diverse opportunities for software developers, data analysts, cybersecurity professionals, and other tech roles.</p>

          <p>With the growing demand for digital transformation across industries, IT jobs in Vizag are on the rise. Companies are looking for skilled professionals who can contribute to innovative projects and help drive technological advancement.</p>

          <h3>Popular IT Job Roles in Vizag</h3>
          <ul>
            <li><strong>Software Developer:</strong> Full-stack, front-end, and back-end development positions using various programming languages.</li>
            <li><strong>Data Analyst:</strong> Roles involving data processing, analysis, and visualization to support business decisions.</li>
            <li><strong>Web Developer:</strong> Creating and maintaining websites and web applications.</li>
            <li><strong>Cybersecurity Specialist:</strong> Protecting systems and data from cyber threats.</li>
            <li><strong>System Administrator:</strong> Managing IT infrastructure and ensuring system reliability.</li>
            <li><strong>UI/UX Designer:</strong> Designing user interfaces and improving user experience.</li>
          </ul>

          <h3>Why Choose IT Careers in Vizag?</h3>
          <ul>
            <li><strong>Growing Industry:</strong> The IT sector in Vizag is expanding rapidly with new companies setting up operations.</li>
            <li><strong>Competitive Salaries:</strong> IT professionals in Vizag enjoy attractive compensation packages.</li>
            <li><strong>Skill Development:</strong> Many companies offer training programs and certifications.</li>
            <li><strong>Work Environment:</strong> Modern offices with collaborative and innovative work cultures.</li>
          </ul>

          <h3>Required Skills for IT Jobs</h3>
          <p>To succeed in IT jobs in Vizag, professionals should possess:</p>
          <ul>
            <li>Programming languages like Java, Python, JavaScript, C++, etc.</li>
            <li>Database management skills (SQL, MongoDB, etc.)</li>
            <li>Web technologies (HTML, CSS, React, Angular, etc.)</li>
            <li>Cloud computing knowledge (AWS, Azure, GCP)</li>
            <li>Problem-solving and analytical thinking</li>
            <li>Communication and teamwork skills</li>
          </ul>

          <h3>IT Companies in Vizag</h3>
          <p>Several reputed IT companies have established their presence in Visakhapatnam, including:</p>
          <ul>
            <li>Tech Mahindra</li>
            <li>Cognizant</li>
            <li>Infosys</li>
            <li>Wipro</li>
            <li>Local startups and software development firms</li>
          </ul>

          <p>These companies offer various IT job opportunities ranging from entry-level positions to senior technical roles. Many also provide remote work options and flexible working arrangements.</p>

          <h3>Future of IT Jobs in Vizag</h3>
          <p>The future looks promising for IT professionals in Vizag. With the city's focus on becoming a digital hub and the increasing adoption of technology across sectors, the demand for skilled IT talent is expected to grow significantly.</p>

          <p>Emerging technologies like Artificial Intelligence, Machine Learning, Blockchain, and Internet of Things are creating new job opportunities. Professionals who stay updated with the latest trends and continuously upgrade their skills will find abundant career opportunities in Vizag's IT sector.</p>

          <h3>Getting Started with IT Jobs in Vizag</h3>
          <p>Whether you're a fresh graduate or an experienced professional, Vizag offers excellent opportunities to build a rewarding career in IT. Our platform helps you discover the latest IT job openings and connect with potential employers.</p>

          <p>Start exploring IT jobs in Vizag today and take the first step towards a successful tech career!</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
