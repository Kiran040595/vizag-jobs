// Generates a sample of the HTML the middleware will return for each route
// shape, written to tests/output/. Useful for eyeballing what Google sees.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const tsPath = path.join(repoRoot, 'middleware.ts');
const mjsPath = path.join(repoRoot, '.middleware.runtime.mjs');
fs.writeFileSync(mjsPath, fs.readFileSync(tsPath, 'utf8'), 'utf8');

const indexHtml = fs.readFileSync(path.join(repoRoot, 'dist', 'index.html'), 'utf8');

const realJob = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'senior-react-developer-acme',
  segment: 'it',
  title: 'Senior React Developer',
  company: 'Acme Corp',
  location: 'Visakhapatnam',
  status: 'published',
  short_description: 'Build modern React apps with our team in Vizag.',
  description: 'Build modern React apps with our team in Vizag.',
  employment_type: 'FULL_TIME',
  date_posted: '2026-05-20T10:00:00Z',
  valid_through: '2026-06-20T10:00:00Z',
};
const realPost = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'how-to-find-jobs-in-vizag',
  title: 'How to find jobs in Vizag',
  excerpt: 'A short guide to landing your first job in Visakhapatnam.',
  body: '# Heading\n\nSome [link](https://example.com) markdown.',
  status: 'published',
  published_at: '2026-05-20T10:00:00Z',
  updated_at: '2026-05-22T08:00:00Z',
};

const SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SITE_URL = 'https://jobsinvizag.in';

globalThis.fetch = async (input) => {
  let urlString;
  if (typeof input === 'string') urlString = input;
  else if (input instanceof URL) urlString = input.href;
  else if (input && typeof input.url === 'string') urlString = input.url;
  else throw new Error('Unsupported fetch input');
  const u = new URL(urlString);
  if (u.origin === SUPABASE_URL) {
    const params = u.searchParams;
    const slugFilter = params.get('slug');
    const idFilter = params.get('id');
    const table = u.pathname.replace('/rest/v1/', '');
    const dataset = table === 'blog_posts' ? [realPost] : [realJob];
    let row = null;
    if (slugFilter && slugFilter.startsWith('eq.')) {
      const v = slugFilter.slice(3);
      row = dataset.find((r) => r.slug === v) || null;
    } else if (idFilter && idFilter.startsWith('eq.')) {
      const v = idFilter.slice(3);
      row = dataset.find((r) => r.id === v) || null;
    }
    return new Response(JSON.stringify(row ? [row] : []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (u.pathname === '/index.html') {
    return new Response(indexHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  return new Response('', { status: 200 });
};

const middleware = (await import(pathToFileURL(mjsPath).href + '?t=' + Date.now())).default;

const outDir = path.join(__dirname, 'output');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const samples = [
  ['jobs.html', '/jobs'],
  ['jobs-it.html', '/jobs/it'],
  ['jobs-fresher.html', '/jobs/fresher'],
  ['jobs-part-time.html', '/jobs/part-time'],
  ['blog.html', '/blog'],
  [`blog-${realPost.slug}.html`, `/blog/${realPost.slug}`],
  [`jobs-${realJob.segment}-${realJob.slug}.html`, `/jobs/${realJob.segment}/${realJob.slug}`],
];

for (const [fname, p] of samples) {
  const res = await middleware(new Request(`https://jobsinvizag.in${p}`));
  const body = await res.text();
  fs.writeFileSync(path.join(outDir, fname), body, 'utf8');
  console.log(`wrote ${fname} (status ${res.status}, ${body.length} bytes)`);
}

fs.rmSync(mjsPath, { force: true });
console.log(`\nSamples saved to ${outDir}`);
