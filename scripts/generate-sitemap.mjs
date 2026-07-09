import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { getJobDetailPath } from '../src/lib/jobRoutes.js';
import { getMinPostedAtIsoForPublicDisplay } from '../src/lib/jobDisplayWindow.js';
import { JOB_CATEGORY_PAGES } from '../src/lib/jobCategoryPages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DEFAULT_SITE_URL = 'https://jobsinvizag.in';
const DEFAULT_TABLE_NAME = 'jobs';
const PAGE_SIZE = 1000;

const staticRoutes = [
  { path: '/', priority: '1.0' },
  { path: '/jobs', priority: '0.9' },
  { path: '/jobs/it', priority: '0.9' },
  { path: '/jobs/fresher', priority: '0.9' },
  { path: '/jobs/part-time', priority: '0.8' },
  ...JOB_CATEGORY_PAGES.map((page) => ({ path: page.path, priority: '0.85' })),
  { path: '/blog', priority: '0.8' },
  { path: '/about', priority: '0.6' },
  { path: '/contact', priority: '0.6' },
  { path: '/feedback', priority: '0.6' },
  { path: '/saved-jobs', priority: '0.5' },
  { path: '/privacy-policy', priority: '0.5' },
  { path: '/terms-of-service', priority: '0.5' },
  { path: '/disclaimer', priority: '0.5' },
];

const loadEnvFile = (filename) => {
  const filePath = path.join(projectRoot, filename);
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((envVars, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return envVars;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        return envVars;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, '');

      envVars[key] = value;
      return envVars;
    }, {});
};

const env = {
  ...loadEnvFile('.env'),
  ...loadEnvFile('.env.local'),
  ...process.env,
};

const siteUrl = (env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const jobsTable = env.VITE_SUPABASE_JOBS_TABLE || DEFAULT_TABLE_NAME;
const blogTable = env.VITE_SUPABASE_BLOG_TABLE || 'blog_posts';
const sitemapPath = path.join(projectRoot, 'public', 'sitemap.xml');
const generatedAt = new Date().toISOString().split('T')[0];

const escapeXml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const formatLastMod = (value) => {
  if (!value) {
    return generatedAt;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return generatedAt;
  }

  return date.toISOString().split('T')[0];
};

const createUrlEntry = ({ path: routePath, lastmod, priority, changefreq = 'daily' }) => [
  '  <url>',
  `    <loc>${escapeXml(`${siteUrl}${routePath}`)}</loc>`,
  `    <lastmod>${lastmod}</lastmod>`,
  `    <changefreq>${changefreq}</changefreq>`,
  `    <priority>${priority}</priority>`,
  '  </url>',
].join('\n');

const writeSitemap = (entries) => {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');

  fs.writeFileSync(sitemapPath, xml, 'utf8');
};

const fetchPublishedJobs = async () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Skipping job sitemap generation because Supabase env vars are missing.');
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const jobs = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from(jobsTable)
      .select('id, slug, title, company, category, job_type, work_mode, is_fresher, short_description, description, skills, source_name, posted_at, updated_at, status')
      .eq('status', 'published')
      .gte('posted_at', getMinPostedAtIsoForPublicDisplay())
      .not('slug', 'is', null)
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch jobs for sitemap: ${error.message}`);
    }

    const currentBatch = (data || []).filter((job) => job.slug);
    jobs.push(...currentBatch);

    if (currentBatch.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return jobs;
};

const fetchPublishedBlogPosts = async () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Skipping blog sitemap generation because Supabase env vars are missing.');
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const posts = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from(blogTable)
      .select('slug, published_at, updated_at, status')
      .eq('status', 'published')
      .not('slug', 'is', null)
      .order('published_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch blog posts for sitemap: ${error.message}`);
    }

    const currentBatch = (data || []).filter((row) => row.slug);
    posts.push(...currentBatch);

    if (currentBatch.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return posts;
};

const buildSitemap = async () => {
  const staticEntries = staticRoutes.map((route) =>
    createUrlEntry({
      path: route.path,
      lastmod: generatedAt,
      priority: route.priority,
    })
  );

  let jobEntries = [];
  let blogEntries = [];

  try {
    const jobs = await fetchPublishedJobs();
    jobEntries = jobs.map((job) =>
      createUrlEntry({
        path: getJobDetailPath(job),
        lastmod: formatLastMod(job.updated_at || job.posted_at),
        priority: '0.7',
        changefreq: 'daily',
      })
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Failed to generate job sitemap.');
    process.exitCode = 1;
    return;
  }

  try {
    const posts = await fetchPublishedBlogPosts();
    blogEntries = posts.map((post) =>
      createUrlEntry({
        path: `/blog/${post.slug}`,
        lastmod: formatLastMod(post.updated_at || post.published_at),
        priority: '0.65',
        changefreq: 'weekly',
      })
    );
  } catch (error) {
    console.warn('Blog sitemap skipped:', error instanceof Error ? error.message : error);
  }

  writeSitemap([...staticEntries, ...jobEntries, ...blogEntries]);
  console.log(`Generated sitemap with ${staticEntries.length + jobEntries.length + blogEntries.length} URLs.`);
};

await buildSitemap();
