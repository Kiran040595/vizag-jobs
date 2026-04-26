import { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import JobList from '../components/JobList';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { fetchJobsFromGoogleSheets } from '../services/googleSheets';

export default function JobsInVizagPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [allJobs, setAllJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadJobs = async () => {
      // First, try to load from sessionStorage
      const cachedJobs = sessionStorage.getItem('vizagJobs');
      if (cachedJobs) {
        try {
          const jobs = JSON.parse(cachedJobs);
          if (jobs.length > 0) {
            setAllJobs(jobs);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error('Error parsing cached jobs:', error);
        }
      }

      // If no cache or empty, fetch from API
      try {
        const jobs = await fetchJobsFromGoogleSheets();
        if (!isMounted) return;

        if (jobs.length > 0) {
          setAllJobs(jobs);
          sessionStorage.setItem('vizagJobs', JSON.stringify(jobs));
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
    "name": "Jobs in Vizag",
    "url": "https://jobsinvizag.in/jobs-in-vizag",
    "description": "Browse all available jobs in Visakhapatnam including IT, fresher, part-time and experienced positions."
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      <SEO
        title="Jobs in Vizag | All Job Opportunities in Visakhapatnam 2026"
        description="Browse all job opportunities in Vizag. Find IT jobs, fresher jobs, part-time jobs and experienced positions in Visakhapatnam."
        keywords="Jobs in Vizag, Visakhapatnam Jobs, All Jobs Vizag, Job Opportunities Vizag"
        canonical="/jobs-in-vizag"
        structuredData={structuredData}
      />
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Jobs in Vizag</h1>
          <p className="mt-4 text-lg text-slate-600">Discover all job opportunities in Visakhapatnam</p>
        </div>

        <HeroSection searchTerm={searchTerm} onSearch={setSearchTerm} />

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

        <h2 className="text-2xl font-semibold text-slate-800">Latest Jobs in Vizag</h2>
        <JobList jobs={filteredJobs} />

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