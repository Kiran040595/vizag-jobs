// Integration smoke test for Edge Middleware.
//
// Runs the actual middleware module against synthetic Request objects with
// mocked global fetch (Supabase REST + index.html shell). Verifies:
//   1. /jobs           -> 200 with CollectionPage JSON-LD
//   2. /jobs/it        -> 200 with CollectionPage JSON-LD ("IT Jobs in Vizag")
//   3. /jobs/fresher   -> 200 with CollectionPage JSON-LD
//   4. /jobs/part-time -> 200 with CollectionPage JSON-LD
//   5. /blog           -> 200 with Blog JSON-LD
//   6. /blog/<real>    -> 200 with BlogPosting JSON-LD
//   7. /blog/<missing> -> falls through (no schema injected)
//   8. /jobs/<segment>/<slug> with real job -> 200 with JobPosting JSON-LD
//   9. /jobs/<segment>/<slug> with bad canonical segment -> 301 to canonical
//  10. /jobs/<legacy-slug> with real job -> 301 to /jobs/<segment>/<slug>
//  11. /job/<id> with real job -> 301 to /jobs/<segment>/<slug>
//
// The middleware is loaded by copying middleware.ts to a temp .mjs file
// (it contains no TypeScript syntax, just runtime JS).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// 1. Materialize middleware as .mjs so Node imports it without --experimental-strip-types.
//    Must live at the repo root so its relative './src/lib/...' imports resolve.
const tsPath = path.join(repoRoot, 'middleware.ts');
const mjsPath = path.join(repoRoot, '.middleware.runtime.mjs');
fs.writeFileSync(mjsPath, fs.readFileSync(tsPath, 'utf8'), 'utf8');

const indexHtml = fs.readFileSync(path.join(repoRoot, 'dist', 'index.html'), 'utf8');

// 2. Fixture rows.
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

// 3. Mock global fetch.
const SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SITE_URL = 'https://jobsinvizag.in';

