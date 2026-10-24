import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/LoadingSpinner';
import EmployerRoute from '../components/employer/EmployerRoute';
import EmployerShell from '../components/employer/EmployerShell';
import ApplicationExportDialog from '../components/jobApplications/ApplicationExportDialog';
import JobApplicationCard from '../components/jobApplications/JobApplicationCard';
import JobApplicationTable from '../components/jobApplications/JobApplicationTable';
import { normalizeApplicationStatus } from '../lib/applicationStatus';
import {
  QUALIFICATION_CATEGORIES,
  getQualificationBucket,
  extractApplicationFilterOptions,
} from '../lib/applicationFilters';
import {
  fetchJobCandidates,
  updateApplicationStatus,
} from '../services/jobApplications';
import {
  fetchJobSuitableProfiles,
  updateSuitableProfileStage,
} from '../services/jobSuitableProfiles';
import { fetchMyJobById, fetchMyJobs } from '../services/employerJobs';
import { getJobDetailPath } from '../lib/jobRoutes';

const APPLICANT_FUNNEL_STAGES = [
  { id: 'all', label: 'All Candidates' },
  { id: 'applied', label: 'Applied' },
  { id: 'viewed', label: 'Viewed' },
  { id: 'screened', label: 'Shortlisted' },
  { id: 'interview_scheduled', label: 'Interview Scheduled' },
  { id: 'processing', label: 'Processing' },
  { id: 'hired', label: 'Hired' },
  { id: 'rejected', label: 'Rejected' },
];

const SUITABLE_FUNNEL_STAGES = [
  { id: 'all', label: 'All Suitable Profiles' },
  { id: 'suitable', label: '🌟 Suitable / New' },
  { id: 'contacted', label: '📞 Contacted' },
  { id: 'screened', label: '✓ Shortlisted' },
  { id: 'interview_scheduled', label: '📅 Interview Scheduled' },
  { id: 'processing', label: 'Processing' },
  { id: 'hired', label: '★ Hired' },
  { id: 'rejected', label: '✕ Rejected' },
];

const ExcelIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
  </svg>
);

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 text-slate-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const RefreshIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

