import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchJobs } from '../services/jobs';
import { getJobDetailPath } from '../lib/jobRoutes';

const splitCommaValues = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default function JobDetailsPage() {
  const { jobId, jobSlug, jobSegment } = useParams();
  const navigate = useNavigate();
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
        const jobs = await fetchJobs();
        if (!isMounted) return;
        if (jobs.length > 0) {
          setAllJobs(jobs);
          // Cache with timestamp
          const cacheData = {
            jobs,
            timestamp: Date.now()
          };
          sessionStorage.setItem('vizagJobs', JSON.stringify(cacheData));
        }
        setLoadError('');
      } catch (error) {
        if (!isMounted) return;
        console.error('Error fetching job details:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load job details.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadJobs();

    return () => {
      isMounted = false;
    };
  }, []);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const routeJobIdentifier = jobSlug || jobId || '';
  const currentPath = jobSlug && jobSegment ? `/jobs/${jobSegment}/${jobSlug}` : null;

  const job = useMemo(
    () =>
      allJobs.find(
        (item) =>
          String(item.slug) === String(routeJobIdentifier) ||
          String(item.id) === String(routeJobIdentifier)
      ),
    [allJobs, routeJobIdentifier]
  );

  useEffect(() => {
    if (!job) {
      return;
    }

    const canonicalPath = getJobDetailPath(job);
    if (currentPath === canonicalPath) {
      return;
    }

    navigate(canonicalPath, { replace: true });
  }, [currentPath, job, navigate]);

  const skills = splitCommaValues(job?.skills);
  const responsibilities = splitCommaValues(job?.responsibilities);
  const eligibility = splitCommaValues(job?.eligibility);

  const jobTitle = job ? `${job.title} at ${job.company} - Vizag Jobs` : 'Job Details - Vizag Jobs';
  const jobDescription = job ? `Apply for ${job.title} position at ${job.company} in ${job.location}. ${job.description || 'Find more job opportunities in Visakhapatnam.'}` : 'Job details and application information for positions in Visakhapatnam.';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/20 to-white">
      <SEO
        title={jobTitle}
        description={jobDescription}
        canonical={job ? getJobDetailPath(job) : currentPath || `/job/${routeJobIdentifier}`}
      />
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
          ← Back to jobs
        </Link>

        {isLoading ? (
          <LoadingSpinner message="Loading job details..." />
        ) : null}

        {!isLoading && loadError ? (
          <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
            {loadError}
          </section>
        ) : null}

        {!isLoading && !job ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">Job not found</h1>
            <p className="mt-2 text-sm text-slate-600">
              This job may be removed or inactive. Please go back and choose another listing.
            </p>
          </section>
        ) : null}

        {job ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{job.title}</h1>
                <p className="mt-1 text-sm text-slate-600 sm:text-base">
                  {job.company} · {job.location}
                </p>
              </div>
              {job.applyLink ? (
                <a
                  href={job.applyLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Apply Now
                </a>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
              <p><span className="font-semibold text-slate-900">Category:</span> {job.category || 'N/A'}</p>
              <p><span className="font-semibold text-slate-900">Job Type:</span> {job.jobType || 'N/A'}</p>
              <p><span className="font-semibold text-slate-900">Work Mode:</span> {job.workMode || 'N/A'}</p>
              <p><span className="font-semibold text-slate-900">Experience:</span> {job.experience || 'N/A'}</p>
              <p><span className="font-semibold text-slate-900">Fresher:</span> {job.isFresher || 'N/A'}</p>
              <p><span className="font-semibold text-slate-900">Salary:</span> {job.salary || 'N/A'}</p>
              <p><span className="font-semibold text-slate-900">Source:</span> {job.source || 'N/A'}</p>
              <p><span className="font-semibold text-slate-900">Posted At:</span> {job.postedAt || 'N/A'}</p>
              <p><span className="font-semibold text-slate-900">Status:</span> {job.status || 'N/A'}</p>
            </div>

            {job.shortDescription ? (
              <div className="mt-6">
                <h2 className="text-lg font-bold text-slate-900">Short Description</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">{job.shortDescription}</p>
              </div>
            ) : null}

            {job.description ? (
              <div className="mt-6">
                <h2 className="text-lg font-bold text-slate-900">Full Description</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">{job.description}</p>
              </div>
            ) : null}

            {skills.length > 0 ? (
              <div className="mt-6">
                <h2 className="text-lg font-bold text-slate-900">Skills</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {responsibilities.length > 0 ? (
              <div className="mt-6">
                <h2 className="text-lg font-bold text-slate-900">Responsibilities</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                  {responsibilities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {eligibility.length > 0 ? (
              <div className="mt-6">
                <h2 className="text-lg font-bold text-slate-900">Eligibility</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                  {eligibility.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {job.warning ? (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <span className="font-semibold">Warning:</span> {job.warning}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
