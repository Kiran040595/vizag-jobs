/** Canonical application status values stored in `job_applications.status`. */
export const APPLICATION_STATUSES = ['applied', 'viewed', 'processing', 'hired', 'rejected', 'withdrawn'];

/** Statuses admins/employers can set from the review dropdown. */
export const ADMIN_STATUS_OPTIONS = ['applied', 'viewed', 'processing', 'hired', 'rejected'];

/** Map legacy DB values to the current status model (for reads before migration). */
export const LEGACY_APPLICATION_STATUS_MAP = {
  submitted: 'applied',
  shortlisted: 'processing',
};

export const normalizeApplicationStatus = (status) => {
  const value = String(status || '').trim().toLowerCase();
  if (!value) {
    return 'applied';
  }
  return LEGACY_APPLICATION_STATUS_MAP[value] || value;
};

export const formatApplicationStatus = (status) => {
  switch (normalizeApplicationStatus(status)) {
    case 'applied':
      return 'Applied';
    case 'viewed':
      return 'Viewed';
    case 'processing':
      return 'Processing';
    case 'hired':
      return 'Hired';
    case 'rejected':
      return 'Rejected';
    case 'withdrawn':
      return 'Withdrawn';
    default:
      return status;
  }
};

export const getApplicationStatusDescription = (status) => {
  switch (normalizeApplicationStatus(status)) {
    case 'applied':
      return 'Your application was submitted and is waiting for review.';
    case 'viewed':
      return 'The employer or admin has opened your application.';
    case 'processing':
      return 'Your application is under active review or in the interview pipeline.';
    case 'hired':
      return 'Congratulations — you were selected for this role.';
    case 'rejected':
      return 'This application was not moved forward for this role.';
    case 'withdrawn':
      return 'You withdrew this application.';
    default:
      return 'Application status update.';
  }
};

export const APPLICATION_STATUS_STYLES = {
  applied: 'border-blue-200 bg-blue-50 text-blue-700',
  viewed: 'border-slate-200 bg-slate-100 text-slate-700',
  processing: 'border-amber-200 bg-amber-50 text-amber-800',
  hired: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  withdrawn: 'border-slate-200 bg-slate-50 text-slate-600',
};

export const getApplicationStatusStyle = (status) =>
  APPLICATION_STATUS_STYLES[normalizeApplicationStatus(status)] || APPLICATION_STATUS_STYLES.applied;

export const STUDENT_STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'applied', label: 'Applied' },
  { id: 'viewed', label: 'Viewed' },
  { id: 'processing', label: 'Processing' },
  { id: 'hired', label: 'Hired' },
  { id: 'rejected', label: 'Rejected' },
];
