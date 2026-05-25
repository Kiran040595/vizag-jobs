import { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import JobList from '../components/JobList';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { JOB_LIST_SESSION_CACHE_TTL_MS, fetchJobs } from '../services/jobs';
import { filterProcessedJobsForPublicDisplay } from '../lib/jobDisplayWindow';
import { toAbsoluteUrl } from '../lib/site';

export default function FresherJobsInVizagPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [allJobs, setAllJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadJobs = async () => {
      const cachedData = sessionStorage.getItem('vizagJobs');
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
          sessionStorage.setItem('vizagJobs', JSON.stringify(cacheData));
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
      allJobs.filter(
        (job) =>
          (job.tags.includes('Fresher') || job.experience.includes('0') || job.experience.toLowerCase().includes('fresher')) &&
          (job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.company.toLowerCase().includes(searchTerm.toLowerCase()))
      ),
    [allJobs, searchTerm]
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Fresher Jobs in Vizag",
    "url": toAbsoluteUrl('/jobs/fresher'),
    "description": "Find fresher jobs and entry-level positions in Visakhapatnam for recent graduates and beginners."
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      <SEO
        title="Fresher Jobs in Vizag | Entry-Level Jobs in Visakhapatnam 2026"
        description="Discover fresher jobs and entry-level opportunities in Vizag for recent graduates. Start your career in Visakhapatnam."
        keywords="Fresher Jobs Vizag, Entry Level Jobs Visakhapatnam, Beginner Jobs Vizag, Graduate Jobs Vizag"
        canonical="/jobs/fresher"
        structuredData={structuredData}
      />
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Fresher Jobs in Vizag</h1>
          <p className="mt-4 text-lg text-slate-600">Entry-level job opportunities for fresh graduates in Visakhapatnam</p>
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
          {filteredJobs.length} fresher jobs match your search
        </p>

        <h2 className="text-2xl font-semibold text-slate-800">Latest Fresher Jobs in Vizag</h2>
        <JobList jobs={filteredJobs} />

        <div className="prose prose-slate mx-auto max-w-4xl">
          <h2>Entry-Level Jobs for Fresh Graduates in Visakhapatnam</h2>
          <p>Visakhapatnam offers excellent opportunities for fresh graduates to kickstart their careers. With a growing economy and expanding industries, Vizag provides a supportive environment for newcomers to the workforce.</p>

          <p>Many companies in Vizag actively recruit fresh talent, offering training programs, mentorship, and career development opportunities. Whether you're a recent graduate from engineering, commerce, arts, or science streams, you'll find suitable entry-level positions in various sectors.</p>

          <h3>Popular Fresher Job Roles in Vizag</h3>
          <ul>
            <li><strong>Software Trainee:</strong> Entry-level positions in IT companies with training provided.</li>
            <li><strong>Management Trainee:</strong> Graduate roles in various industries with leadership development programs.</li>
            <li><strong>Business Development Executive:</strong> Sales and marketing positions for commerce graduates.</li>
            <li><strong>Customer Support Associate:</strong> Communication roles in BPO and service sectors.</li>
            <li><strong>Content Writer:</strong> Writing and content creation positions for arts graduates.</li>
            <li><strong>Lab Technician:</strong> Healthcare and research positions for science graduates.</li>
          </ul>

          <h3>Industries Hiring Freshers in Vizag</h3>
          <ul>
            <li><strong>Information Technology:</strong> Software companies and IT services firms.</li>
            <li><strong>Banking and Finance:</strong> Banks, NBFCs, and financial institutions.</li>
            <li><strong>Healthcare:</strong> Hospitals, clinics, and pharmaceutical companies.</li>
            <li><strong>Manufacturing:</strong> Engineering and production companies.</li>
            <li><strong>Education:</strong> Schools, colleges, and training institutes.</li>
            <li><strong>Retail and E-commerce:</strong> Stores and online platforms.</li>
          </ul>

          <h3>Skills Required for Fresher Jobs</h3>
          <p>While experience might not be required, employers look for:</p>
          <ul>
            <li>Basic computer skills and MS Office proficiency</li>
            <li>Communication skills in English and local languages</li>
            <li>Basic knowledge of your field of study</li>
            <li>Problem-solving and analytical thinking</li>
            <li>Teamwork and interpersonal skills</li>
            <li>Willingness to learn and adapt</li>
          </ul>

          <h3>Benefits of Starting Your Career in Vizag</h3>
          <ul>
            <li><strong>Lower Cost of Living:</strong> More affordable than major metros.</li>
            <li><strong>Work-Life Balance:</strong> Pleasant work environment with less stress.</li>
            <li><strong>Career Growth:</strong> Opportunities for quick advancement in growing companies.</li>
            <li><strong>Learning Opportunities:</strong> Many companies provide extensive training.</li>
            <li><strong>Supportive Community:</strong> Friendly work culture and mentorship programs.</li>
          </ul>

          <h3>Companies Hiring Freshers in Vizag</h3>
          <p>Several companies actively recruit fresh graduates:</p>
          <ul>
            <li>Tech companies like Tech Mahindra, Cognizant, and Infosys</li>
            <li>Banks such as HDFC, ICICI, and SBI</li>
            <li>Manufacturing firms like Hindustan Shipyard and BHEL</li>
            <li>Healthcare providers and pharmaceutical companies</li>
            <li>Retail chains and service providers</li>
          </ul>

          <h3>Tips for Fresh Graduates</h3>
          <ul>
            <li><strong>Build Your Resume:</strong> Highlight academic achievements, projects, and internships.</li>
            <li><strong>Prepare for Interviews:</strong> Research companies and practice common interview questions.</li>
            <li><strong>Network:</strong> Attend job fairs, campus placements, and industry events.</li>
            <li><strong>Continuous Learning:</strong> Keep updating your skills through online courses and certifications.</li>
            <li><strong>Be Open to Opportunities:</strong> Consider various roles and be willing to start at entry-level positions.</li>
          </ul>

          <h3>Future Prospects for Freshers in Vizag</h3>
          <p>The job market for fresh graduates in Vizag is promising. With ongoing industrial development and infrastructure projects, the demand for skilled young professionals is increasing. Many freshers find their first job in Vizag and build successful long-term careers here.</p>

          <p>The city's growing reputation as an educational and industrial hub ensures a steady influx of job opportunities for new graduates. With the right attitude and skills, freshers can establish strong foundations for their professional journeys in Visakhapatnam.</p>

          <h3>Start Your Career Journey Today</h3>
          <p>If you're a fresh graduate looking to begin your professional career, Vizag offers the perfect starting point. Our platform helps you discover entry-level job opportunities that match your qualifications and career aspirations.</p>

          <p>Browse fresher jobs in Vizag and take the first step towards a successful career!</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
