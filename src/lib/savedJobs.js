const STORAGE_KEY = 'vizagjobs:saved-jobs';
const CHANGE_EVENT = 'vizagjobs:saved-jobs-changed';

const EMPTY_SNAPSHOT = Object.freeze([]);

const safeLocalStorage = () => {
  try {
    if (typeof window === 'undefined') return null;
    const ls = window.localStorage;
    const probe = '__vizagjobs_saved_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
};

const parseSavedJobs = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.id);
  } catch {
    return [];
  }
};

let cachedSnapshot = EMPTY_SNAPSHOT;

const reloadSnapshotFromStorage = () => {
  const ls = safeLocalStorage();
  cachedSnapshot = ls ? parseSavedJobs(ls.getItem(STORAGE_KEY)) : EMPTY_SNAPSHOT;
  return cachedSnapshot;
};

if (typeof window !== 'undefined') {
  reloadSnapshotFromStorage();
}

/** Stable array reference for useSyncExternalStore — only changes when saved jobs change. */
export const getSavedJobsSnapshot = () => cachedSnapshot;

export const readSavedJobs = () => getSavedJobsSnapshot();

export const isJobSaved = (jobId) => {
  if (!jobId) return false;
  return getSavedJobsSnapshot().some((job) => job.id === jobId);
};

const writeSavedJobs = (jobs) => {
  const ls = safeLocalStorage();
  if (!ls) return false;
  cachedSnapshot = jobs;
  ls.setItem(STORAGE_KEY, JSON.stringify(jobs));
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
};

export const toggleSavedJob = (snapshot) => {
  if (!snapshot?.id) return false;

  const current = getSavedJobsSnapshot();
  const exists = current.some((job) => job.id === snapshot.id);

  if (exists) {
    return writeSavedJobs(current.filter((job) => job.id !== snapshot.id));
  }

  return writeSavedJobs([
    {
      id: snapshot.id,
      slug: snapshot.slug || '',
      title: snapshot.title || 'Job opening',
      company: snapshot.company || '',
      location: snapshot.location || '',
      jobPath: snapshot.jobPath || '',
      savedAt: new Date().toISOString(),
    },
    ...current,
  ]);
};

export const removeSavedJob = (jobId) => {
  if (!jobId) return false;
  return writeSavedJobs(getSavedJobsSnapshot().filter((job) => job.id !== jobId));
};

export const subscribeSavedJobs = (listener) => {
  if (typeof window === 'undefined') return () => {};

  const onLocalChange = () => listener();
  const onStorageChange = () => {
    reloadSnapshotFromStorage();
    listener();
  };

  window.addEventListener(CHANGE_EVENT, onLocalChange);
  window.addEventListener('storage', onStorageChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onLocalChange);
    window.removeEventListener('storage', onStorageChange);
  };
};
