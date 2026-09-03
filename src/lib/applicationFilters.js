import {
  ADMIN_STATUS_OPTIONS,
  formatApplicationStatus,
  normalizeApplicationStatus,
} from './applicationStatus';

export const ALL_APPLICATION_STATUSES = 'all';

export const APPLICATION_STATUS_FILTER_OPTIONS = [
  { value: ALL_APPLICATION_STATUSES, label: 'All statuses' },
  ...ADMIN_STATUS_OPTIONS.map((status) => ({
    value: status,
    label: formatApplicationStatus(status),
  })),
  { value: 'withdrawn', label: formatApplicationStatus('withdrawn') },
];

export const filterApplicationsByStatus = (applications = [], status = ALL_APPLICATION_STATUSES) => {
  if (!status || status === ALL_APPLICATION_STATUSES) {
    return applications;
  }

  return applications.filter(
    (application) => normalizeApplicationStatus(application.status) === status,
  );
};
