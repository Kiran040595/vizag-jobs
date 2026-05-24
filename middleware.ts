import { buildJobPostingSchema, isJobExpired } from './src/lib/jobPostingSchema.js';
import { buildBreadcrumbSchema } from './src/lib/breadcrumbSchema.js';
import { getJobDetailPath } from './src/lib/jobRoutes.js';
import { buildBlogPostingSchema } from './src/lib/blogPostingSchema.js';
import { buildListingHeadInjection, getListingMeta } from './src/lib/collectionPageSchema.js';

const DEFAULT_SITE_URL = 'https://jobsinvizag.in';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const config = {
  matcher: [
    '/jobs/:segment/:slug',
    '/jobs/:slug',
    '/job/:id',
    '/blog',
    '/blog/:slug',
    '/jobs',
  ],
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const jsonLdScript = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

const getEnvConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const jobsTable = process.env.SUPABASE_JOBS_TABLE || process.env.VITE_SUPABASE_JOBS_TABLE || 'jobs';
  const blogTable = process.env.SUPABASE_BLOG_TABLE || process.env.VITE_SUPABASE_BLOG_TABLE || 'blog_posts';
  const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(
    /\/+$/,
    '',
  );
  return { supabaseUrl, supabaseAnonKey, jobsTable, blogTable, siteUrl };
};

const supabaseHeaders = (anonKey) => ({
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  Accept: 'application/json',
});

const fetchSupabaseRow = async ({ supabaseUrl, supabaseAnonKey, table, field, value, columns = '*' }) => {
  const query = new URLSearchParams({
    select: columns,
    limit: '1',
  });
  query.set(field, `eq.${value}`);

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query.toString()}`, {
      headers: supabaseHeaders(supabaseAnonKey),
    });
    if (!response.ok) return null;
    const rows = await response.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
};

const fetchPublishedJobByIdentifier = async (identifier, env) => {
  const trimmed = String(identifier || '').trim();
  if (!trimmed || !env.supabaseUrl || !env.supabaseAnonKey) return null;

  let job = await fetchSupabaseRow({
    supabaseUrl: env.supabaseUrl,
    supabaseAnonKey: env.supabaseAnonKey,
    table: env.jobsTable,
    field: 'slug',
    value: trimmed,
  });

  if (!job && UUID_PATTERN.test(trimmed)) {
    job = await fetchSupabaseRow({
      supabaseUrl: env.supabaseUrl,
      supabaseAnonKey: env.supabaseAnonKey,
      table: env.jobsTable,
      field: 'id',
      value: trimmed,
    });
  }

  if (!job || job.status !== 'published') return null;
  return job;
};

const fetchPublishedBlogPostBySlug = async (slug, env) => {
  const trimmed = String(slug || '').trim();
  if (!trimmed || !env.supabaseUrl || !env.supabaseAnonKey) return null;

  const post = await fetchSupabaseRow({
    supabaseUrl: env.supabaseUrl,
    supabaseAnonKey: env.supabaseAnonKey,
    table: env.blogTable,
    field: 'slug',
    value: trimmed,
    columns: 'id,slug,title,excerpt,body,status,published_at,updated_at,created_at',
  });

  if (!post || post.status !== 'published') return null;
  return post;
};

const buildJobMetaDescription = (job) => {
  const title = job.title || 'Job opening';
  const company = job.company || 'Employer';
  const location = job.location || 'Visakhapatnam';
  const summary = job.short_description || job.description || '';
  const plain = String(summary)
    .replace(/[#>*_`~\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  return plain
    ? `Apply for ${title} at ${company} in ${location}. ${plain}`.slice(0, 160)
    : `Apply for ${title} at ${company} in ${location}. Find more jobs in Vizag and Visakhapatnam.`.slice(0, 160);
};

const renderHead = ({ title, description, canonicalUrl, keywords, scripts = [], noindex = false, ogType = 'website' }) =>
  [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}" />` : '',
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    noindex ? '<meta name="robots" content="noindex, follow" />' : '',
    ...scripts,
  ]
    .filter(Boolean)
    .join('\n    ');

const buildJobHeadInjection = (job, { siteUrl, canonicalPath, noindex }) => {
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const title = `${job.title || 'Job'} at ${job.company || 'Employer'} - Vizag Jobs`;
  const description = buildJobMetaDescription(job);
  const jobPosting = buildJobPostingSchema(job, { siteUrl, canonicalPath, canonicalUrl });
  const breadcrumb = buildBreadcrumbSchema(job, { siteUrl, canonicalPath });

  const scripts = [];
  if (jobPosting) scripts.push(jsonLdScript(jobPosting));
  if (breadcrumb) scripts.push(jsonLdScript(breadcrumb));

  return renderHead({ title, description, canonicalUrl, scripts, noindex });
};

