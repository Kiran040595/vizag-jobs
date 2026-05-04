import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import { fetchAdminJobs, toggleAdminJobFeatured, updateAdminJobStatus } from '../services/adminJobs';

const STATUS_STYLES = {
  published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  draft: 'border-amber-200 bg-amber-50 text-amber-700',
  archived: 'border-slate-200 bg-slate-100 text-slate-600',
};

const normalizeSearchText = (job) =>
  [
    job.title,
    job.company,
    job.slug,
    job.status,
    job.category,
    job.job_type,
    job.location,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const sortJobs = (jobs) =>
  [...jobs].sort((left, right) => {
    const leftTime = left.posted_at ? new Date(left.posted_at).getTime() : 0;
    const rightTime = right.posted_at ? new Date(right.posted_at).getTime() : 0;
    return rightTime - leftTime;
  });

const upsertJob = (jobs, nextJob) => {
  const existingIndex = jobs.findIndex((job) => job.id === nextJob.id);

  if (existingIndex === -1) {
    return sortJobs([nextJob, ...jobs]);
  }

  const nextJobs = [...jobs];
  nextJobs[existingIndex] = nextJob;
  return sortJobs(nextJobs);
};

const formatDateTime = (value) => {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export default function AdminJobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyJobId, setBusyJobId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let ignore = false;

    const loadJobs = async () => {
      try {
        const data = await fetchAdminJobs();
        if (ignore) {
          return;
        }

        setJobs(sortJobs(data));
        setLoadError('');
      } catch (error) {
        if (ignore) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : 'Could not load jobs.');
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    loadJobs();

    return () => {
      ignore = true;
    };
  }, []);

  const deferredSearchTerm = useDeferredValue(searchTerm);

  const filteredJobs = useMemo(() => {
    const normalizedTerm = deferredSearchTerm.trim().toLowerCase();

    if (!normalizedTerm) {
      return jobs;
    }

    return jobs.filter((job) => normalizeSearchText(job).includes(normalizedTerm));
  }, [deferredSearchTerm, jobs]);

  const handleStatusChange = async (jobId, status) => {
    setBusyJobId(jobId);
    setLoadError('');
    setNotice('');

    try {
      const updatedJob = await updateAdminJobStatus(jobId, status);
      setJobs((currentJobs) => upsertJob(currentJobs, updatedJob));
      setNotice(`Job moved to ${status}.`);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not update job status.');
    } finally {
      setBusyJobId('');
    }
  };

  const handleFeaturedToggle = async (job) => {
    setBusyJobId(job.id);
    setLoadError('');
    setNotice('');

    try {
      const updatedJob = await toggleAdminJobFeatured(job.id, !job.is_featured);
      setJobs((currentJobs) => upsertJob(currentJobs, updatedJob));
      setNotice(updatedJob.is_featured ? 'Job marked as featured.' : 'Job removed from featured listings.');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not update featured status.');
    } finally {
      setBusyJobId('');
    }
  };

  return (
    <AdminShell
      title="Manage existing jobs"
      description="Review old jobs on a separate page so management actions stay independent from the new-job form."
    >
      <SEO title="Existing Jobs | Vizag Jobs Admin" description="Manage existing Vizag Jobs listings." canonical="/admin/jobs" />

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Manage listings</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Existing jobs</h2>
          </div>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search title, company, slug, status..."
            className="h-11 w-full max-w-sm rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          />
        </div>

        {loadError ? (
          <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</p>
        ) : null}

        {notice ? (
          <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>
        ) : null}

        {isLoading ? (
          <div className="mt-8">
            <LoadingSpinner message="Loading admin jobs..." />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <h3 className="text-lg font-bold text-slate-900">No jobs match this search.</h3>
            <p className="mt-2 text-sm text-slate-600">Try a different company, slug, or status filter.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredJobs.map((job) => {
              const isBusy = busyJobId === job.id;

              return (
                <article key={job.id} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-950">{job.title}</h3>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                            STATUS_STYLES[job.status] || STATUS_STYLES.draft
                          }`}
                        >
                          {job.status}
                        </span>
                        {job.is_featured ? (
                          <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                            Featured
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {job.company} / {job.location || 'Visakhapatnam'} / {job.category || 'No category'}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">Slug: {job.slug}</p>
                      <p className="mt-1 text-xs text-slate-500">Posted: {formatDateTime(job.posted_at)}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/jobs/${job.id}/edit`)}
                        className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleStatusChange(job.id, job.status === 'published' ? 'draft' : 'published')}
                        className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {job.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleFeaturedToggle(job)}
                        className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {job.is_featured ? 'Unfeature' : 'Feature'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || job.status === 'archived'}
                        onClick={() => handleStatusChange(job.id, 'archived')}
                        className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
