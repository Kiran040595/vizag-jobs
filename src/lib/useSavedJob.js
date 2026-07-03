import { useCallback, useSyncExternalStore } from 'react';
import {
  getSavedJobsSnapshot,
  isJobSaved,
  subscribeSavedJobs,
  toggleSavedJob,
} from './savedJobs';

const EMPTY_SNAPSHOT = [];

export const useSavedJobsList = () =>
  useSyncExternalStore(subscribeSavedJobs, getSavedJobsSnapshot, () => EMPTY_SNAPSHOT);

export const useSavedJob = (jobId, snapshot) => {
  const saved = useSyncExternalStore(
    subscribeSavedJobs,
    () => isJobSaved(jobId),
    () => false,
  );

  const toggle = useCallback(
    (event) => {
      event?.preventDefault();
      event?.stopPropagation();
      if (!snapshot?.id) return;
      toggleSavedJob(snapshot);
    },
    [snapshot],
  );

  return { saved, toggle };
};
