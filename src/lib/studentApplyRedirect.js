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
