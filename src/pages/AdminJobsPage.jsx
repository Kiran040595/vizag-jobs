import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  approveAdminJob,
  fetchAdminJobs,
  rejectAdminJob,
  toggleAdminJobFeatured,
  updateAdminJobStatus,
} from '../services/adminJobs';

const STATUS_STYLES = {
  published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  pending: 'border-blue-200 bg-blue-50 text-blue-700',
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
    job.created_by,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const sortJobs = (jobs) =>
  [...jobs].sort((left, right) => {
    const pendingRank = (status) => (status === 'pending' ? 0 : 1);
    const rankDiff = pendingRank(left.status) - pendingRank(right.status);
    if (rankDiff !== 0) {
      return rankDiff;
    }

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
  useAdminAuth();
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyJobId, setBusyJobId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rejectingJob, setRejectingJob] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
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

    return jobs.filter((job) => {
      if (statusFilter === 'pending' && job.status !== 'pending') {
        return false;
      }

      if (!normalizedTerm) {
        return true;
      }

      return normalizeSearchText(job).includes(normalizedTerm);
    });
  }, [deferredSearchTerm, jobs, statusFilter]);

  const pendingCount = useMemo(() => jobs.filter((job) => job.status === 'pending').length, [jobs]);

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

  const handleApprove = async (jobId) => {
    setBusyJobId(jobId);
    setLoadError('');
    setNotice('');

    try {
      const updatedJob = await approveAdminJob(jobId);
      setJobs((currentJobs) => upsertJob(currentJobs, updatedJob));
      setNotice('Job approved and published on the portal.');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not approve the job.');
    } finally {
      setBusyJobId('');
    }
  };

  const handleReject = async () => {
    if (!rejectingJob) {
      return;
    }

    setBusyJobId(rejectingJob.id);
    setLoadError('');
    setNotice('');

    try {
      const updatedJob = await rejectAdminJob(rejectingJob.id, rejectReason);
      setJobs((currentJobs) => upsertJob(currentJobs, updatedJob));
      setNotice('Job rejected.');
      setRejectingJob(null);
      setRejectReason('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not reject the job.');
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
      description="Review employer submissions, approve jobs for the public portal, or reject listings."
    >
      <SEO title="Existing Jobs | Vizag Jobs Admin" description="Manage existing Vizag Jobs listings." canonical="/admin/jobs" />

      <section className="mb-8 rounded-[2rem] border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-6 shadow-lg shadow-cyan-100/40">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700">External jobs</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">Fetch from LinkedIn, Naukri, Indeed, and more</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Use the dedicated fetch page to pull one source at a time, review listings, run Make SEO, then publish.
        </p>
        <Link
          to="/admin/fetch"
          className="mt-4 inline-flex rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400"
        >
          Open fetch page →
        </Link>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Manage listings</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Existing jobs</h2>
            {pendingCount > 0 ? (
              <p className="mt-2 text-sm font-medium text-blue-700">{pendingCount} pending employer submission(s)</p>
            ) : null}
          </div>
          <div className="flex w-full max-w-lg flex-col gap-2 sm:flex-row">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending review only</option>
            </select>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search title, company, slug..."
              className="h-11 flex-1 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
          </div>
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
            <h3 className="text-lg font-bold text-slate-900">No jobs match this filter.</h3>
            <p className="mt-2 text-sm text-slate-600">Try a different search or status filter.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredJobs.map((job) => {
              const isBusy = busyJobId === job.id;
              const isPending = job.status === 'pending';

              return (
                <article
                  key={job.id}
                  className={`rounded-3xl border p-5 ${isPending ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-slate-50/70'}`}
                >
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
                        {job.created_by ? (
                          <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                            Employer submitted
                          </span>
                        ) : null}
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
                      {job.rejection_reason ? (
                        <p className="mt-2 text-xs text-rose-600">Rejection note: {job.rejection_reason}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/jobs/${job.id}/edit`)}
                        className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      {isPending ? (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleApprove(job.id)}
                            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setRejectingJob(job);
                              setRejectReason('');
                            }}
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleStatusChange(job.id, job.status === 'published' ? 'draft' : 'published')}
                          className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {job.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleFeaturedToggle(job)}
                        className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {job.is_featured ? 'Unfeature' : 'Feature'}
                      </button>
                      {!isPending ? (
                        <button
                          type="button"
                          disabled={isBusy || job.status === 'archived'}
                          onClick={() => handleStatusChange(job.id, 'archived')}
                          className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {rejectingJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950">Reject submission</h3>
            <p className="mt-2 text-sm text-slate-600">{rejectingJob.title}</p>
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-slate-700">Reason (optional)</span>
              <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                rows={3}
                placeholder="Tell the employer why this was not approved."
              />
            </label>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyJobId === rejectingJob.id}
                onClick={handleReject}
                className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                Confirm reject
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectingJob(null);
                  setRejectReason('');
                }}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
