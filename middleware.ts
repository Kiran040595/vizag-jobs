import { buildJobPostingSchema, isJobExpired } from './src/lib/jobPostingSchema.js';
import { buildBreadcrumbSchema } from './src/lib/breadcrumbSchema.js';
import { getJobDetailPath } from './src/lib/jobRoutes.js';

const DEFAULT_SITE_URL = 'https://jobsinvizag.in';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const config = {
  matcher: ['/jobs/:segment/:slug', '/job/:id'],
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const getSupabaseConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const jobsTable = process.env.SUPABASE_JOBS_TABLE || process.env.VITE_SUPABASE_JOBS_TABLE || 'jobs';
  const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(
    /\/+$/,
    '',
  );

  return { supabaseUrl, supabaseAnonKey, jobsTable, siteUrl };
};

const supabaseHeaders = (anonKey) => ({
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  Accept: 'application/json',
});

const fetchJobRow = async ({ supabaseUrl, supabaseAnonKey, jobsTable, field, value }) => {
  const query = new URLSearchParams({
    select: '*',
    limit: '1',
  });
  query.set(field, `eq.${value}`);

  const response = await fetch(`${supabaseUrl}/rest/v1/${jobsTable}?${query.toString()}`, {
    headers: supabaseHeaders(supabaseAnonKey),
  });

  if (!response.ok) {
    return null;
  }

  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
};

const fetchPublishedJobByIdentifier = async (identifier, config) => {
  const trimmed = String(identifier || '').trim();
  if (!trimmed) {
    return null;
  }

  const { supabaseUrl, supabaseAnonKey, jobsTable } = config;
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  let job = await fetchJobRow({
    supabaseUrl,
    supabaseAnonKey,
    jobsTable,
    field: 'slug',
    value: trimmed,
  });

  if (!job && UUID_PATTERN.test(trimmed)) {
    job = await fetchJobRow({
      supabaseUrl,
      supabaseAnonKey,
      jobsTable,
      field: 'id',
      value: trimmed,
    });
  }

  if (!job || job.status !== 'published') {
    return null;
  }

  return job;
};

const buildMetaDescription = (job) => {
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
    : `Apply for ${title} at ${company} in ${location}. Find more jobs in Vizag and Visakhapatnam.`.slice(
        0,
        160,
      );
};

const buildSeoHeadInjection = (job, { siteUrl, canonicalPath, noindex }) => {
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const title = `${job.title || 'Job'} at ${job.company || 'Employer'} - Vizag Jobs`;
  const description = buildMetaDescription(job);
  const jobPosting = buildJobPostingSchema(job, { siteUrl, canonicalPath, canonicalUrl });
  const breadcrumb = buildBreadcrumbSchema(job, { siteUrl, canonicalPath });

  const scripts = [];
  if (jobPosting) {
    scripts.push(
      `<script type="application/ld+json">${JSON.stringify(jobPosting).replace(/</g, '\\u003c')}</script>`,
    );
  }
  if (breadcrumb) {
    scripts.push(
      `<script type="application/ld+json">${JSON.stringify(breadcrumb).replace(/</g, '\\u003c')}</script>`,
    );
  }

  const robotsTag = noindex ? '<meta name="robots" content="noindex, follow" />' : '';

  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    robotsTag,
    ...scripts,
  ]
    .filter(Boolean)
    .join('\n    ');
};

const injectIntoHtml = (html, injection) => {
  if (html.includes('</head>')) {
    return html.replace('</head>', `    ${injection}\n  </head>`);
  }
  return `${injection}\n${html}`;
};

const fetchIndexShell = (request) => fetch(new URL('/index.html', request.url));

export default async function middleware(request) {
  const url = new URL(request.url);
  const config = getSupabaseConfig();
  const legacyMatch = url.pathname.match(/^\/job\/([^/]+)\/?$/);

  if (legacyMatch) {
    const job = await fetchPublishedJobByIdentifier(decodeURIComponent(legacyMatch[1]), config);
    if (job) {
      const canonicalPath = getJobDetailPath(job);
      return Response.redirect(`${config.siteUrl}${canonicalPath}`, 301);
    }
    return fetch(request);
  }

  const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)\/([^/]+)\/?$/);
  if (!jobMatch) {
    return fetch(request);
  }

  const slug = decodeURIComponent(jobMatch[2]);
  const job = await fetchPublishedJobByIdentifier(slug, config);

  if (!job) {
    return fetch(request);
  }

  const canonicalPath = getJobDetailPath(job);
  if (url.pathname !== canonicalPath && url.pathname !== `${canonicalPath}/`) {
    return Response.redirect(`${config.siteUrl}${canonicalPath}`, 301);
  }

  const shellResponse = await fetchIndexShell(request);
  if (!shellResponse.ok) {
    return fetch(request);
  }

  const html = await shellResponse.text();
  const injection = buildSeoHeadInjection(job, {
    siteUrl: config.siteUrl,
    canonicalPath,
    noindex: isJobExpired(job),
  });

  return new Response(injectIntoHtml(html, injection), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
