const SCHEMA_CONTEXT = 'https://schema.org';
const DEFAULT_SITE_URL = 'https://jobsinvizag.in';

const buildAbsoluteUrl = (path, siteUrl) => {
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

/** SEO metadata for each indexable listing route. */
export const LISTING_PAGE_META = {
  '/jobs': {
    title: 'Jobs in Vizag | Latest Job Openings in Visakhapatnam',
    description:
      'Browse the latest job openings in Vizag (Visakhapatnam). IT jobs, fresher jobs, part-time jobs, government jobs, bank jobs and more — updated daily.',
    name: 'Jobs in Vizag',
    keywords: ['Jobs in Vizag', 'Vizag Jobs', 'Visakhapatnam Jobs', 'Andhra Pradesh Jobs'],
  },
  '/jobs/it': {
    title: 'IT Jobs in Vizag | Software & Tech Jobs in Visakhapatnam',
    description:
      'Latest IT jobs in Vizag including software engineer, developer, data analyst, and tech roles in Visakhapatnam. Apply for IT jobs at Vizag Jobs.',
    name: 'IT Jobs in Vizag',
    keywords: ['IT Jobs Vizag', 'Software Jobs Vizag', 'Tech Jobs Visakhapatnam', 'IT Careers Vizag'],
  },
  '/jobs/fresher': {
    title: 'Fresher Jobs in Vizag | Entry Level Jobs for Graduates',
    description:
      'Latest fresher jobs in Vizag (Visakhapatnam) for graduates, B.Tech, B.E and entry-level candidates. Apply for fresher openings across IT, banking, sales and more.',
    name: 'Fresher Jobs in Vizag',
    keywords: ['Fresher Jobs Vizag', 'Entry Level Jobs Visakhapatnam', 'Graduate Jobs Vizag'],
  },
  '/jobs/part-time': {
    title: 'Part-time Jobs in Vizag | Flexible Work in Visakhapatnam',
    description:
      'Find part-time jobs in Vizag for students, freelancers and professionals. Flexible work-from-home and on-site part-time openings in Visakhapatnam.',
    name: 'Part-time Jobs in Vizag',
    keywords: ['Part-time Jobs Vizag', 'Flexible Jobs Visakhapatnam', 'Student Jobs Vizag'],
  },
  '/blog': {
    title: 'Vizag Jobs Blog | Career Tips, Industry Insights & Job Trends',
    description:
      'Career advice, hiring trends, and industry insights for job seekers in Vizag and Visakhapatnam. Read the latest from the Vizag Jobs blog.',
    name: 'Vizag Jobs Blog',
    keywords: ['Vizag Jobs Blog', 'Career Tips Vizag', 'Job Trends Visakhapatnam'],
  },
};

export const getListingMeta = (path) => LISTING_PAGE_META[path] || null;

/**
 * Build a CollectionPage JSON-LD for category/listing pages.
 * Optionally includes an ItemList of recent items if `items` is provided.
 *
 * @param {string} path - the listing route (e.g. "/jobs/it")
 * @param {object} [options]
 * @param {string} [options.siteUrl]
 * @param {Array<{ name: string, url: string }>} [options.items] - optional list of items
 */
export const buildCollectionPageSchema = (path, options = {}) => {
  const meta = getListingMeta(path);
  if (!meta) return null;

  const siteUrl = String(options.siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const canonicalUrl = buildAbsoluteUrl(path, siteUrl);

  const isBlog = path === '/blog';
  const type = isBlog ? 'Blog' : 'CollectionPage';

  const schema = {
    '@context': SCHEMA_CONTEXT,
    '@type': type,
    name: meta.name,
    headline: meta.name,
    description: meta.description,
    url: canonicalUrl,
    inLanguage: 'en-IN',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Vizag Jobs',
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Vizag Jobs',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/icon-512x512.png`,
        width: 512,
        height: 512,
      },
    },
  };

  if (Array.isArray(options.items) && options.items.length > 0) {
    schema.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: options.items.length,
      itemListElement: options.items.slice(0, 25).map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: buildAbsoluteUrl(item.url, siteUrl),
      })),
    };
  }

  return schema;
};

export const buildListingHeadInjection = (path, options = {}) => {
  const meta = getListingMeta(path);
  if (!meta) return null;

  const siteUrl = String(options.siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  return {
    title: meta.title,
    description: meta.description,
    canonicalUrl: buildAbsoluteUrl(path, siteUrl),
    keywords: meta.keywords?.join(', ') || '',
    schema: buildCollectionPageSchema(path, options),
  };
};
