export const APPLY_MODE_EXTERNAL = 'external';
export const APPLY_MODE_INTERNAL = 'internal';

export const isInternalApplyJob = (job) => job?.applyMode === APPLY_MODE_INTERNAL;

export const isExternalApplyJob = (job) => !isInternalApplyJob(job);

export const jobSupportsApply = (job) => {
  if (!job) {
    return false;
  }
  if (isInternalApplyJob(job)) {
    return true;
  }
  return Boolean(job.applyLink);
};

export const applyButtonLabel = (job) =>
  isInternalApplyJob(job) ? 'Apply on Vizag Jobs' : 'Apply Now';
