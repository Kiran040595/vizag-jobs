import { useMemo, useState } from 'react';
import { useNativeModal } from '../../hooks/useNativeModal';
import { assignCandidatesToJob } from '../../services/jobSuitableProfiles';

export default function AssignCandidatesDialog({
  open,
  onClose,
  candidates = [],
  jobs = [],
  defaultJobId = '',
  onAssigned,
}) {
  const [selectedJobId, setSelectedJobId] = useState(defaultJobId || (jobs[0]?.id || ''));
  const [jobSearch, setJobSearch] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useNativeModal(open && candidates.length > 0);

  // Filter available jobs based on company or title search
  const filteredJobs = useMemo(() => {
    if (!jobSearch.trim()) return jobs;
    const q = jobSearch.toLowerCase().trim();
    return jobs.filter(
      (job) =>
        (job.title || '').toLowerCase().includes(q) ||
        (job.company || '').toLowerCase().includes(q) ||
        (job.location || '').toLowerCase().includes(q),
    );
  }, [jobs, jobSearch]);

  if (!open || candidates.length === 0) {
    return null;
  }

  const selectedJob = jobs.find((job) => job.id === selectedJobId) || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedJobId) {
      setError('Please choose a target company job vacancy.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const candidateUserIds = candidates.map((c) => c.userId || c.user_id).filter(Boolean);

      const result = await assignCandidatesToJob({
        jobId: selectedJobId,
        candidateUserIds,
        adminNotes,
        candidateProfiles: candidates,
      });

      if (onAssigned) {
        onAssigned({
          count: result.count,
          jobTitle: selectedJob?.title || 'Selected Job',
          company: selectedJob?.company || 'Company',
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
        <div className="flex items-start justify-between border-b border-slate-100 bg-amber-50/60 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-xl text-slate-950 shadow-xs">
              🌟
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-950 sm:text-xl">
                Assign Candidates as Suitable Profiles
              </h2>
              <p className="mt-0.5 text-xs text-amber-900/80 sm:text-sm">
                Directly share matching candidates with an employer for their hiring pipeline.
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

          {/* Candidates Summary Pill Bar */}
          <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
              <span>Selected Candidates to Assign:</span>
              <span className="rounded-full bg-indigo-200/80 px-2.5 py-0.5 text-indigo-900">
                {candidates.length} candidate{candidates.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {candidates.slice(0, 10).map((c) => {
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
              {candidates.length > 10 ? (
                <span className="inline-flex items-center rounded-lg bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-800">
                  +{candidates.length - 10} more
                </span>
              ) : null}
            </div>
          </div>

          {/* Job Target Selector */}
          <div className="mb-5 space-y-2">
            <label htmlFor="target-job-select" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Select Target Company & Vacancy <span className="text-rose-500">*</span>
            </label>

            {jobs.length > 5 ? (
              <input
                type="text"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Filter by company or job title..."
                className="mb-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 sm:text-sm"
              />
            ) : null}

            <select
              id="target-job-select"
              required
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 shadow-2xs outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 sm:text-sm"
            >
              <option value="" disabled>
                -- Choose a vacancy ({jobs.length} available) --
              </option>
              {filteredJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.company} — {job.title} {job.location ? `(${job.location})` : ''}
                </option>
              ))}
            </select>

            {selectedJob ? (
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
                <span className="font-bold text-slate-900">{selectedJob.title}</span> at{' '}
                <span className="font-semibold text-slate-800">{selectedJob.company}</span>
                {selectedJob.location ? ` · 📍 ${selectedJob.location}` : ''}
                {selectedJob.salary ? ` · 💰 ${selectedJob.salary}` : ''}
              </div>
            ) : null}
          </div>

          {/* Admin Recommendation Notes */}
          <div className="mb-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="admin-recommendation-notes" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
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
              className="w-full rounded-2xl border border-slate-300 p-3 text-xs text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 sm:text-sm"
            />
            <p className="text-[11px] text-slate-500">
              The company will see this recommendation note highlighted on each candidate profile card in their dashboard.
            </p>
          </div>

          {/* Explainer / Privacy Guarantee */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
            <span className="font-bold text-slate-900">Note:</span> These candidates will appear directly in the employer's{' '}
            <strong className="text-amber-900">🌟 Suitable Profiles</strong> tab for this job. They will not be listed in the student's personal applied jobs list unless the student applies directly or confirms an interview.
          </div>

          {/* Action Footer */}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end border-t border-slate-100 pt-4">
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
              disabled={isSubmitting || !selectedJobId}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-xs transition hover:bg-amber-400 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Assigning candidates…</span>
              ) : (
                <>
                  <span>Assign {candidates.length} Candidate{candidates.length === 1 ? '' : 's'}</span>
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
