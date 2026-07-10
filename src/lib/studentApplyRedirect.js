const PENDING_APPLY_KEY = 'vizagjobs:pending-apply-url';

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

export const openExternalApplyLink = (url) => {
  if (!url) {
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
};
