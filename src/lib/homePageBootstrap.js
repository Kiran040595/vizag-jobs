import { getJobDetailPath } from './jobRoutes.js';
import { getMinPostedAtIsoForPublicDisplay } from './jobDisplayWindow.js';
import { isJobExpired } from './jobPostingSchema.js';

export const HOME_BOOTSTRAP_SCRIPT_ID = 'vizag-home-bootstrap';
export const HOME_SSR_JOB_LIMIT = 24;

const DEFAULT_SITE_URL = 'https://jobsinvizag.in';

const HOME_META = {
  title: 'Jobs in Vizag | Latest Job Openings in Visakhapatnam 2026',
  description:
    'Find the latest IT jobs, fresher jobs, part-time jobs and private jobs in Visakhapatnam. Employers post openings; students apply on-site and track status.',
  keywords:
    'Jobs in Vizag, Vizag Jobs, Visakhapatnam Jobs, IT Jobs Vizag, Fresher Jobs Vizag, Part-time Jobs Vizag',
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const normalizeText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const joinList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return normalizeText(value);
};

/** Map a slim Supabase row to the list-card shape used by HomePage / JobList. */
export const mapHomeBootstrapJob = (job, index = 0) => {
  const category = normalizeText(job.category);
  const jobType = normalizeText(job.job_type ?? job.jobType);
  const isFresherRaw = job.is_fresher ?? job.isFresher;
  const isFresher =
    isFresherRaw === true || isFresherRaw === 'Yes' || isFresherRaw === 'yes' ? 'Yes' : 'No';

  return {
    id: job.id || `home-ssr-job-${index + 1}`,
    slug: normalizeText(job.slug),
    title: normalizeText(job.title),
    company: normalizeText(job.company),
    location: normalizeText(job.location, 'Visakhapatnam'),
    category,
    jobType,
    workMode: normalizeText(job.work_mode ?? job.workMode),
    experience: normalizeText(job.experience),
    isFresher,
    isFeatured: Boolean(job.is_featured ?? job.isFeatured),
    salary: normalizeText(job.salary),
    shortDescription: normalizeText(job.short_description ?? job.shortDescription),
    skills: joinList(job.skills),
    source: normalizeText(job.source_name ?? job.source),
    postedAt: normalizeText(job.posted_at ?? job.postedAt),
    expiresAt: normalizeText(job.expires_at ?? job.expiresAt),
    status: normalizeText(job.status, 'published'),
    tags: [category, jobType, isFresher === 'Yes' ? 'Fresher' : 'Experienced'].filter(Boolean),
  };
};

export const readHomeBootstrapJobs = () => {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(HOME_BOOTSTRAP_SCRIPT_ID);
  if (!el?.textContent?.trim()) return null;
  try {
    const parsed = JSON.parse(el.textContent);
    const jobs = Array.isArray(parsed?.jobs) ? parsed.jobs : null;
    return jobs && jobs.length > 0 ? jobs : null;
  } catch {
    return null;
  }
};

export const buildHomePageSchema = (jobs, siteUrl = DEFAULT_SITE_URL) => {
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const itemList =
    Array.isArray(jobs) && jobs.length > 0
      ? {
          '@type': 'ItemList',
          name: 'Recent jobs in Vizag',
          numberOfItems: jobs.length,
          itemListElement: jobs.slice(0, 12).map((job, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: `${job.title} at ${job.company}`,
            url: `${base}${getJobDetailPath(job)}`,
          })),
        }
      : null;

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Jobs in Vizag',
    alternateName: 'Vizag Jobs',
    url: `${base}/`,
    description: HOME_META.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${base}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  if (!itemList) return website;

  return {
    '@context': 'https://schema.org',
    '@graph': [website, itemList],
  };
};

