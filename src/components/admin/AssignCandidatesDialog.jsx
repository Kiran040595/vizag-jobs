import { useEffect, useMemo, useState } from 'react';
import { useNativeModal } from '../../hooks/useNativeModal';
import { assignCandidatesToJob } from '../../services/jobSuitableProfiles';
import { fetchAllCompanyJobsForAssignment } from '../../services/adminJobs';

export default function AssignCandidatesDialog({
  open,
  onClose,
  candidates = [],
  jobs = [],
  defaultJobId = '',
  onAssigned,
}) {
  const [includeExternal, setIncludeExternal] = useState(false);
  const [internalJobs, setInternalJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedJobId, setSelectedJobId] = useState(defaultJobId || '');
  const [companySearch, setCompanySearch] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [assignQuantity, setAssignQuantity] = useState('all');
  const [customCount, setCustomCount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useNativeModal(open && candidates.length > 0);

  // Load active company jobs (by default, admin-created or employer-created only)
  useEffect(() => {
    if (!open) return;
    if (!includeExternal && jobs && jobs.length > 0) {
      setInternalJobs(jobs);
      return;
    }
    let active = true;
    setIsLoadingJobs(true);
    fetchAllCompanyJobsForAssignment({ includeExternal })
      .then((rows) => {
        if (active) setInternalJobs(rows);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load company vacancies.');
      })
      .finally(() => {
        if (active) setIsLoadingJobs(false);
      });
    return () => {
      active = false;
    };
  }, [open, jobs, includeExternal]);

  const effectiveJobs = useMemo(() => {
    if (internalJobs.length > 0) return internalJobs;
    return jobs && jobs.length > 0 ? jobs : [];
  }, [jobs, internalJobs]);

  // Group jobs by company name
  const companyMap = useMemo(() => {
    const map = new Map();
    for (const job of effectiveJobs) {
      const companyName = (job.company || 'Unknown Company').trim();
      if (!map.has(companyName)) {
        map.set(companyName, []);
      }
      map.get(companyName).push(job);
    }
    return map;
  }, [effectiveJobs]);

  // Sorted alphabetical list of companies with vacancy counts
  const companyList = useMemo(() => {
    const list = Array.from(companyMap.entries()).map(([name, companyJobs]) => ({
      name,
      jobCount: companyJobs.length,
      jobs: companyJobs,
    }));
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return list;
  }, [companyMap]);

  // Handle default job ID if provided
  useEffect(() => {
    if (!open) return;
    if (defaultJobId && effectiveJobs.length > 0) {
      const defaultJob = effectiveJobs.find((j) => j.id === defaultJobId);
      if (defaultJob) {
        setSelectedCompany((defaultJob.company || '').trim());
        setSelectedJobId(defaultJob.id);
        return;
      }
    }
  }, [open, defaultJobId, effectiveJobs]);

  // Filtered companies based on instant search
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companyList;
    const q = companySearch.toLowerCase().trim();
    return companyList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.jobs.some((j) => (j.title || '').toLowerCase().includes(q)),
    );
  }, [companyList, companySearch]);

  // Jobs available for the selected company
  const availableCompanyJobs = useMemo(() => {
    if (!selectedCompany) return [];
    return companyMap.get(selectedCompany) || [];
  }, [companyMap, selectedCompany]);

  // When selected company changes, auto-select job or maintain valid selection
  const handleCompanyChange = (companyName) => {
    setSelectedCompany(companyName);
    setError('');
    const compJobs = companyMap.get(companyName) || [];
    if (compJobs.length === 1) {
      setSelectedJobId(compJobs[0].id);
    } else {
      setSelectedJobId('');
    }
  };

  // Determine effective count of candidates to assign
  const totalAvailable = candidates.length;
  const effectiveCount = useMemo(() => {
    if (assignQuantity === 'all') return totalAvailable;
    if (assignQuantity === 'custom') {
      const parsed = parseInt(customCount, 10);
      if (isNaN(parsed) || parsed < 1) return Math.min(totalAvailable, 50);
      return Math.min(totalAvailable, parsed);
    }
    const num = Number(assignQuantity);
    return Math.min(totalAvailable, isNaN(num) ? totalAvailable : num);
  }, [assignQuantity, customCount, totalAvailable]);

  const effectiveCandidates = useMemo(() => {
    return candidates.slice(0, effectiveCount);
  }, [candidates, effectiveCount]);

  if (!open || candidates.length === 0) {
    return null;
  }

  const selectedJob = effectiveJobs.find((job) => job.id === selectedJobId) || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCompany) {
      setError('Please choose a target company first.');
      return;
    }
    if (!selectedJobId) {
      setError('Please choose a vacancy of the selected company.');
      return;
    }
    if (effectiveCandidates.length === 0) {
      setError('No candidates selected to assign.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const candidateUserIds = effectiveCandidates
        .map((c) => c.userId || c.user_id)
        .filter(Boolean);

      const result = await assignCandidatesToJob({
        jobId: selectedJobId,
        candidateUserIds,
        adminNotes,
        candidateProfiles: effectiveCandidates,
      });

      if (onAssigned) {
        onAssigned({
          count: result.count,
          jobTitle: selectedJob?.title || 'Selected Job',
          company: selectedJob?.company || selectedCompany,
        });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign candidates to job.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/50"
    >
      <div className="flex max-h-[90vh] flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 bg-amber-50/70 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-xl text-slate-950 shadow-xs">
              🌟
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-950 sm:text-xl">
                Assign Candidates as Suitable Profiles
              </h2>
              <p className="mt-0.5 text-xs text-amber-900/80 sm:text-sm">
                Targeted matching: assign candidates directly to an Admin or Employer vacancy as Suitable Profiles.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-white hover:text-slate-700"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto p-5 sm:p-6">
          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          {/* Candidate Count & Quantity Selector */}
          <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-indigo-950">
                Candidates to Assign:
              </span>
              <span className="rounded-full bg-indigo-200/80 px-2.5 py-0.5 text-xs font-black text-indigo-950">
                {effectiveCandidates.length} of {totalAvailable} candidate{totalAvailable === 1 ? '' : 's'}
              </span>
            </div>

            {/* Quantity quick chips if many candidates */}
            {totalAvailable > 25 ? (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-indigo-100/80 pt-2.5">
                <span className="text-[11px] font-semibold text-indigo-800">Quick quantity:</span>
                <button
                  type="button"
                  onClick={() => setAssignQuantity('all')}
                  className={`min-h-7 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    assignQuantity === 'all'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'border border-indigo-200 bg-white text-indigo-900 hover:bg-indigo-100'
                  }`}
                >
                  All ({totalAvailable})
                </button>
                {totalAvailable > 50 ? (
                  <button
                    type="button"
                    onClick={() => setAssignQuantity(50)}
                    className={`min-h-7 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      assignQuantity === 50
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'border border-indigo-200 bg-white text-indigo-900 hover:bg-indigo-100'
                    }`}
                  >
                    Top 50
                  </button>
                ) : null}
                {totalAvailable > 100 ? (
                  <button
                    type="button"
                    onClick={() => setAssignQuantity(100)}
                    className={`min-h-7 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      assignQuantity === 100
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'border border-indigo-200 bg-white text-indigo-900 hover:bg-indigo-100'
                    }`}
                  >
                    Top 100
                  </button>
                ) : null}
                {totalAvailable > 250 ? (
                  <button
                    type="button"
                    onClick={() => setAssignQuantity(250)}
                    className={`min-h-7 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      assignQuantity === 250
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'border border-indigo-200 bg-white text-indigo-900 hover:bg-indigo-100'
                    }`}
                  >
                    Top 250
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setAssignQuantity('custom');
                    if (!customCount) setCustomCount(String(Math.min(totalAvailable, 100)));
                  }}
                  className={`min-h-7 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    assignQuantity === 'custom'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'border border-indigo-200 bg-white text-indigo-900 hover:bg-indigo-100'
                  }`}
                >
                  Custom
                </button>
                {assignQuantity === 'custom' ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max={totalAvailable}
                      value={customCount}
                      onChange={(e) => setCustomCount(e.target.value)}
                      placeholder="Count"
                      className="h-7 w-20 rounded-lg border border-indigo-300 bg-white px-2 text-xs font-bold text-indigo-950 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="text-[11px] text-indigo-700">max {totalAvailable}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Candidate Sample Pills */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {effectiveCandidates.slice(0, 8).map((c) => {
                const name = c.fullName || c.full_name || 'Candidate';
                const role = c.primaryTargetRole || c.branch || '';
                return (
                  <span
                    key={c.userId || c.user_id}
                    className="inline-flex items-center rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 shadow-2xs"
                  >
                    👤 {name} {role ? `(${role})` : ''}
                  </span>
                );
              })}
              {effectiveCandidates.length > 8 ? (
                <span className="inline-flex items-center rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-900">
                  +{effectiveCandidates.length - 8} more candidates
                </span>
              ) : null}
            </div>
          </div>

          {/* Two-Tier Target Selection: 1. Company -> 2. Vacancy */}
          <div className="mb-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Target Company & Job Vacancy
            </h3>

            {/* Dropdown 1: Select Company */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <label
                  htmlFor="target-company-select"
                  className="flex items-center gap-2 text-xs font-bold text-slate-800"
                >
                  <span>Step 1: Select Company</span>
                  <span className="text-rose-500">*</span>
                  <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                    Admin & Employer Posted
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-800">
                  <input
                    type="checkbox"
                    checked={includeExternal}
                    onChange={(e) => setIncludeExternal(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Include external scrapes (LinkedIn/Naukri)</span>
                </label>
              </div>

              <span className="block text-[11px] font-semibold text-slate-500">
                {companyList.length} hiring {companyList.length === 1 ? 'company' : 'companies'} with active vacancies
              </span>

              {/* Company search filter input */}
              {companyList.length > 5 ? (
                <input
                  type="text"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  placeholder="🔍 Type to filter companies (e.g. Geosis, Jain Infotech, Suswadeep, Pfizer)..."
                  className="min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              ) : null}

              <select
                id="target-company-select"
                required
                value={selectedCompany}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 shadow-2xs outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 sm:text-sm"
              >
                <option value="">
                  {isLoadingJobs
                    ? 'Loading company vacancies…'
                    : `-- Choose a Company (${companyList.length} companies available) --`}
                </option>
                {filteredCompanies.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.jobCount} {c.jobCount === 1 ? 'vacancy' : 'vacancies'})
                  </option>
                ))}
              </select>

              {companySearch && filteredCompanies.length === 0 ? (
                <p className="text-xs text-rose-600">
                  No companies found matching "{companySearch}". Clear the search to see all.
                </p>
              ) : null}
            </div>

            {/* Dropdown 2: Select Vacancy of Selected Company */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="target-job-select"
                  className="block text-xs font-bold text-slate-800"
                >
                  Step 2: Select Job Vacancy of {selectedCompany || 'Company'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                {selectedCompany ? (
                  <span className="text-[11px] font-semibold text-amber-800">
                    {availableCompanyJobs.length} active {availableCompanyJobs.length === 1 ? 'job' : 'jobs'}
                  </span>
                ) : null}
              </div>

              <select
                id="target-job-select"
                required
                disabled={!selectedCompany || availableCompanyJobs.length === 0}
                value={selectedJobId}
                onChange={(e) => {
                  setSelectedJobId(e.target.value);
                  setError('');
                }}
                className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 shadow-2xs outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100 disabled:text-slate-400 sm:text-sm"
              >
                {!selectedCompany ? (
                  <option value="">-- First select a company in Step 1 above --</option>
                ) : availableCompanyJobs.length === 0 ? (
                  <option value="">No active vacancies for {selectedCompany}</option>
                ) : (
                  <>
                    <option value="" disabled>
                      -- Choose a vacancy of {selectedCompany} ({availableCompanyJobs.length} available) --
                    </option>
                    {availableCompanyJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} {job.location ? `· 📍 ${job.location}` : ''}{' '}
                        {job.salary ? `· 💰 ${job.salary}` : ''}
                      </option>
                    ))}
                  </>
                )}
              </select>

              {/* Selected Vacancy Summary Details Card */}
              {selectedJob ? (
                <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-1 font-bold text-slate-950">
                    <span className="text-sm">{selectedJob.title}</span>
                    <span className="rounded-md bg-amber-200/80 px-2 py-0.5 text-[11px] text-amber-950">
                      {selectedJob.company}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600">
                    {selectedJob.location ? <span>📍 {selectedJob.location}</span> : null}
                    {selectedJob.salary ? <span>💰 {selectedJob.salary}</span> : null}
                    {selectedJob.created_by ? (
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-800">
                        🏢 Employer-Posted
                      </span>
                    ) : selectedJob.source_name ? (
                      <span className="rounded border border-amber-200 bg-amber-100/60 px-1.5 py-0.5 font-bold text-amber-900">
                        ⭐ {selectedJob.source_name}
                      </span>
                    ) : null}
                  </div>
                  {Array.isArray(selectedJob.required_skills) && selectedJob.required_skills.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <span className="text-[11px] font-semibold text-slate-500">Skills:</span>
                      {selectedJob.required_skills.slice(0, 6).map((skill) => (
                        <span
                          key={skill}
                          className="rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-800"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {/* Admin Recommendation Notes */}
          <div className="mb-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="admin-recommendation-notes"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600"
              >
                Admin Recommendation Note (Optional)
              </label>
              <span className="text-[11px] font-semibold text-amber-700">
                Visible to Company Recruiter
              </span>
            </div>
            <textarea
              id="admin-recommendation-notes"
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Matched 2025/2026 Batch GIS developers with strong Python, ArcPy, and spatial analysis skills. Immediate joiners."
              className="w-full rounded-2xl border border-slate-300 p-3 text-xs text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 sm:text-sm"
            />
            <p className="text-[11px] text-slate-500">
              The company will see this note highlighted on each candidate profile card in their dashboard under "🌟 Suitable Profiles".
            </p>
          </div>

          {/* Privacy & Clarity Guarantee */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
            <span className="font-bold text-slate-900">Note:</span> These candidates will appear directly in the employer's{' '}
            <strong className="text-amber-900">🌟 Suitable Profiles</strong> tab for this job. They will not be listed in the student's personal applied jobs list unless the student applies directly or confirms an interview.
          </div>

          {/* Action Footer */}
          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedCompany || !selectedJobId || effectiveCandidates.length === 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-xs transition hover:bg-amber-400 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Assigning {effectiveCandidates.length} candidates…</span>
              ) : (
                <>
                  <span>
                    Assign {effectiveCandidates.length} Candidate{effectiveCandidates.length === 1 ? '' : 's'} to{' '}
                    {selectedCompany || 'Company'}
                  </span>
                  <span>🌟</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
