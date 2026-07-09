export const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://jobsinvizag.in';

/** Where Supabase Auth should send users after email confirm / magic links. */
export const getAuthRedirectUrl = (path = '/employer/login') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (import.meta.env.VITE_SITE_URL) {
    return `${import.meta.env.VITE_SITE_URL.replace(/\/+$/, '')}${normalizedPath}`;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${normalizedPath}`;
  }

  return `${SITE_URL}${normalizedPath}`;
};

export const toAbsoluteUrl = (value = '/') => {
  if (!value) {
    return SITE_URL;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const normalizedPath = value.startsWith('/') ? value : `/${value}`;
  return `${SITE_URL}${normalizedPath}`;
};