const installFetchMock = ({ jobs = [], posts = [] }) => {
  globalThis.fetch = async (input) => {
    let urlString;
    if (typeof input === 'string') urlString = input;
    else if (input instanceof URL) urlString = input.href;
    else if (input && typeof input.url === 'string') urlString = input.url;
    else throw new Error(`Unsupported fetch input: ${input}`);
    const u = new URL(urlString);

    if (u.origin === SUPABASE_URL) {
      const params = u.searchParams;
      const slugFilter = params.get('slug');
      const idFilter = params.get('id');
      const table = u.pathname.replace('/rest/v1/', '');
      const dataset = table === 'blog_posts' ? posts : jobs;
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
};

// 4. Helpers.
const makeRequest = (path) =>
  new Request(`https://jobsinvizag.in${path}`, { method: 'GET' });

const countMatches = (html, re) => (html.match(re) || []).length;

const expectInjected = async (response, asserts) => {
  assert.equal(response.status, 200, `expected 200, got ${response.status}`);
  const html = await response.text();
  // Universal head-hygiene checks: exactly one of each tag.
  assert.equal(countMatches(html, /<title>/gi), 1, 'duplicate <title> tags');
  assert.equal(countMatches(html, /<meta\s[^>]*name=["']description["']/gi), 1, 'duplicate description metas');
  assert.equal(countMatches(html, /<link\s[^>]*rel=["']canonical["']/gi), 1, 'duplicate canonical links');
  for (const [label, predicate] of asserts) {
    assert.ok(predicate(html), `assertion failed: ${label}`);
  }
};

const log = (label, ok) => {
  const mark = ok ? 'OK   ' : 'FAIL ';
  console.log(`  ${mark} ${label}`);
};

const importFresh = async () => {
  const mod = await import(pathToFileURL(mjsPath).href + '?t=' + Date.now());
  return mod.default;
};

// 5. Run cases.
let failed = 0;
const cases = [
  {
    name: '/jobs -> CollectionPage SEO',
    fn: async (mw) => {
      installFetchMock({});
      const res = await mw(makeRequest('/jobs'));
      await expectInjected(res, [
        ['title contains "Jobs in Vizag"', (h) => h.includes('<title>Jobs in Vizag | Latest Job Openings in Visakhapatnam</title>')],
        ['canonical is /jobs', (h) => h.includes('href="https://jobsinvizag.in/jobs"')],
        ['CollectionPage JSON-LD present', (h) => h.includes('"@type":"CollectionPage"')],
      ]);
    },
  },
  {
    name: '/jobs/it -> IT CollectionPage SEO (no longer 404 / 308)',
    fn: async (mw) => {
      installFetchMock({});
      const res = await mw(makeRequest('/jobs/it'));
      await expectInjected(res, [
        ['title is IT-specific', (h) => h.includes('IT Jobs in Vizag | Software &amp; Tech Jobs')],
        ['canonical is /jobs/it', (h) => h.includes('href="https://jobsinvizag.in/jobs/it"')],
        ['Schema name is IT Jobs in Vizag', (h) => h.includes('"name":"IT Jobs in Vizag"')],
      ]);
    },
  },
  {
    name: '/jobs/fresher -> Fresher CollectionPage SEO',
    fn: async (mw) => {
      installFetchMock({});
      const res = await mw(makeRequest('/jobs/fresher'));
      await expectInjected(res, [
        ['title is Fresher-specific', (h) => h.includes('Fresher Jobs in Vizag')],
        ['canonical is /jobs/fresher', (h) => h.includes('href="https://jobsinvizag.in/jobs/fresher"')],
      ]);
    },
  },
  {
    name: '/jobs/part-time -> Part-time CollectionPage SEO',
    fn: async (mw) => {
      installFetchMock({});
      const res = await mw(makeRequest('/jobs/part-time'));
      await expectInjected(res, [
        ['title is Part-time-specific', (h) => h.includes('Part-time Jobs in Vizag')],
        ['canonical is /jobs/part-time', (h) => h.includes('href="https://jobsinvizag.in/jobs/part-time"')],
      ]);
    },
  },
  {
    name: '/blog -> Blog SEO',
    fn: async (mw) => {
      installFetchMock({});
      const res = await mw(makeRequest('/blog'));
      await expectInjected(res, [
        ['title is Blog-specific', (h) => h.includes('Vizag Jobs Blog')],
        ['Schema @type is Blog', (h) => h.includes('"@type":"Blog"')],
        ['canonical is /blog', (h) => h.includes('href="https://jobsinvizag.in/blog"')],
      ]);
    },
  },
  {
    name: '/blog/<real-slug> -> BlogPosting SEO',
    fn: async (mw) => {
      installFetchMock({ posts: [realPost] });
      const res = await mw(makeRequest(`/blog/${realPost.slug}`));
      await expectInjected(res, [
        ['title contains post title', (h) => h.includes('How to find jobs in Vizag | Vizag Jobs Blog')],
        ['BlogPosting JSON-LD present', (h) => h.includes('"@type":"BlogPosting"')],
        ['datePublished present', (h) => h.includes('"datePublished":"2026-05-20T10:00:00.000Z"')],
        ['canonical is /blog/<slug>', (h) => h.includes(`href="https://jobsinvizag.in/blog/${realPost.slug}"`)],
        ['og:type is article', (h) => h.includes('property="og:type" content="article"')],
      ]);
    },
  },
  {
    name: '/blog/<missing-slug> -> falls through, no schema',
    fn: async (mw) => {
      installFetchMock({ posts: [] });
      const res = await mw(makeRequest('/blog/does-not-exist'));
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(!html.includes('"@type":"BlogPosting"'), 'should NOT inject BlogPosting');
    },
  },
  {
    name: '/jobs/<segment>/<slug> canonical -> JobPosting + breadcrumb SEO',
    fn: async (mw) => {
      installFetchMock({ jobs: [realJob] });
      const res = await mw(makeRequest(`/jobs/${realJob.segment}/${realJob.slug}`));
      await expectInjected(res, [
        ['title contains job + employer', (h) => h.includes(realJob.title) && h.includes(realJob.company)],
        ['JobPosting JSON-LD present', (h) => h.includes('"@type":"JobPosting"')],
        ['BreadcrumbList JSON-LD present', (h) => h.includes('"@type":"BreadcrumbList"')],
      ]);
    },
  },
  {
    name: '/jobs/<wrong-segment>/<slug> -> 301 to canonical',
    fn: async (mw) => {
      installFetchMock({ jobs: [realJob] });
      const res = await mw(makeRequest(`/jobs/wrong-segment/${realJob.slug}`));
      assert.equal(res.status, 301);
      assert.match(res.headers.get('location') || '', new RegExp(`/jobs/${realJob.segment}/${realJob.slug}$`));
    },
  },
  {
    name: '/jobs/<legacy-slug> -> 301 to /jobs/<segment>/<slug>',
    fn: async (mw) => {
      installFetchMock({ jobs: [realJob] });
      const res = await mw(makeRequest(`/jobs/${realJob.slug}`));
      assert.equal(res.status, 301);
      assert.match(res.headers.get('location') || '', new RegExp(`/jobs/${realJob.segment}/${realJob.slug}$`));
    },
  },
  {
    name: '/job/<id> -> 301 to /jobs/<segment>/<slug>',
    fn: async (mw) => {
      installFetchMock({ jobs: [realJob] });
      const res = await mw(makeRequest(`/job/${realJob.id}`));
      assert.equal(res.status, 301);
      assert.match(res.headers.get('location') || '', new RegExp(`/jobs/${realJob.segment}/${realJob.slug}$`));
    },
  },
];

console.log('\nMiddleware integration smoke test\n----------------------------------');
for (const c of cases) {
  const middleware = await importFresh();
  try {
    await c.fn(middleware);
    log(c.name, true);
  } catch (err) {
    failed += 1;
    log(c.name, false);
    console.log('       error:', err.message);
  }
}

fs.rmSync(mjsPath, { force: true });

console.log('\n----------------------------------');
console.log(failed === 0 ? `All ${cases.length} cases passed.` : `${failed}/${cases.length} cases FAILED.`);
process.exit(failed === 0 ? 0 : 1);
