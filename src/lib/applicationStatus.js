/** Canonical application status values stored in `job_applications.status`. */
export const APPLICATION_STATUSES = [
  'applied',
  'viewed',
  'screened',
  'interview_scheduled',
  'processing',
  'hired',
  'joined',
  'rejected',
  'withdrawn',
];

/** Statuses admins/employers can set from the review dropdown in pipeline order. */
export const ADMIN_STATUS_OPTIONS = [
  'applied',
  'viewed',
  'screened',
  'interview_scheduled',
  'processing',
  'hired',
  'joined',
  'rejected',
];

/** Map legacy DB values to the current status model (for reads before migration). */
export const LEGACY_APPLICATION_STATUS_MAP = {
  submitted: 'applied',
  shortlisted: 'screened',
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
    case 'screened':
      return 'Screened';
    case 'interview_scheduled':
      return 'Interview Scheduled';
    case 'processing':
      return 'Processing';
    case 'hired':
      return 'Hired';
    case 'joined':
      return 'Joined';
    case 'rejected':
      return 'Rejected';
    case 'withdrawn':
      return 'Withdrawn';
    case 'external_click':
      return 'External Apply Click';
    default:
      return status;
  }
};

export const getApplicationStatusDescription = (status) => {
  switch (normalizeApplicationStatus(status)) {
    case 'applied':
      return 'Your application was submitted and is waiting for review.';
    case 'viewed':
      return 'The employer or recruiter has opened your application.';
    case 'screened':
      return 'You have been shortlisted following initial recruiter screening.';
    case 'interview_scheduled':
      return 'An interview has been scheduled for this position.';
    case 'processing':
      return 'Your application is under active evaluation with the hiring team.';
    case 'hired':
      return 'Congratulations — you were selected for this role.';
    case 'joined':
      return 'Congratulations — successfully joined the company.';
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
  screened: 'border-purple-200 bg-purple-50 text-purple-700',
  interview_scheduled: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  processing: 'border-amber-200 bg-amber-50 text-amber-800',
  hired: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  joined: 'border-emerald-300 bg-emerald-100 text-emerald-900',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  withdrawn: 'border-slate-200 bg-slate-50 text-slate-600',
  external_click: 'border-cyan-200 bg-cyan-50 text-cyan-800',
};

export const getApplicationStatusStyle = (status) =>
  APPLICATION_STATUS_STYLES[normalizeApplicationStatus(status)] || APPLICATION_STATUS_STYLES.applied;

export const STUDENT_STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'applied', label: 'Applied' },
  { id: 'viewed', label: 'Viewed' },
  { id: 'screened', label: 'Screened' },
  { id: 'interview_scheduled', label: 'Interview' },
  { id: 'processing', label: 'Processing' },
  { id: 'hired', label: 'Hired' },
  { id: 'joined', label: 'Joined' },
  { id: 'rejected', label: 'Rejected' },
];