function EmployerJobApplicationsContent() {
  const { jobId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(urlTab === 'suitable' ? 'suitable' : 'applicants');
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [suitableProfiles, setSuitableProfiles] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasResumeOnly, setHasResumeOnly] = useState(false);
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [qualificationFilter, setQualificationFilter] = useState('all');
  const [passoutYearFilter, setPassoutYearFilter] = useState('all');
  const [isStarredOnly, setIsStarredOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  // Sync tab with URL if user navigates back/forward
  useEffect(() => {
    if (urlTab === 'suitable' && activeTab !== 'suitable') {
      setActiveTab('suitable');
      setStatusFilter('all');
    } else if (urlTab === 'applicants' && activeTab !== 'applicants') {
      setActiveTab('applicants');
      setStatusFilter('all');
    }
  }, [urlTab, activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setStatusFilter('all');
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === 'suitable') {
          next.set('tab', 'suitable');
        } else {
          next.delete('tab');
        }
        return next;
      },
      { replace: true },
    );
  };

  const loadData = useCallback(async (ignoreFlag = false) => {
    try {
      const [jobs, rows, suitable] = await Promise.all([
        fetchMyJobs(),
        fetchJobCandidates(jobId),
        fetchJobSuitableProfiles(jobId),
      ]);
      let matchedJob = jobs.find((row) => row.id === jobId) || null;
      if (!matchedJob && jobId) {
        try {
          matchedJob = await fetchMyJobById(jobId);
        } catch {
          // fallback
        }
      }

      if (!ignoreFlag) {
        setJob(matchedJob);
        setApplications(rows);
        setSuitableProfiles(suitable);
        setError('');

        // If no direct applications but suitable profiles exist, auto-suggest suitable tab
        if (rows.length === 0 && suitable.length > 0 && !searchParams.has('tab')) {
          setActiveTab('suitable');
        }
      }
    } catch (loadError) {
      if (!ignoreFlag) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load applications.');
      }
    } finally {
      if (!ignoreFlag) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [jobId, searchParams]);

  useEffect(() => {
    let ignore = false;
    loadData(ignore);
    return () => {
      ignore = true;
    };
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData(false);
  };

  // Target candidate list based on active tab
  const activeCandidates = activeTab === 'suitable' ? suitableProfiles : applications;

  // Funnel stage counts for currently active tab
  const stageCounts = useMemo(() => {
    const counts = {
      all: activeCandidates.length,
      applied: 0,
      suitable: 0,
      contacted: 0,
      viewed: 0,
      screened: 0,
      interview_scheduled: 0,
      processing: 0,
      hired: 0,
      rejected: 0,
      withResume: 0,
      withPhone: 0,
      starred: 0,
    };

    for (const item of activeCandidates) {
      const s = normalizeApplicationStatus(item.status);
      if (s === 'applied' || s === 'external_click') counts.applied += 1;
      else if (s === 'suitable') counts.suitable += 1;
      else if (s === 'contacted') counts.contacted += 1;
      else if (s === 'viewed') counts.viewed += 1;
      else if (s === 'screened') counts.screened += 1;
      else if (s === 'interview_scheduled') counts.interview_scheduled += 1;
      else if (s === 'processing') counts.processing += 1;
      else if (s === 'hired' || s === 'joined') counts.hired += 1;
      else if (s === 'rejected') counts.rejected += 1;

      if (item.resumePath) counts.withResume += 1;
      if (item.profileSnapshot?.phone) counts.withPhone += 1;
      if (
        item.isStarred ||
        item.profileSnapshot?.is_starred ||
        item.profileSnapshot?.isStarred ||
        (item.isSuitableProfile && Boolean(item.adminNotes))
      ) {
        counts.starred += 1;
      }
    }

    return counts;
  }, [activeCandidates]);

  const filterOptions = useMemo(
    () => extractApplicationFilterOptions(activeCandidates),
    [activeCandidates],
  );

  // Filtered and sorted candidate list
  const filteredCandidates = useMemo(() => {
    let list = activeCandidates;

    // 1. Stage filter
    if (statusFilter !== 'all') {
      list = list.filter((item) => {
        const s = normalizeApplicationStatus(item.status);
        if (statusFilter === 'applied') {
          return s === 'applied' || s === 'external_click';
        }
        return s === statusFilter;
      });
    }

    // 2. Resume only filter
    if (hasResumeOnly) {
      list = list.filter((item) => Boolean(item.resumePath));
    }

    // 3. Phone only filter
    if (hasPhoneOnly) {
      list = list.filter((item) => Boolean(item.profileSnapshot?.phone));
    }

    // 4. Starred / Recommended only filter
    if (isStarredOnly) {
      list = list.filter((item) =>
        Boolean(
          item.isStarred ||
            item.profileSnapshot?.is_starred ||
            item.profileSnapshot?.isStarred ||
            (item.isSuitableProfile && Boolean(item.adminNotes))
        )
      );
    }

    // 5. Qualification filter
    if (qualificationFilter !== 'all') {
      list = list.filter((item) => {
        const degree = item.profileSnapshot?.degree || '';
        const bucket = getQualificationBucket(degree);
        return (
          bucket === qualificationFilter.toLowerCase() ||
          degree.toLowerCase().includes(qualificationFilter.toLowerCase())
        );
      });
    }

    // 6. Passout Year filter
    if (passoutYearFilter !== 'all') {
      list = list.filter((item) => {
        const yr = String(item.profileSnapshot?.graduationYear || '').trim();
        return yr === String(passoutYearFilter).trim();
      });
    }

    // 7. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        const snap = item.profileSnapshot || {};
        const name = (snap.fullName || '').toLowerCase();
        const phone = (snap.phone || '').toLowerCase();
        const email = (snap.contactEmail || '').toLowerCase();
        const college = (snap.college || '').toLowerCase();
        const degree = (snap.degree || '').toLowerCase();
        const branch = (snap.branch || '').toLowerCase();
        const skills = Array.isArray(snap.skills) ? snap.skills.join(' ').toLowerCase() : '';
        const adminNotes = (item.adminNotes || '').toLowerCase();
        return (
          name.includes(q) ||
          phone.includes(q) ||
          email.includes(q) ||
          college.includes(q) ||
          degree.includes(q) ||
          branch.includes(q) ||
          skills.includes(q) ||
          adminNotes.includes(q)
        );
      });
    }

    // 8. Sorting
    return [...list].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.submittedAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.submittedAt || 0).getTime();

      if (sortBy === 'oldest') {
        return timeA - timeB;
      }
      if (sortBy === 'starred_first') {
        const starA = Boolean(
          a.isStarred ||
            a.profileSnapshot?.is_starred ||
            (a.isSuitableProfile && a.adminNotes)
        );
        const starB = Boolean(
          b.isStarred ||
            b.profileSnapshot?.is_starred ||
            (b.isSuitableProfile && b.adminNotes)
        );
        if (starA !== starB) return starA ? -1 : 1;
        return timeB - timeA;
      }
      if (sortBy === 'name_asc') {
        const nameA = (a.profileSnapshot?.fullName || '').toLowerCase();
        const nameB = (b.profileSnapshot?.fullName || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'has_resume') {
        const hasA = Boolean(a.resumePath);
        const hasB = Boolean(b.resumePath);
        if (hasA !== hasB) return hasA ? -1 : 1;
        return timeB - timeA;
      }
      return timeB - timeA;
    });
  }, [
    activeCandidates,
    statusFilter,
    hasResumeOnly,
    hasPhoneOnly,
    isStarredOnly,
    qualificationFilter,
    passoutYearFilter,
    searchQuery,
    sortBy,
  ]);

  const handleStatusChange = async (targetId, nextStatus, meta = {}) => {
    const isSuitable = meta.isSuitableProfile || activeTab === 'suitable';

    if (isSuitable) {
      const updated = await updateSuitableProfileStage({
        profileId: targetId,
        status: nextStatus,
        jobId: meta.jobId || jobId,
        studentUserId: meta.studentUserId,
      });

      setSuitableProfiles((current) =>
        current.map((row) => {
          if (
            row.id === targetId ||
            (updated && row.id === updated.id) ||
            (updated && row.studentUserId && row.studentUserId === updated.studentUserId)
          ) {
            return {
              ...row,
              ...updated,
              status: updated?.status || nextStatus,
              id: updated?.id || row.id,
              isSuitableProfile: true,
            };
          }
          return row;
        }),
      );
      return;
    }

    const updated = await updateApplicationStatus({
      applicationId: targetId,
      status: nextStatus,
      jobId: meta.jobId || jobId,
      studentUserId: meta.studentUserId,
    });

    setApplications((current) =>
      current.map((row) => {
        if (
          row.id === targetId ||
          (updated && row.id === updated.id) ||
          (updated && row.studentUserId && row.studentUserId === updated.studentUserId)
        ) {
          return {
            ...row,
            ...updated,
            status: updated?.status || nextStatus,
            id: updated?.id || row.id,
          };
        }
        return row;
      }),
    );
  };

  const handleApplicationUpdate = (updated) => {
    if (!updated) return;
    if (updated.isSuitableProfile || activeTab === 'suitable') {
      setSuitableProfiles((current) =>
        current.map((row) => {
          if (
            row.id === updated.id ||
            (row.studentUserId && row.studentUserId === updated.studentUserId)
          ) {
            return { ...row, ...updated, isSuitableProfile: true };
          }
          return row;
        }),
      );
      return;
    }

    setApplications((current) =>
      current.map((row) => {
        if (
          row.id === updated.id ||
          (row.studentUserId && row.studentUserId === updated.studentUserId)
        ) {
          return { ...row, ...updated };
        }
        return row;
      }),
    );
  };

  const publicJobPath = job ? getJobDetailPath(job) : null;
  const isAnyFilterActive =
    statusFilter !== 'all' ||
    hasResumeOnly ||
    hasPhoneOnly ||
    isStarredOnly ||
    qualificationFilter !== 'all' ||
    passoutYearFilter !== 'all' ||
    sortBy !== 'newest' ||
    searchQuery.trim() !== '';

  const clearAllFilters = () => {
    setStatusFilter('all');
    setHasResumeOnly(false);
    setHasPhoneOnly(false);
    setIsStarredOnly(false);
    setQualificationFilter('all');
    setPassoutYearFilter('all');
    setSortBy('newest');
    setSearchQuery('');
  };

  const funnelStages =
    activeTab === 'suitable' ? SUITABLE_FUNNEL_STAGES : APPLICANT_FUNNEL_STAGES;

  return (
    <EmployerShell
      title="Candidate Pipeline"
      description={job ? `${job.title} · ${job.company}` : 'Recruitment pipeline and candidates.'}
    >
      <SEO
        title={job ? `${job.title} Candidates | Vizag Jobs Recruiter` : 'Job Candidates | Vizag Jobs'}
        canonical={`/employer/jobs/${jobId}/applications`}
      />

      {/* Top Breadcrumb & Actions Bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2 text-sm">
          <Link
            to="/employer/jobs"
            className="inline-flex min-h-11 shrink-0 items-center font-bold text-slate-600 transition hover:text-cyan-700"
          >
            ← My Jobs
          </Link>
          <span className="text-slate-300">/</span>
          <span className="min-w-0 self-center font-semibold text-slate-900 [overflow-wrap:anywhere]">
            {job?.title || 'Candidates'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {publicJobPath ? (
            <Link
              to={publicJobPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50"
            >
              <span>View Job Post</span>
              <ExternalLinkIcon />
            </Link>
          ) : null}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            title="Refresh candidates list"
          >
            <RefreshIcon />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>

          {!isLoading && filteredCandidates.length > 0 ? (
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-1.5 rounded-2xl bg-cyan-500 px-4 py-2 text-xs font-black text-slate-950 shadow-2xs transition hover:bg-cyan-400"
            >
              <ExcelIcon />
              <span>Download Excel ({filteredCandidates.length})</span>
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Job Hero & Summary Stat Badges */}
      {job ? (
        <div className="mb-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/70 p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  {job.title}
                </h1>
                <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
                  {job.status === 'published' ? 'Active & Receiving Candidates' : job.status}
                </span>
              </div>
              <p className="mt-1 text-base font-semibold text-slate-700">{job.company}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                {job.location ? (
                  <span className="flex items-center gap-1 font-medium text-slate-600">
                    📍 {job.location}
                  </span>
                ) : null}
                {job.employment_type ? (
                  <span className="flex items-center gap-1 font-medium text-slate-600">
                    💼 {job.employment_type}
                  </span>
                ) : null}
                {job.salary ? (
                  <span className="flex items-center gap-1 font-medium text-slate-600">
                    💰 {job.salary}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Quick Stat Chips */}
            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-2.5 text-center">
                <div className="text-xl font-black text-cyan-900">{applications.length}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">Applicants</div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-center">
                <div className="text-xl font-black text-amber-950">{suitableProfiles.length}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">🌟 Suitable</div>
              </div>
              <div className="rounded-2xl border border-purple-100 bg-purple-50/70 px-4 py-2.5 text-center">
                <div className="text-xl font-black text-purple-900">
                  {stageCounts.screened + stageCounts.interview_scheduled}
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Shortlisted</div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-2.5 text-center">
                <div className="text-xl font-black text-emerald-900">{stageCounts.hired}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Hired</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Tabs: Direct Applicants vs Admin-Curated Suitable Profiles */}
      <div className="mb-6 border-b border-slate-200">
        <div className="flex gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => handleTabChange('applicants')}
            className={`flex min-h-12 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
              activeTab === 'applicants'
                ? 'border-cyan-600 text-cyan-950'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>📥 Direct Applicants</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-black ${
                activeTab === 'applicants'
                  ? 'bg-cyan-100 text-cyan-900'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {applications.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('suitable')}
            className={`flex min-h-12 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
              activeTab === 'suitable'
                ? 'border-amber-500 text-amber-950'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>🌟 Suitable Profiles</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-black ${
                activeTab === 'suitable'
                  ? 'bg-amber-100 text-amber-950 ring-1 ring-amber-300'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {suitableProfiles.length}
            </span>
          </button>
        </div>
      </div>

      {/* Suitable Profiles Info Banner */}
      {activeTab === 'suitable' ? (
        <div className="mb-6 rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/60 p-4 sm:p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">🌟</span>
            <div>
              <h2 className="text-base font-bold text-amber-950">
                Admin-Curated Suitable Profiles ({suitableProfiles.length})
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-amber-900/90 leading-relaxed">
                These candidates were filtered and recommended directly by the Vizag Jobs admin team based on your required qualifications, skills, passout year, and desired role. Direct contact (Call/WhatsApp) and candidate resumes are available below.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Recruiter Pipeline Stage Funnel Bar */}
      {!isLoading && activeCandidates.length > 0 ? (
        <div className="mb-6 -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="flex min-w-max items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xs">
            {funnelStages.map((stage) => {
              const count = stageCounts[stage.id] ?? 0;
              const isActive = statusFilter === stage.id;

              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setStatusFilter(stage.id)}
                  className={`flex min-h-11 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{stage.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Smart Search & Filter Toolbar */}
      {!isLoading && activeCandidates.length > 0 ? (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          {/* Live Search input */}
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by candidate name, phone, email, college, branch, or skills..."
              aria-label="Search candidates"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-14 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100 sm:text-sm"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-1 flex min-w-11 items-center justify-center text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            ) : null}
          </div>

          {/* Quick Filters, Sorter & View Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Starred / Admin Recommended Toggle */}
            <button
              type="button"
              onClick={() => setIsStarredOnly(!isStarredOnly)}
              className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
                isStarredOnly
                  ? 'border border-amber-300 bg-amber-500 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              title="Show candidates recommended or referred by platform admin"
            >
              <span>⭐</span>
              <span>Recommended ({stageCounts.starred})</span>
            </button>

            {/* Has Resume Filter Toggle */}
            <button
              type="button"
              onClick={() => setHasResumeOnly(!hasResumeOnly)}
              className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-xs font-bold transition ${
                hasResumeOnly
                  ? 'border border-cyan-400 bg-cyan-50 text-cyan-900'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              📄 Has Resume ({stageCounts.withResume})
            </button>

            {/* Has Phone Filter Toggle */}
            <button
              type="button"
              onClick={() => setHasPhoneOnly(!hasPhoneOnly)}
              className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-xs font-bold transition ${
                hasPhoneOnly
                  ? 'border border-emerald-400 bg-emerald-50 text-emerald-900'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              📞 Has Phone ({stageCounts.withPhone})
            </button>

            {/* Qualification Filter */}
            <select
              value={qualificationFilter}
              onChange={(e) => setQualificationFilter(e.target.value)}
              aria-label="Filter candidates by qualification"
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-bold text-slate-700 shadow-2xs outline-none focus:border-cyan-400 sm:text-sm"
            >
              {QUALIFICATION_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>

            {/* Passout Year Filter */}
            {filterOptions.availableYears.length > 0 ? (
              <select
                value={passoutYearFilter}
                onChange={(e) => setPassoutYearFilter(e.target.value)}
                aria-label="Filter candidates by passout year"
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-bold text-slate-700 shadow-2xs outline-none focus:border-cyan-400 sm:text-sm"
              >
                <option value="all">All Passout Years</option>
                {filterOptions.availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Class of {yr}
                  </option>
                ))}
              </select>
            ) : null}

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-bold text-slate-700 shadow-2xs outline-none focus:border-cyan-400 sm:text-sm"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Earliest applied (Early register)</option>
              <option value="starred_first">⭐ Recommended first</option>
              <option value="name_asc">Name (A–Z)</option>
              <option value="has_resume">Has Resume first</option>
            </select>

            {/* View Mode Switcher (Cards vs Table) */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex min-h-11 items-center rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  viewMode === 'cards' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Detailed Card View"
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex min-h-11 items-center rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="High-Density Table View"
              >
                Table
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Showing Count / Reset Filters Info */}
      {!isLoading && activeCandidates.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-600">
          <div>
            Showing <span className="font-black text-slate-950">{filteredCandidates.length}</span> of{' '}
            <span className="font-black text-slate-950">{activeCandidates.length}</span>{' '}
            {activeTab === 'suitable' ? 'suitable profiles' : 'candidates'}
            {isAnyFilterActive ? ' (filtered)' : ''}
          </div>
          {isAnyFilterActive ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex min-h-11 items-center font-bold text-cyan-700 hover:text-cyan-800 hover:underline"
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      ) : null}

      {isLoading ? <LoadingSpinner message="Loading candidate applications..." /> : null}

      {/* Empty State: Zero Applications on Job */}
      {!isLoading && activeTab === 'applicants' && applications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 sm:p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-2xl">
            👥
          </div>
          <h3 className="mt-4 text-xl font-bold text-slate-950">No direct applications yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Once job seekers apply on Vizag Jobs or click your application link, candidate profiles,
            resumes, and contact numbers will appear here automatically.
          </p>
          {suitableProfiles.length > 0 ? (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => handleTabChange('suitable')}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-950 transition hover:bg-amber-100"
              >
                <span>View {suitableProfiles.length} Suitable Profiles</span>
                <span>🌟</span>
              </button>
            </div>
          ) : null}
          {publicJobPath ? (
            <div className="mt-4">
              <Link
                to={publicJobPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
              >
                <span>Preview Your Job Listing</span>
                <ExternalLinkIcon />
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Empty State: Zero Suitable Profiles on Job */}
      {!isLoading && activeTab === 'suitable' && suitableProfiles.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-amber-300 bg-amber-50/40 p-6 sm:p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
            🌟
          </div>
          <h3 className="mt-4 text-xl font-bold text-amber-950">No suitable profiles assigned yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-amber-900/80">
            Our team reviews active vacancies and assigns verified candidates matching your skills,
            qualifications, and target role directly to this list.
          </p>
          {applications.length > 0 ? (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => handleTabChange('applicants')}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                <span>View {applications.length} Direct Applicants</span>
                <span>📥</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Empty State: Filters yielded 0 results */}
      {!isLoading && activeCandidates.length > 0 && filteredCandidates.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 sm:p-10 text-center shadow-xs">
          <h3 className="text-lg font-bold text-slate-900">No candidates match your current filter</h3>
          <p className="mt-2 text-sm text-slate-600">
            Try choosing a different stage, clearing your search keywords, or resetting filters.
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="mt-5 inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
          >
            Show All ({activeCandidates.length})
          </button>
        </div>
      ) : null}

      {/* Candidate Display: Table View */}
      {!isLoading && filteredCandidates.length > 0 && viewMode === 'table' ? (
        <JobApplicationTable
          applications={filteredCandidates}
          onStatusChange={handleStatusChange}
          job={job}
          onSelectCandidate={() => setViewMode('cards')}
        />
      ) : null}

      {/* Candidate Display: Detailed Card View */}
      {!isLoading && filteredCandidates.length > 0 && viewMode === 'cards' ? (
        <div className="space-y-4">
          {filteredCandidates.map((candidate) => (
            <JobApplicationCard
              key={candidate.id}
              application={candidate}
              onStatusChange={handleStatusChange}
              onApplicationUpdate={handleApplicationUpdate}
              job={job}
            />
          ))}
        </div>
      ) : null}

      <ApplicationExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        applications={filteredCandidates}
        job={job}
      />
    </EmployerShell>
  );
}

export default function EmployerJobApplicationsPage() {
  return (
    <EmployerRoute>
      <EmployerJobApplicationsContent />
    </EmployerRoute>
  );
}
