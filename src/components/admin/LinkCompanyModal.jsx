import { useEffect, useMemo, useState } from 'react';
import { assignJobsToEmployer, moveJobsToAdmin } from '../../services/adminJobs';

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
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

const BuildingIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5 text-violet-600"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" />
    <path d="M16 6h.01" />
    <path d="M8 10h.01" />
    <path d="M16 10h.01" />
    <path d="M8 14h.01" />
    <path d="M16 14h.01" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5 shrink-0 text-emerald-600"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export default function LinkCompanyModal({
  job,
  employers = [],
  applicationCount = 0,
  isOpen,
  onClose,
  onLinked,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployerId, setSelectedEmployerId] = useState('');
  const [syncCompanyName, setSyncCompanyName] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Pre-select current employer if job is already linked
  useEffect(() => {
    if (job && isOpen) {
      setSelectedEmployerId(job.created_by || '');
      setSearchTerm('');
      setSyncCompanyName(true);
      setErrorMessage('');
      setIsSubmitting(false);
    }
  }, [job, isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredEmployers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return employers;

    return employers.filter((employer) => {
      const companyName = (employer.companyName || employer.company_name || '').toLowerCase();
      const email = (employer.contactEmail || employer.contact_email || employer.email || '').toLowerCase();
      const contactName = (employer.contactName || employer.contact_name || '').toLowerCase();
      const industry = (employer.industry || '').toLowerCase();
      const location = (employer.location || '').toLowerCase();

      return (
        companyName.includes(term) ||
        email.includes(term) ||
        contactName.includes(term) ||
        industry.includes(term) ||
        location.includes(term)
      );
    });
  }, [employers, searchTerm]);

  const currentEmployer = useMemo(() => {
    if (!job?.created_by) return null;
    return employers.find((emp) => (emp.userId || emp.user_id) === job.created_by) || null;
  }, [employers, job?.created_by]);

  const selectedEmployer = useMemo(() => {
    if (!selectedEmployerId) return null;
    return employers.find((emp) => (emp.userId || emp.user_id) === selectedEmployerId) || null;
  }, [employers, selectedEmployerId]);

  if (!isOpen || !job) {
    return null;
  }

  const handleLink = async () => {
    if (!selectedEmployerId) {
      setErrorMessage('Please select a company to link this job to.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const updatedJobs = await assignJobsToEmployer({
        jobIds: [job.id],
        employerUserId: selectedEmployerId,
        syncCompanyName,
      });

      const updatedJob = updatedJobs?.[0] || {
        ...job,
        created_by: selectedEmployerId,
        company: syncCompanyName && selectedEmployer?.companyName
          ? selectedEmployer.companyName
          : job.company,
      };

      const companyName = selectedEmployer?.companyName || selectedEmployer?.company_name || 'selected company';
      onLinked?.(
        updatedJob,
        `Successfully linked "${job.title}" to ${companyName}. ${applicationCount} application(s) preserved.`
      );
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not link job to company.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    const confirmUnlink = window.confirm(
      `Are you sure you want to unlink "${job.title}" from ${currentEmployer?.companyName || 'the employer'} and move it to Admin-owned? All application records will stay preserved.`
    );
    if (!confirmUnlink) return;

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const updatedJobs = await moveJobsToAdmin({
        jobIds: [job.id],
      });

      const updatedJob = updatedJobs?.[0] || {
        ...job,
        created_by: null,
      };

      onLinked?.(
        updatedJob,
        `Unlinked "${job.title}" from company. Job is now Admin-owned. Applications preserved.`
      );
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not unlink job.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCurrentSelection = job.created_by && job.created_by === selectedEmployerId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 sm:p-6 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-company-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <BuildingIcon />
            </div>
            <div>
              <h2 id="link-company-title" className="text-xl font-bold text-slate-900">
                Link Job to Company
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Connect this job with a registered employer account for portal management.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Close dialog"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Target Job Summary Box */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Selected Job
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                ID: {job.id.slice(0, 8)}…
              </span>
            </div>
            <h3 className="mt-1 text-base font-bold text-slate-950">{job.title}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span>
                <strong className="text-slate-800">Current display company:</strong> {job.company || 'Not set'}
              </span>
              <span>
                <strong className="text-slate-800">Status:</strong>{' '}
                <span className="capitalize">{job.status}</span>
              </span>
              <span>
                <strong className="text-slate-800">Owner:</strong>{' '}
                {currentEmployer ? (
                  <span className="font-semibold text-violet-700">
                    {currentEmployer.companyName || currentEmployer.company_name} (Linked)
                  </span>
                ) : job.created_by ? (
                  <span className="text-violet-700">Employer ID: {job.created_by.slice(0, 8)}…</span>
                ) : (
                  <span className="text-slate-500">Admin-owned</span>
                )}
              </span>
            </div>
          </div>

          {/* Data Safety Guarantee Notice */}
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-950">
            <ShieldCheckIcon />
            <div className="text-xs space-y-1">
              <p className="font-bold text-emerald-900">
                Zero Data Loss Guaranteed
              </p>
              <p className="text-emerald-800 leading-relaxed">
                This job has <strong className="font-bold text-emerald-950">{applicationCount} on-platform application{applicationCount === 1 ? '' : 's'}</strong>.
                Linking to an employer updates job ownership without touching student applications or resumes.
                When the employer logs in, the job and all its student applications will appear instantly in their dashboard.
              </p>
            </div>
          </div>

          {/* Search Employers */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Select Registered Employer Company
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <SearchIcon />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search companies by name, email, or contact..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Employer Radio Card List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Available Companies ({filteredEmployers.length})</span>
              {selectedEmployerId ? (
                <span className="font-medium text-violet-700">1 company selected</span>
              ) : (
                <span>Click a company to select</span>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto space-y-2 rounded-2xl border border-slate-200 p-2 bg-slate-50/50">
              {filteredEmployers.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No registered employers match "{searchTerm}".
                </div>
              ) : (
                filteredEmployers.map((emp) => {
                  const empUserId = emp.userId || emp.user_id;
                  const isSelected = selectedEmployerId === empUserId;
                  const isCurrent = (job.created_by || '') === empUserId;
                  const companyName = emp.companyName || emp.company_name || 'Unnamed Company';
                  const email = emp.contactEmail || emp.contact_email || emp.email;

                  return (
                    <label
                      key={empUserId}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                        isSelected
                          ? 'border-violet-500 bg-violet-50/70 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="selected_employer"
                        value={empUserId}
                        checked={isSelected}
                        onChange={() => {
                          setSelectedEmployerId(empUserId);
                          setErrorMessage('');
                        }}
                        className="mt-1 h-4 w-4 text-violet-600 focus:ring-violet-400"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 truncate">
                            {companyName}
                          </span>
                          {isCurrent && (
                            <span className="rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                              Currently Linked
                            </span>
                          )}
                          {emp.isActive !== false && (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          {email && <span>{email}</span>}
                          {emp.contactName && <span>· {emp.contactName}</span>}
                          {emp.location && <span>· {emp.location}</span>}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Sync display company name option */}
          {selectedEmployer && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncCompanyName}
                  onChange={(e) => setSyncCompanyName(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-900">
                    Sync job display company name to "{selectedEmployer.companyName || selectedEmployer.company_name}"
                  </span>
                  <p className="mt-0.5 text-slate-500">
                    When enabled, the public company name displayed on job cards will be updated to match the employer's official registered company name.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 p-4 sm:p-6 rounded-b-3xl">
          <div>
            {job.created_by && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleUnlink}
                className="rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition disabled:opacity-50"
              >
                Unlink (Move to Admin)
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || !selectedEmployerId || isCurrentSelection}
              onClick={handleLink}
              className="rounded-2xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-500 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? 'Linking…'
                : isCurrentSelection
                ? 'Already Linked to this Company'
                : 'Confirm Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
