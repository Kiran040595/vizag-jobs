import { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import JobList from '../components/JobList';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchJobsFromGoogleSheets } from '../services/googleSheets';

export default function PartTimeJobsVizagPage() {
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
          job.tags.includes('Part-time') &&
          (job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.company.toLowerCase().includes(searchTerm.toLowerCase()))
      ),
    [allJobs, searchTerm]
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Part-time Jobs in Vizag",
    "url": "https://jobsinvizag.in/part-time-jobs-vizag",
    "description": "Find part-time jobs and flexible work opportunities in Visakhapatnam for students and working professionals."
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      <SEO
        title="Part-time Jobs in Vizag | Flexible Work Opportunities in Visakhapatnam 2026"
        description="Discover part-time jobs in Vizag for students, freelancers, and working professionals. Find flexible work opportunities in Visakhapatnam."
        keywords="Part-time Jobs Vizag, Flexible Jobs Visakhapatnam, Student Jobs Vizag, Freelance Work Vizag"
        canonical="/part-time-jobs-vizag"
        structuredData={structuredData}
      />
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Part-time Jobs in Vizag</h1>
          <p className="mt-4 text-lg text-slate-600">Flexible work opportunities for students and professionals in Visakhapatnam</p>
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
          {filteredJobs.length} part-time jobs match your search
        </p>

        <h2 className="text-2xl font-semibold text-slate-800">Latest Part-time Jobs in Vizag</h2>
        <JobList jobs={filteredJobs} />

        <div className="prose prose-slate mx-auto max-w-4xl">
          <h2>Part-Time and Flexible Work Opportunities in Visakhapatnam</h2>
          <p>Visakhapatnam offers diverse part-time job opportunities for students, freelancers, and working professionals seeking flexible work arrangements. The city's growing economy and educational institutions create demand for part-time workers across various sectors.</p>

          <p>Part-time jobs in Vizag provide excellent opportunities to earn income while pursuing studies, gaining experience, or balancing multiple commitments. Many employers offer flexible schedules that accommodate students' class timings and working professionals' availability.</p>

          <h3>Popular Part-Time Job Categories in Vizag</h3>
          <ul>
            <li><strong>Teaching and Tutoring:</strong> Subject tutoring, language classes, and skill development sessions.</li>
            <li><strong>Retail and Sales:</strong> Store assistance, product demonstration, and customer service roles.</li>
            <li><strong>Content Creation:</strong> Writing, blogging, social media management, and digital content creation.</li>
            <li><strong>Graphic Design:</strong> Freelance design work, logo creation, and visual content development.</li>
            <li><strong>Data Entry:</strong> Administrative tasks, data processing, and documentation work.</li>
            <li><strong>Event Support:</strong> Event coordination, hospitality services, and promotional activities.</li>
          </ul>

          <h3>Who Can Benefit from Part-Time Jobs?</h3>
          <ul>
            <li><strong>Students:</strong> College and school students looking to earn pocket money and gain work experience.</li>
            <li><strong>Freelancers:</strong> Independent professionals offering specialized services.</li>
            <li><strong>Working Professionals:</strong> Individuals seeking additional income or career transitions.</li>
            <li><strong>Homemakers:</strong> People looking to re-enter the workforce gradually.</li>
            <li><strong>Retirees:</strong> Experienced professionals wanting to stay active and earn supplementary income.</li>
          </ul>

          <h3>Advantages of Part-Time Work in Vizag</h3>
          <ul>
            <li><strong>Flexible Hours:</strong> Work schedules that fit around your other commitments.</li>
            <li><strong>Skill Development:</strong> Opportunity to learn new skills and gain diverse experience.</li>
            <li><strong>Networking:</strong> Build professional connections and expand your network.</li>
            <li><strong>Work-Life Balance:</strong> Better balance between work, studies, and personal life.</li>
            <li><strong>Income Generation:</strong> Additional earnings to support education or personal expenses.</li>
          </ul>

          <h3>Part-Time Job Opportunities by Sector</h3>
          <h4>Education Sector</h4>
          <p>Schools, colleges, and coaching centers frequently hire part-time faculty and support staff. Opportunities include subject tutoring, language teaching, and administrative assistance.</p>

          <h4>Retail and Hospitality</h4>
          <p>Malls, restaurants, and cafes offer part-time positions in customer service, sales, and hospitality. These roles often provide flexible timing and good learning opportunities.</p>

          <h4>Creative and Digital Fields</h4>
          <p>With the growing digital economy, part-time opportunities in content creation, graphic design, and digital marketing are increasing. These roles often allow remote work options.</p>

          <h4>Administrative and Support Roles</h4>
          <p>Offices and businesses need part-time help with data entry, documentation, and administrative tasks. These positions are ideal for students with good computer skills.</p>

          <h3>Finding Part-Time Jobs in Vizag</h3>
          <p>Several avenues to find part-time work in Visakhapatnam:</p>
          <ul>
            <li><strong>Educational Institutions:</strong> Contact colleges, schools, and coaching centers directly.</li>
            <li><strong>Online Platforms:</strong> Freelance websites and job portals listing part-time opportunities.</li>
            <li><strong>Local Businesses:</strong> Visit retail stores, cafes, and service providers in your area.</li>
            <li><strong>Networking:</strong> Connect with professionals and join local community groups.</li>
            <li><strong>Campus Placements:</strong> Many colleges have tie-ups with companies offering part-time roles.</li>
          </ul>

          <h3>Tips for Success in Part-Time Jobs</h3>
          <ul>
            <li><strong>Time Management:</strong> Balance your schedule effectively between work and other commitments.</li>
            <li><strong>Reliability:</strong> Be punctual and consistent in your work approach.</li>
            <li><strong>Communication:</strong> Keep open communication with employers about your availability.</li>
            <li><strong>Professionalism:</strong> Maintain professional standards in all your work interactions.</li>
            <li><strong>Skill Building:</strong> Use part-time work as an opportunity to develop new skills.</li>
          </ul>

          <h3>Legal Considerations for Part-Time Work</h3>
          <p>When taking up part-time employment in Vizag:</p>
          <ul>
            <li>Ensure proper employment contracts or agreements</li>
            <li>Understand payment terms and schedules</li>
            <li>Be aware of tax implications for additional income</li>
            <li>Maintain records of your work and earnings</li>
            <li>Check for any restrictions based on your primary employment or student status</li>
          </ul>

          <h3>Future of Part-Time Work in Vizag</h3>
          <p>The demand for part-time and flexible work arrangements is growing in Visakhapatnam. With more businesses adopting flexible work models and the rise of the gig economy, part-time opportunities are expected to increase significantly.</p>

          <p>The city's educational ecosystem and growing service sector provide a strong foundation for part-time employment. As more companies recognize the benefits of flexible work arrangements, part-time jobs will become an integral part of Vizag's employment landscape.</p>

          <h3>Start Your Part-Time Career in Vizag</h3>
          <p>Whether you're a student looking to earn while you learn or a professional seeking flexible work options, Vizag offers numerous part-time opportunities. Our platform helps you discover suitable part-time positions that match your skills and schedule.</p>

          <p>Explore part-time jobs in Vizag today and find the perfect work-life balance!</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}