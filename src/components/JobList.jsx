import JobCard from './JobCard';

const JobList = ({ jobs }) => {
  const jobsToShow = jobs || [];

  if (jobsToShow.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Recent Job Openings</h2>
          <a href="#" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
            View All Jobs
          </a>
        </div>
        <div className="empty-state">
          <h2>No jobs found</h2>
          <p>Try a different keyword, company name, or clear your search.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-4 sm:mb-5">
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Recent Job Openings</h2>
        <a href="#" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
          View All Jobs
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {jobsToShow.map((job) => (
          <JobCard
            key={job.id}
            jobId={job.id}
            companyLogo={job.companyLogo}
            jobTitle={job.title}
            companyName={job.company}
            location={job.location}
            experience={job.experience}
            salary={job.salary}
            description={job.description}
            tags={job.tags}
          />
        ))}
      </div>
    </section>
  );
};

export default JobList;