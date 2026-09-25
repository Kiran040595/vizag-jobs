import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import FullJobDetailsLink from '../components/FullJobDetailsLink';
import { removeSavedJob } from '../lib/savedJobs';
import { useSavedJobsList } from '../lib/useSavedJob';
import { cardCompanyName, cardLocation } from '../lib/jobCardDisplay';

const formatSavedAt = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export default function SavedJobsPage() {
  const savedJobs = useSavedJobsList();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-cyan-50/20 to-white">
      <SEO
        title="Saved Jobs | Vizag Jobs"
        description="View jobs you saved on Jobs in Vizag. Your saved list is stored in this browser."
        canonical="/saved-jobs"
      />
      <Navbar />

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Saved Jobs</h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Jobs you bookmarked on this device. Saved on this browser only — not tied to an account.
          </p>
        </div>

        {savedJobs.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-base font-semibold text-slate-900">No saved jobs yet</p>
            <p className="mt-2 text-sm text-slate-600">
              Tap the bookmark icon on any job card to save it here for quick access.
            </p>
            <Link
              to="/jobs"
              className="mt-5 inline-flex rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Browse jobs
            </Link>
          </section>
        ) : (
          <ul className="space-y-3">
            {savedJobs.map((job) => {
              const company = cardCompanyName(job.company);
              const location = cardLocation(job.location);

              return (
              <li
                key={job.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-slate-900">{job.title}</h2>
                    {company || location ? (
                      <p className="mt-1 text-sm text-slate-600">
                        {[company, location].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                    {job.savedAt ? (
                      <p className="mt-1 text-xs text-slate-500">Saved on {formatSavedAt(job.savedAt)}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => removeSavedJob(job.id)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:text-sm"
                    >
                      Remove
                    </button>
                    <FullJobDetailsLink
                      jobPath={job.jobPath || `/job/${job.slug || job.id}`}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 sm:text-sm"
                    >
                      View details
                    </FullJobDetailsLink>
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </main>

      <Footer />
    </div>
  );
}
