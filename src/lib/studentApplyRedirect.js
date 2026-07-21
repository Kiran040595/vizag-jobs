import { getDailyUpdatesChannelUrl, stashExternalApplyPrompt } from './jobGroupLink';

const PENDING_APPLY_KEY = 'vizagjobs:pending-apply-url';
const PENDING_APPLY_JOB_KEY = 'vizagjobs:pending-apply-job-id';
const PENDING_APPLY_META_KEY = 'vizagjobs:pending-apply-meta';

export const buildStudentAuthPath = ({ pathname, search = '', apply = false } = {}) => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (pathname) {
    params.set('next', pathname);
  }
  if (apply) {
    params.set('apply', '1');
  }
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const readAuthReturnPath = (searchParams) => {
  const next = searchParams?.get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/student/profile';
  }
  return next;
};

export const shouldAutoApplyAfterAuth = (searchParams) => searchParams?.get('apply') === '1';

/** Path to open after login/register; preserves ?apply=1 for job return. */
export const buildPostAuthReturnPath = (searchParams) => {
  const base = readAuthReturnPath(searchParams);
  if (!shouldAutoApplyAfterAuth(searchParams)) {
    return base;
  }
  if (base.includes('apply=1')) {
    return base;
  }
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}apply=1`;
};

/** Profile first when apply flow needs a complete profile, otherwise the job page. */
export const resolvePostAuthDestination = (searchParams, { profileComplete } = {}) => {
  const jobPath = buildPostAuthReturnPath(searchParams);
  const nextJob = searchParams?.get('next');

  if (
    shouldAutoApplyAfterAuth(searchParams) &&
    !profileComplete &&
    nextJob &&
    nextJob.startsWith('/') &&
    !nextJob.startsWith('//')
  ) {
    return `/student/profile${buildStudentAuthPath({ pathname: nextJob, apply: true })}`;
  }

  return jobPath;
};

export const stashPendingApplyUrl = (url) => {
  if (!url) {
    return;
  }
  try {
    sessionStorage.setItem(PENDING_APPLY_KEY, url);
    sessionStorage.removeItem(PENDING_APPLY_JOB_KEY);
  } catch {
    // Ignore storage failures.
  }
};

export const stashPendingApplyJobId = (jobId) => {
  if (!jobId) {
    return;
  }
  try {
    sessionStorage.setItem(PENDING_APPLY_JOB_KEY, jobId);
    sessionStorage.removeItem(PENDING_APPLY_KEY);
  } catch {
    // Ignore storage failures.
  }
};

export const stashPendingApplyJobMeta = ({ jobId, title, company, jobPath } = {}) => {
  if (!jobId && !title && !company && !jobPath) {
    return;
  }

  try {
    sessionStorage.setItem(
      PENDING_APPLY_META_KEY,
      JSON.stringify({
        jobId: jobId || '',
        title: title || '',
        company: company || '',
        jobPath: jobPath || '',
      }),
    );
  } catch {
    // Ignore storage failures.
  }
};

export const readPendingApplyJobMeta = () => {
  try {
    const raw = sessionStorage.getItem(PENDING_APPLY_META_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return {
      jobId: parsed.jobId || '',
      title: parsed.title || '',
      company: parsed.company || '',
      jobPath: parsed.jobPath || '',
    };
  } catch {
    return null;
  }
};

export const clearPendingApplyJobMeta = () => {
  try {
    sessionStorage.removeItem(PENDING_APPLY_META_KEY);
  } catch {
    // Ignore storage failures.
  }
};

export const consumePendingApplyUrl = () => {
  try {
    const value = sessionStorage.getItem(PENDING_APPLY_KEY);
    sessionStorage.removeItem(PENDING_APPLY_KEY);
    return value || '';
  } catch {
    return '';
  }
};

export const consumePendingApplyJobId = () => {
  try {
    const value = sessionStorage.getItem(PENDING_APPLY_JOB_KEY);
    sessionStorage.removeItem(PENDING_APPLY_JOB_KEY);
    return value || '';
  } catch {
    return '';
  }
};

export const buildInternalApplyPath = (jobId, jobPath = '') => {
  const params = new URLSearchParams();
  if (jobPath) {
    params.set('next', jobPath);
  }
  const query = params.toString();
  return `/student/apply/${jobId}${query ? `?${query}` : ''}`;
};

/** Show Instagram channel prompt, then open external apply URL. */
export const openExternalApplyLink = (url, options = {}) => {
  if (!url) {
    return;
  }
  stashExternalApplyPrompt({
    applyUrl: url,
    channelUrl: options.channelUrl || getDailyUpdatesChannelUrl(),
    jobTitle: options.jobTitle || options.job?.title || '',
  });
};
