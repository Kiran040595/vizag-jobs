import { buildJobPostingSchema, isJobExpired } from './src/lib/jobPostingSchema.js';
import { buildBreadcrumbSchema } from './src/lib/breadcrumbSchema.js';
import { getJobDetailPath } from './src/lib/jobRoutes.js';
import { buildBlogPostingSchema } from './src/lib/blogPostingSchema.js';
import { buildListingHeadInjection, getListingMeta } from './src/lib/collectionPageSchema.js';
import { buildLegalPageHeadInjection, getLegalPageMeta } from './src/lib/legalPageMeta.js';
import {
  buildHomePageSsrPayload,
  fetchHomeBootstrapJobRows,
} from './src/lib/homePageBootstrap.js';
import { isPostedAtWithinPublicDisplayWindow } from './src/lib/jobDisplayWindow.js';
import {
  JOB_CATEGORY_LANDING_IDS,
  JOB_CATEGORY_PAGES,
} from './src/lib/jobCategoryPages.js';

/** Single-segment `/jobs/:slug` routes that are category hubs, not job details. */
const RESERVED_JOBS_LISTING_SLUGS = new Set([
  'it',
  'fresher',
  'part-time',
  ...JOB_CATEGORY_PAGES.map((page) => page.id),
]);

const DEFAULT_SITE_URL = 'https://jobsinvizag.in';
const SITE_NAME = 'Jobs in Vizag';
const DEFAULT_OG_IMAGE_PATH = '/og-image.png';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const config = {
  matcher: [
    '/',
    '/jobs/:segment/:slug',
    '/jobs/:slug',
    '/job/:id',
    '/blog',
    '/blog/:slug',
    '/jobs',
    '/about',
    '/contact',
    '/privacy-policy',
    '/terms-of-service',
    '/disclaimer',
    '/r/:token',
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
  // Match public list/detail API: hide jobs outside the display window (avoids
  // middleware SEO + client "Job not found" soft-404 mismatch).
  if (!isPostedAtWithinPublicDisplayWindow(job.posted_at)) return null;
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

const renderHead = ({ title, description, canonicalUrl, keywords, scripts = [], noindex = false, ogType = 'website', siteUrl, ogImagePath = DEFAULT_OG_IMAGE_PATH }) => {
  const ogImageUrl = `${String(siteUrl || '').replace(/\/+$/, '')}${ogImagePath.startsWith('/') ? ogImagePath : `/${ogImagePath}`}`;
  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}" />` : '',
    `<meta name="application-name" content="${escapeHtml(SITE_NAME)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(SITE_NAME)} — Find Your Career in Vizag" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />`,
    noindex ? '<meta name="robots" content="noindex, follow" />' : '',
    ...scripts,
  ]
    .filter(Boolean)
    .join('\n    ');
};

const buildJobHeadInjection = (job, { siteUrl, canonicalPath, noindex }) => {
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const title = `${job.title || 'Job'} at ${job.company || 'Employer'} - Vizag Jobs`;
  const description = buildJobMetaDescription(job);
  const expired = noindex || isJobExpired(job);
  const jobPosting = expired
    ? null
    : buildJobPostingSchema(job, { siteUrl, canonicalPath, canonicalUrl });
  const breadcrumb = buildBreadcrumbSchema(job, { siteUrl, canonicalPath });

  const scripts = [];
  if (jobPosting) scripts.push(jsonLdScript(jobPosting));
  if (breadcrumb) scripts.push(jsonLdScript(breadcrumb));

  return renderHead({ title, description, canonicalUrl, scripts, noindex: expired || noindex, siteUrl });
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

  return renderHead({ title, description, canonicalUrl, scripts, ogType: 'article', siteUrl });
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
    siteUrl,
  });
};

