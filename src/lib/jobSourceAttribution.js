const SOURCE_LABELS = {
  'naukri.com': 'Naukri',
  'linkedin.com': 'LinkedIn',
  'indeed.com': 'Indeed',
  'glassdoor.com': 'Glassdoor',
  'shine.com': 'Shine',
  'foundit.in': 'Foundit',
  'monsterindia.com': 'Monster',
  'timesjobs.com': 'TimesJobs',
};

const PLACEHOLDER_SOURCE =
  /^(n\/a|na|unknown|not specified|none|employer portal|jobsinvizag\.in|direct|manual|admin)$/i;

const normalizeText = (value) => String(value ?? '').trim();

const isHttpUrl = (value) => /^https?:\/\//i.test(normalizeText(value));

const hostnameFromUrl = (value) => {
  try {
    return new URL(normalizeText(value)).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
};

const formatHostnameLabel = (hostname) => {
  const host = normalizeText(hostname).replace(/^www\./i, '').toLowerCase();
  if (!host) return '';

  if (SOURCE_LABELS[host]) {
    return SOURCE_LABELS[host];
  }

  if (host.includes('naukri')) return 'Naukri';
  if (host.includes('linkedin')) return 'LinkedIn';
  if (host.includes('indeed')) return 'Indeed';

  const base = host.split('.')[0] || host;
  return base.charAt(0).toUpperCase() + base.slice(1);
};

const formatSourceName = (value) => {
  const text = normalizeText(value);
  if (!text || PLACEHOLDER_SOURCE.test(text)) {
    return '';
  }

  const lower = text.toLowerCase();
  if (SOURCE_LABELS[lower]) {
    return SOURCE_LABELS[lower];
  }

  if (lower.includes('naukri')) return 'Naukri';
  if (lower.includes('linkedin')) return 'LinkedIn';
  if (lower.includes('indeed')) return 'Indeed';

  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(text)) {
    return formatHostnameLabel(text);
  }

  return text;
};

/**
 * Resolve public source attribution for a job detail page.
 * Returns null when there is nothing meaningful to show.
 *
 * @param {{ source?: string, sourceUrl?: string, applyLink?: string }} job
 * @returns {{ label: string, href: string | null } | null}
 */
export const resolveJobSourceAttribution = (job) => {
  const sourceName = formatSourceName(job?.source);
  const sourceUrl = normalizeText(job?.sourceUrl);
  const applyLink = normalizeText(job?.applyLink);

  let href = null;
  if (isHttpUrl(sourceUrl)) {
    href = sourceUrl;
  } else if (!sourceName && isHttpUrl(applyLink)) {
    href = applyLink;
  }

  let label = sourceName;
  if (!label && href) {
    label = formatHostnameLabel(hostnameFromUrl(href));
  }

  if (!label) {
    return null;
  }

  if (href) {
    const host = hostnameFromUrl(href);
    if (host === 'jobsinvizag.in') {
      return null;
    }
  }

  return {
    label,
    href: href || null,
  };
};
