export default function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <h3 className="text-xl font-bold text-white">VizagJobs</h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Find quality job opportunities in Visakhapatnam across IT, Non-IT, fresher, and
            experienced roles.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-white">Quick Links</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li><a href="#" className="transition hover:text-white">Home</a></li>
            <li><a href="#" className="transition hover:text-white">Jobs</a></li>
            <li><a href="#" className="transition hover:text-white">Companies</a></li>
            <li><a href="#" className="transition hover:text-white">Contact</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-white">For Job Seekers</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li><a href="#" className="transition hover:text-white">Create Profile</a></li>
            <li><a href="#" className="transition hover:text-white">Saved Jobs</a></li>
            <li><a href="#" className="transition hover:text-white">Career Tips</a></li>
            <li><a href="#" className="transition hover:text-white">Resume Builder</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-white">For Employers</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li><a href="#" className="transition hover:text-white">Post a Job</a></li>
            <li><a href="#" className="transition hover:text-white">Employer Login</a></li>
            <li><a href="#" className="transition hover:text-white">Browse Resumes</a></li>
            <li><a href="#" className="transition hover:text-white">Pricing</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-800 px-4 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} VizagJobs. All rights reserved.
      </div>
    </footer>
  );
}