export const buildHomePageBodyHtml = (jobs, siteUrl = DEFAULT_SITE_URL) => {
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const items = (Array.isArray(jobs) ? jobs : []).slice(0, HOME_SSR_JOB_LIMIT);

  const cards = items
    .map((job) => {
      const href = `${base}${getJobDetailPath(job)}`;
      const company = escapeHtml(job.company || 'Employer');
      const title = escapeHtml(job.title || 'Job opening');
      const location = escapeHtml(job.location || 'Visakhapatnam');
      return [
        '<li style="border:1px solid #e2e8f0;border-radius:0.75rem;padding:0.875rem;background:#fff">',
        `<a href="${escapeHtml(href)}" style="color:#0f172a;text-decoration:none;font-weight:700">${title}</a>`,
        `<div style="margin-top:0.35rem;font-size:0.875rem;color:#475569">${company} · ${location}</div>`,
        '</li>',
      ].join('');
    })
    .join('');

  return [
    '<section class="home-ssr" style="max-width:72rem;margin:0 auto;padding:1.25rem 1rem 2rem;font-family:system-ui,sans-serif;color:#334155">',
    '<h1 style="font-size:1.75rem;font-weight:800;color:#020617;margin:0 0 0.5rem">Jobs in Vizag</h1>',
    '<p style="margin:0 0 1rem;line-height:1.6">Latest job openings in Visakhapatnam. Employers post roles; candidates apply on-site and track application status.</p>',
    items.length
      ? `<h2 style="font-size:1.125rem;font-weight:700;color:#0f172a;margin:0 0 0.75rem">Recent Job Openings (${items.length})</h2>`
      : '<p>Loading the latest Visakhapatnam jobs…</p>',
    items.length
      ? `<ul style="list-style:none;padding:0;margin:0;display:grid;gap:0.75rem;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))">${cards}</ul>`
      : '',
    '</section>',
  ].join('');
};

export const buildHomeBootstrapScript = (jobs) => {
  const payload = JSON.stringify({
    generatedAt: new Date().toISOString(),
    jobs: Array.isArray(jobs) ? jobs : [],
  }).replace(/</g, '\\u003c');

  return `<script id="${HOME_BOOTSTRAP_SCRIPT_ID}" type="application/json">${payload}</script>`;
};

/**
 * Build homepage SSR payload for edge middleware.
 * @param {object} options
 * @param {string} options.siteUrl
 * @param {Array<object>} [options.jobs] already-mapped list jobs
 */
export const buildHomePageSsrPayload = ({ siteUrl = DEFAULT_SITE_URL, jobs = [] } = {}) => {
  const mapped = (Array.isArray(jobs) ? jobs : [])
    .map(mapHomeBootstrapJob)
    .filter((job) => job.slug && !isJobExpired(job));

  return {
    title: HOME_META.title,
    description: HOME_META.description,
    keywords: HOME_META.keywords,
    canonicalUrl: `${String(siteUrl).replace(/\/+$/, '')}/`,
    schema: buildHomePageSchema(mapped, siteUrl),
    bodyHtml: buildHomePageBodyHtml(mapped, siteUrl),
    preRootHtml: buildHomeBootstrapScript(mapped),
    jobs: mapped,
  };
};

/** Supabase REST helper used by middleware (no supabase-js). */
export const fetchHomeBootstrapJobRows = async ({
  supabaseUrl,
  supabaseAnonKey,
  jobsTable = 'jobs',
  limit = HOME_SSR_JOB_LIMIT,
}) => {
  if (!supabaseUrl || !supabaseAnonKey) return [];

  const minPosted = getMinPostedAtIsoForPublicDisplay();
  const select = [
    'id',
    'slug',
    'title',
    'company',
    'location',
    'category',
    'job_type',
    'work_mode',
    'experience',
    'is_fresher',
    'is_featured',
    'salary',
    'short_description',
    'skills',
    'source_name',
    'posted_at',
    'expires_at',
    'status',
  ].join(',');

  const query = new URLSearchParams({
    select,
    status: 'eq.published',
    posted_at: `gte.${minPosted}`,
    order: 'is_featured.desc,posted_at.desc',
    limit: String(limit),
  });

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${jobsTable}?${query.toString()}`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) return [];
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};
