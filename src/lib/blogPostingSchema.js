const SCHEMA_CONTEXT = 'https://schema.org';
const DEFAULT_SITE_URL = 'https://jobsinvizag.in';

const buildAbsoluteUrl = (path, siteUrl) => {
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

const stripMarkdown = (markdown, maxLength = 5000) => {
  const text = String(markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#>*_~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return maxLength > 0 && text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const truncate = (value, max) => {
  const v = String(value || '').trim();
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
};

/**
 * Build a Google-compliant BlogPosting JSON-LD object.
 * Spec: https://developers.google.com/search/docs/appearance/structured-data/article
 *
 * Accepts a post object with snake_case OR camelCase keys (matches both
 * raw Supabase rows and processed `mapRowToPost` output).
 */
export const buildBlogPostingSchema = (post, options = {}) => {
  if (!post || typeof post !== 'object') return null;

  const title = String(post.title || '').trim();
  const slug = String(post.slug || '').trim();
  const body = post.body || '';
  const excerpt = post.excerpt || '';

  if (!title || !slug) return null;

  const siteUrl = String(options.siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const canonicalPath = options.canonicalPath || `/blog/${slug}`;
  const canonicalUrl = options.canonicalUrl || buildAbsoluteUrl(canonicalPath, siteUrl);

  const datePublished = toIsoDate(post.publishedAt || post.published_at);
  const dateModified =
    toIsoDate(post.updatedAt || post.updated_at) ||
    datePublished ||
    new Date().toISOString();

  const description = excerpt
    ? stripMarkdown(excerpt, 300)
    : stripMarkdown(body, 300) || `Read ${title} on the Vizag Jobs blog.`;

  const articleBody = stripMarkdown(body, 8000);

  const schema = {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BlogPosting',
    headline: truncate(title, 110),
    description: truncate(description, 250),
    datePublished: datePublished || dateModified,
    dateModified,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    url: canonicalUrl,
    author: {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'Jobs in Vizag',
      alternateName: 'Vizag Jobs',
      url: `${siteUrl}/`,
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'Jobs in Vizag',
      alternateName: 'Vizag Jobs',
      url: `${siteUrl}/`,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/icon-512x512.png`,
        width: 512,
        height: 512,
      },
    },
    image: [`${siteUrl}/og-image.png`, `${siteUrl}/icon-512x512.png`],
  };

  if (articleBody) {
    schema.articleBody = articleBody;
  }

  return schema;
};