const buildBlogPostHeadInjection = (post, { siteUrl }) => {
  const canonicalPath = `/blog/${post.slug}`;
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const title = `${post.title} | Vizag Jobs Blog`;
  const description =
    String(post.excerpt || post.title || 'Vizag Jobs blog post').slice(0, 160);
  const blogPosting = buildBlogPostingSchema(post, { siteUrl, canonicalPath, canonicalUrl });

  const scripts = [];
  if (blogPosting) scripts.push(jsonLdScript(blogPosting));

  return renderHead({ title, description, canonicalUrl, scripts, ogType: 'article' });
};

const buildListingPageHeadInjection = (path, { siteUrl }) => {
  const injection = buildListingHeadInjection(path, { siteUrl });
  if (!injection) return null;

  const scripts = [];
  if (injection.schema) scripts.push(jsonLdScript(injection.schema));

  return renderHead({
    title: injection.title,
    description: injection.description,
    canonicalUrl: injection.canonicalUrl,
    keywords: injection.keywords,
    scripts,
  });
};

const injectIntoHtml = (html, injection) => {
  if (html.includes('</head>')) {
    return html.replace('</head>', `    ${injection}\n  </head>`);
  }
  return `${injection}\n${html}`;
};

const fetchIndexShell = (request) => fetch(new URL('/index.html', request.url));

const serveWithInjection = async (request, injection) => {
  const shell = await fetchIndexShell(request);
  if (!shell.ok) return fetch(request);
  const html = await shell.text();
  return new Response(injectIntoHtml(html, injection), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
    },
  });
};

const handleLegacyJobUrl = async (id, env, request) => {
  const job = await fetchPublishedJobByIdentifier(id, env);
  if (job) {
    const canonicalPath = getJobDetailPath(job);
    return Response.redirect(`${env.siteUrl}${canonicalPath}`, 301);
  }
  return fetch(request);
};

const handleJobDetail = async (segment, slug, env, url, request) => {
  const job = await fetchPublishedJobByIdentifier(slug, env);
  if (!job) return fetch(request);

  const canonicalPath = getJobDetailPath(job);
  if (url.pathname !== canonicalPath && url.pathname !== `${canonicalPath}/`) {
    return Response.redirect(`${env.siteUrl}${canonicalPath}`, 301);
  }

  const injection = buildJobHeadInjection(job, {
    siteUrl: env.siteUrl,
    canonicalPath,
    noindex: isJobExpired(job),
  });
  return serveWithInjection(request, injection);
};

const handleBlogPost = async (slug, env, request) => {
  const post = await fetchPublishedBlogPostBySlug(slug, env);
  if (!post) return fetch(request);

  const injection = buildBlogPostHeadInjection(post, { siteUrl: env.siteUrl });
  return serveWithInjection(request, injection);
};

const handleListing = async (path, env, request) => {
  if (!getListingMeta(path)) return fetch(request);

  const injection = buildListingPageHeadInjection(path, { siteUrl: env.siteUrl });
  if (!injection) return fetch(request);

  return serveWithInjection(request, injection);
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const env = getEnvConfig();
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (getListingMeta(path)) {
    return handleListing(path, env, request);
  }

  const blogPostMatch = url.pathname.match(/^\/blog\/([^/]+)\/?$/);
  if (blogPostMatch) {
    return handleBlogPost(decodeURIComponent(blogPostMatch[1]), env, request);
  }

  const legacyMatch = url.pathname.match(/^\/job\/([^/]+)\/?$/);
  if (legacyMatch) {
    return handleLegacyJobUrl(decodeURIComponent(legacyMatch[1]), env, request);
  }

  const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)\/([^/]+)\/?$/);
  if (jobMatch) {
    return handleJobDetail(
      decodeURIComponent(jobMatch[1]),
      decodeURIComponent(jobMatch[2]),
      env,
      url,
      request,
    );
  }

  const legacyJobsSlugMatch = url.pathname.match(/^\/jobs\/([^/]+)\/?$/);
  if (legacyJobsSlugMatch) {
    const slug = decodeURIComponent(legacyJobsSlugMatch[1]);
    const job = await fetchPublishedJobByIdentifier(slug, env);
    if (job) {
      const canonicalPath = getJobDetailPath(job);
      if (url.pathname !== canonicalPath && url.pathname !== `${canonicalPath}/`) {
        return Response.redirect(`${env.siteUrl}${canonicalPath}`, 301);
      }
      const injection = buildJobHeadInjection(job, {
        siteUrl: env.siteUrl,
        canonicalPath,
        noindex: isJobExpired(job),
      });
      return serveWithInjection(request, injection);
    }
    return fetch(request);
  }

  return fetch(request);
}
