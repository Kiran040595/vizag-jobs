import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminShell from '../components/admin/AdminShell';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  approveAdminJob,
  assignJobsToEmployer,
  fetchAdminCreatedJobs,
  fetchEmployerSubmittedJobs,
  isExternalFetchSourceName,
  moveJobsToAdmin,
  rejectAdminJob,
  toggleAdminJobFeatured,
  updateAdminJobStatus,
} from '../services/adminJobs';
import { fetchAdminEmployerProfiles } from '../services/adminEmployers';
import { fetchJobApplicationCounts } from '../services/jobApplications';

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

export default function AdminJobsPage({ scope = 'employer' }) {
  const isAdminScope = scope === 'admin';
  const jobsListPath = isAdminScope ? '/admin/admin-jobs' : '/admin/jobs';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  useAdminAuth();
  const [jobs, setJobs] = useState([]);
  const [employers, setEmployers] = useState([]);
  const [applicationCounts, setApplicationCounts] = useState({});
  const [selectedJobIds, setSelectedJobIds] = useState(() => new Set());
  const [assignEmployerId, setAssignEmployerId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyJobId, setBusyJobId] = useState('');
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'all');
  const [rejectingJob, setRejectingJob] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    let ignore = false;

    const loadJobs = async () => {
      try {
        const [data, employerRows] = await Promise.all([
          isAdminScope ? fetchAdminCreatedJobs() : fetchEmployerSubmittedJobs(),
          fetchAdminEmployerProfiles(),
        ]);
        const internalPublishedIds = data
          .filter((job) => job.status === 'published' && job.apply_mode === 'internal')
          .map((job) => job.id);
        const counts = await fetchJobApplicationCounts(internalPublishedIds);
        if (ignore) {
          return;
        }

        setJobs(sortJobs(data));
        setEmployers(employerRows.filter((row) => row.isActive));
        setApplicationCounts(counts);
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
  }, [isAdminScope]);

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
  const selectedCount = selectedJobIds.size;

  const employerLabelById = useMemo(() => {
    const map = new Map();
    for (const employer of employers) {
      map.set(employer.userId, employer.companyName || employer.contactEmail || employer.userId);
    }
    return map;
  }, [employers]);

  const toggleJobSelected = (jobId) => {
    setSelectedJobIds((current) => {
      const next = new Set(current);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const toggleSelectFiltered = () => {
    const filteredIds = filteredJobs.map((job) => job.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedJobIds.has(id));
    setSelectedJobIds((current) => {
      const next = new Set(current);
      if (allSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  };

  const handleAssignSelected = async () => {
    if (selectedCount === 0 || !assignEmployerId) {
      setLoadError('Select jobs and an employer before assigning.');
      return;
    }

    setIsAssigning(true);
    setLoadError('');
    setNotice('');

    try {
      const updatedJobs = await assignJobsToEmployer({
        jobIds: [...selectedJobIds],
        employerUserId: assignEmployerId,
      });
      const employerName =
        employerLabelById.get(assignEmployerId) || 'the selected employer';

      if (isAdminScope) {
        // Assigned jobs leave the admin-created list (they now have created_by).
        const assignedIds = new Set(updatedJobs.map((job) => job.id));
        setJobs((current) => current.filter((job) => !assignedIds.has(job.id)));
      } else {
        setJobs((current) => {
          let next = current;
          for (const updated of updatedJobs) {
            next = upsertJob(next, updated);
          }
          return next;
        });
      }

      setSelectedJobIds(new Set());
      setAssignEmployerId('');
      setNotice(
        `Assigned ${updatedJobs.length} job${updatedJobs.length === 1 ? '' : 's'} to ${employerName}.`,
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not assign jobs.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleMoveSelectedToAdmin = async () => {
    if (selectedCount === 0) {
      setLoadError('Select at least one job to move to admin.');
      return;
    }

    setIsAssigning(true);
    setLoadError('');
    setNotice('');

    try {
      const updatedJobs = await moveJobsToAdmin({ jobIds: [...selectedJobIds] });
      const movedIds = new Set(updatedJobs.map((job) => job.id));

      if (!isAdminScope) {
        // Unassigned jobs leave the employer submissions list.
        setJobs((current) => current.filter((job) => !movedIds.has(job.id)));
      } else {
        setJobs((current) => {
          let next = current;
          for (const updated of updatedJobs) {
            next = upsertJob(next, updated);
          }
          return next;
        });
      }

      setSelectedJobIds(new Set());
      setAssignEmployerId('');
      setNotice(
        `Moved ${updatedJobs.length} job${updatedJobs.length === 1 ? '' : 's'} back to admin ownership.`,
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not move jobs to admin.');
    } finally {
      setIsAssigning(false);
    }
  };

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
      title={isAdminScope ? 'Admin jobs' : 'Employer submissions'}
      description={
        isAdminScope
          ? 'Manage jobs you posted manually from the admin form. Assign them to employers, or take jobs back under admin ownership.'
          : 'Review employer submissions, approve jobs, assign ownership, or move jobs back to admin.'
      }
    >
      <SEO
        title={isAdminScope ? 'Admin Jobs | Vizag Jobs Admin' : 'Employer Submissions | Vizag Jobs Admin'}
        description={
          isAdminScope
            ? 'Manage admin-created Vizag Jobs listings.'
            : 'Review employer-submitted Vizag Jobs listings.'
        }
        canonical={jobsListPath}
      />

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              {isAdminScope ? 'Admin listings' : 'Employer listings'}
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {isAdminScope ? 'Admin jobs' : 'Employer submissions'}
            </h2>
            {!isAdminScope && pendingCount > 0 ? (
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
              {!isAdminScope ? <option value="pending">Pending review only</option> : null}
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

        {!isLoading && filteredJobs.length > 0 ? (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={
                  filteredJobs.length > 0 && filteredJobs.every((job) => selectedJobIds.has(job.id))
                }
                onChange={toggleSelectFiltered}
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
              />
              Select filtered ({selectedCount} selected)
            </label>
            <label className="block min-w-[14rem] flex-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assign to employer
              </span>
              <select
                value={assignEmployerId}
                onChange={(event) => setAssignEmployerId(event.target.value)}
                className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              >
                <option value="">Choose employer…</option>
                {employers.map((employer) => (
                  <option key={employer.userId} value={employer.userId}>
                    {employer.companyName}
                    {employer.contactEmail ? ` · ${employer.contactEmail}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={isAssigning || selectedCount === 0 || !assignEmployerId}
              onClick={handleAssignSelected}
              className="h-11 rounded-2xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAssigning ? 'Working…' : `Assign to employer`}
            </button>
            <button
              type="button"
              disabled={isAssigning || selectedCount === 0}
              onClick={handleMoveSelectedToAdmin}
              className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Move to admin
            </button>
          </div>
        ) : null}

        {loadError ? (
          <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</p>
        ) : null}

        {notice ? (
          <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>
        ) : null}

        {isLoading ? (
          <div className="mt-8">
            <LoadingSpinner message={isAdminScope ? 'Loading admin jobs...' : 'Loading employer submissions...'} />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <h3 className="text-lg font-bold text-slate-900">No jobs match this filter.</h3>
            <p className="mt-2 text-sm text-slate-600">
              {isAdminScope
                ? 'Create a new job from New Job to get started. External fetch jobs stay on Fetch external jobs.'
                : 'Try a different search or status filter.'}
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredJobs.map((job) => {
              const isBusy = busyJobId === job.id;
              const isPending = job.status === 'pending';
              const isSelected = selectedJobIds.has(job.id);
              const ownerLabel = job.created_by ? employerLabelById.get(job.created_by) : '';

              return (
                <article
                  key={job.id}
                  className={`rounded-3xl border p-5 ${
                    isSelected
                      ? 'border-violet-300 bg-violet-50/40'
                      : isPending
                        ? 'border-blue-200 bg-blue-50/50'
                        : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleJobSelected(job.id)}
                        className="mt-1.5 h-4 w-4 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
                        aria-label={`Select ${job.title}`}
                      />
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
                              {ownerLabel ? `Owner: ${ownerLabel}` : 'Employer submitted'}
                            </span>
                          ) : isExternalFetchSourceName(job.source_name) ? (
                            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
                              External fetch
                            </span>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                              Admin created
                            </span>
                          )}
                          {job.is_featured ? (
                            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                              Featured
                            </span>
                          ) : null}
                          {job.apply_mode === 'internal' ? (
                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold uppercase text-indigo-700">
                              On-platform apply
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
                        {job.status === 'published' && job.apply_mode === 'internal' ? (
                          <p className="mt-2 text-sm font-semibold text-indigo-700">
                            {applicationCounts[job.id] || 0} application
                            {(applicationCounts[job.id] || 0) === 1 ? '' : 's'}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {job.status === 'published' && job.apply_mode === 'internal' ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/jobs/${job.id}/applications`)}
                          className="rounded-2xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                        >
                          Applications ({applicationCounts[job.id] || 0})
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/jobs/${job.id}/edit`)}
                        className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      {isPending && !isAdminScope ? (
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
                      {!isPending || isAdminScope ? (
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
