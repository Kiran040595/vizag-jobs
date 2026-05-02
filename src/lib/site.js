export const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://jobsinvizag.in';

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
