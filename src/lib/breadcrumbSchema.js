import { getJobCategorySegment, getJobDetailPath } from './jobRoutes.js';

const DEFAULT_SITE_URL = 'https://jobsinvizag.in';

const SEGMENT_LABELS = {
  it: 'IT Jobs in Vizag',
  'it-fresher': 'IT Fresher Jobs',
  fresher: 'Fresher Jobs in Vizag',
  'part-time': 'Part-time Jobs in Vizag',
  bank: 'Bank Jobs in Vizag',
  'bank-fresher': 'Bank Fresher Jobs',
  govt: 'Government Jobs in Vizag',
  'govt-fresher': 'Government Fresher Jobs',
  'work-from-home': 'Work From Home Jobs',
  teaching: 'Teaching Jobs in Vizag',
  hospital: 'Hospital Jobs in Vizag',
  pharma: 'Pharma Jobs in Vizag',
  accounts: 'Accounts Jobs in Vizag',
  sales: 'Sales Jobs in Vizag',
  bpo: 'BPO Jobs in Vizag',
  manufacturing: 'Manufacturing Jobs in Vizag',
  hotel: 'Hotel Jobs in Vizag',
  logistics: 'Logistics Jobs in Vizag',
  'real-estate': 'Real Estate Jobs in Vizag',
  ngo: 'NGO Jobs in Vizag',
  general: 'Jobs in Vizag',
};

const SEGMENT_LIST_PATHS = {
  it: '/jobs/it',
  'it-fresher': '/jobs/fresher',
  fresher: '/jobs/fresher',
  'part-time': '/jobs/part-time',
  general: '/jobs',
};

export const getCategoryListPath = (segment) => SEGMENT_LIST_PATHS[segment] || '/jobs';

export const buildBreadcrumbSchema = (job, options = {}) => {
  if (!job || typeof job !== 'object') {
    return null;
  }

  const title = String(job.title || job.slug || 'Job').trim();
  if (!title) {
    return null;
  }

  const segment = getJobCategorySegment(job);
  const categoryLabel = SEGMENT_LABELS[segment] || 'Jobs in Vizag';
  const categoryPath = getCategoryListPath(segment);
  const jobPath = options.canonicalPath || getJobDetailPath(job);
  const siteUrl = (options.siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const toUrl = (path) => `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const item = (name, path, position) => ({
    '@type': 'ListItem',
    position,
    name,
    item: toUrl(path),
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      item('Home', '/', 1),
      item('Jobs in Vizag', '/jobs', 2),
      item(categoryLabel, categoryPath, 3),
      item(title, jobPath, 4),
    ],
  };
};