const stripExistingHead = (html) =>
  html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s[^>]*name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s[^>]*name=["']keywords["'][^>]*>/gi, '')
    .replace(/<meta\s[^>]*name=["']application-name["'][^>]*>/gi, '')
    .replace(/<meta\s[^>]*name=["']robots["'][^>]*>/gi, '')
    .replace(/<meta\s[^>]*name=["']twitter:[^"']+["'][^>]*>/gi, '')
    .replace(/<meta\s[^>]*property=["']og:site_name["'][^>]*>/gi, '')
    .replace(/<meta\s[^>]*property=["']og:title["'][^>]*>/gi, '')
    .replace(/<meta\s[^>]*property=["']og:description["'][^>]*>/gi, '')
    .replace(/<meta\s[^>]*property=["']og:url["'][^>]*>/gi, '')
    .replace(/<meta\s[^>]*property=["']og:type["'][^>]*>/gi, '')
    .replace(/<meta\s[^>]*property=["']og:image[^"']*["'][^>]*>/gi, '')
    .replace(/<link\s[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');

const injectIntoHtml = (html, injection, { bodyHtml = '', preRootHtml = '' } = {}) => {
  let next = stripExistingHead(html);
  if (next.includes('</head>')) {
    next = next.replace('</head>', `    ${injection}\n  </head>`);
  } else {
    next = `${injection}\n${next}`;
  }
  if (preRootHtml) {
    next = next.replace('<div id="root"', `${preRootHtml}\n    <div id="root"`);
  }
  if (bodyHtml && next.includes('<div id="root"></div>')) {
    next = next.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
  }
  return next;
};

const fetchIndexShell = (request) => fetch(new URL('/index.html', request.url));

const serveWithInjection = async (
  request,
  injection,
  { status = 200, cacheControl, bodyHtml = '', preRootHtml = '' } = {},
) => {
  const shell = await fetchIndexShell(request);
  if (!shell.ok) return fetch(request);
  const html = await shell.text();
  return new Response(injectIntoHtml(html, injection, { bodyHtml, preRootHtml }), {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control':
        cacheControl ||
        (status === 404
          ? 'public, s-maxage=60, stale-while-revalidate=300'
          : 'public, s-maxage=300, stale-while-revalidate=86400'),
    },
  });
};

/** Hard 404 for missing jobs/posts — stops Google soft-404 (HTTP 200 + thin page). */
const serveNotFound = async (request, env, { title, description, path }) => {
  const canonicalUrl = `${env.siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const injection = renderHead({
    title,
    description,
    canonicalUrl,
    noindex: true,
    siteUrl: env.siteUrl,
  });
  return serveWithInjection(request, injection, { status: 404 });
};

const handleLegacyJobUrl = async (id, env, request, url) => {
  const job = await fetchPublishedJobByIdentifier(id, env);
  if (job) {
    const canonicalPath = getJobDetailPath(job);
    return Response.redirect(`${env.siteUrl}${canonicalPath}`, 301);
  }
  return serveNotFound(request, env, {
    title: 'Job not found | Vizag Jobs',
    description: 'This job listing is unavailable or no longer active on Vizag Jobs.',
    path: url.pathname,
  });
};

const handleJobDetail = async (segment, slug, env, url, request) => {
  const job = await fetchPublishedJobByIdentifier(slug, env);
  if (!job) {
    return serveNotFound(request, env, {
      title: 'Job not found | Vizag Jobs',
      description: 'This job listing is unavailable or no longer active on Vizag Jobs.',
      path: url.pathname,
    });
  }

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

const handleBlogPost = async (slug, env, request, url) => {
  const post = await fetchPublishedBlogPostBySlug(slug, env);
  if (!post) {
    return serveNotFound(request, env, {
      title: 'Post not found | Vizag Jobs Blog',
      description: 'This blog post is unavailable or no longer published on Vizag Jobs.',
      path: url.pathname,
    });
  }

  const injection = buildBlogPostHeadInjection(post, { siteUrl: env.siteUrl });
  return serveWithInjection(request, injection);
};

const handleListing = async (path, env, request) => {
  if (!getListingMeta(path)) return fetch(request);

  const injection = buildListingPageHeadInjection(path, { siteUrl: env.siteUrl });
  if (!injection) return fetch(request);

  return serveWithInjection(request, injection);
};

const buildLegalPageHeadTags = (path, { siteUrl }) => {
  const payload = buildLegalPageHeadInjection(path, { siteUrl });
  if (!payload) return null;

  const scripts = [];
  if (payload.schema) scripts.push(jsonLdScript(payload.schema));

  return {
    head: renderHead({
      title: payload.title,
      description: payload.description,
      canonicalUrl: payload.canonicalUrl,
      keywords: payload.keywords,
      scripts,
      siteUrl,
    }),
    bodyHtml: payload.bodyHtml || '',
  };
};

const handleLegalPage = async (path, env, request) => {
  if (!getLegalPageMeta(path)) return fetch(request);

  const built = buildLegalPageHeadTags(path, { siteUrl: env.siteUrl });
  if (!built) return fetch(request);

  return serveWithInjection(request, built.head, { bodyHtml: built.bodyHtml });
};

const handleHomePage = async (env, request) => {
  const rows = await fetchHomeBootstrapJobRows({
    supabaseUrl: env.supabaseUrl,
    supabaseAnonKey: env.supabaseAnonKey,
    jobsTable: env.jobsTable,
  });
  const payload = buildHomePageSsrPayload({ siteUrl: env.siteUrl, jobs: rows });
  const scripts = [];
  if (payload.schema) scripts.push(jsonLdScript(payload.schema));

  const head = renderHead({
    title: payload.title,
    description: payload.description,
    canonicalUrl: payload.canonicalUrl,
    keywords: payload.keywords,
    scripts,
    siteUrl: env.siteUrl,
  });

  return serveWithInjection(request, head, {
    bodyHtml: payload.bodyHtml,
    preRootHtml: payload.preRootHtml,
    // Short CDN cache so the job snapshot stays reasonably fresh.
    cacheControl: 'public, s-maxage=120, stale-while-revalidate=600',
  });
};

const handleResumeShareLink = async (token, env) => {
  if (!UUID_PATTERN.test(token)) {
    return new Response('Invalid resume link.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return new Response('Resume sharing is not configured.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const target = new URL(`${env.supabaseUrl.replace(/\/+$/, '')}/functions/v1/resume-share`);
  target.searchParams.set('t', token);

  const upstream = await fetch(target.toString(), {
    method: 'GET',
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${env.supabaseAnonKey}`,
    },
    redirect: 'manual',
  });

  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get('Location');
    if (location) {
      return Response.redirect(location, 302);
    }
  }

  const message = (await upstream.text().catch(() => '')) || 'Resume not available.';
  return new Response(message, {
    status: upstream.status || 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const env = getEnvConfig();
  const path = url.pathname.replace(/\/+$/, '') || '/';

  const resumeShareMatch = path.match(/^\/r\/([^/]+)$/);
  if (resumeShareMatch) {
    return handleResumeShareLink(decodeURIComponent(resumeShareMatch[1]), env);
  }

  if (path === '/') {
    const category = (url.searchParams.get('category') || '').toLowerCase().trim();
    // Send old filter URLs to dedicated category landing pages (fixes GSC alternates).
    if (category && JOB_CATEGORY_LANDING_IDS.has(category)) {
      const next = new URL(`${env.siteUrl}/jobs/${category}`);
      return Response.redirect(next.toString(), 301);
    }
    if (!url.search) {
      return handleHomePage(env, request);
    }
  }

  if (getLegalPageMeta(path)) {
    return handleLegalPage(path, env, request);
  }

  if (getListingMeta(path)) {
    return handleListing(path, env, request);
  }

  const blogPostMatch = url.pathname.match(/^\/blog\/([^/]+)\/?$/);
  if (blogPostMatch) {
    return handleBlogPost(decodeURIComponent(blogPostMatch[1]), env, request, url);
  }

  const legacyMatch = url.pathname.match(/^\/job\/([^/]+)\/?$/);
  if (legacyMatch) {
    return handleLegacyJobUrl(decodeURIComponent(legacyMatch[1]), env, request, url);
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
    // Category hubs (/jobs/civil, /jobs/it, …) must keep passing through to the SPA.
    if (RESERVED_JOBS_LISTING_SLUGS.has(slug)) {
      return fetch(request);
    }
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
    return serveNotFound(request, env, {
      title: 'Job not found | Vizag Jobs',
      description: 'This job listing is unavailable or no longer active on Vizag Jobs.',
      path: url.pathname,
    });
  }

  return fetch(request);
}
