# Google Search Console — "Discovered, currently not indexed" analysis

**Date:** 2026-05-24
**Branch:** `analysis/gsc-discovered-not-indexed`
**Status reported by GSC:** 134 affected URLs, validation started 2026-05-02
**TL;DR:** Three production issues — two critical configuration bugs causing 404s on top URLs, and limited SEO middleware coverage. Fixing the first two will most likely clear the GSC backlog within 1–4 weeks.

---

## Live production probe results

| URL | Status | Issue |
|---|---|---|
| `/` | 200 OK | Works |
| `/jobs/accounts/sales-associate-...` (job detail) | 200 OK | **Working with full JSON-LD + meta tags** — middleware deployed |
| `/sitemap.xml` | 200 OK | Working |
| `/robots.txt` | 200 OK | Working |
| `/jobs` | **404** | Listing page broken — main "All Jobs" landing page |
| `/blog` | **404** | Blog list broken — listed in sitemap |
| `/blog/:slug` | **404** | All blog posts broken |
| `/jobs/it` | **308 → /job/it** (also 404) | IT category page broken |
| `/jobs/fresher` | **308 → /job/fresher** (also 404) | Fresher category page broken |
| `/jobs/part-time` | **308 → /job/part-time** (also 404) | Part-time category page broken |

The Edge Middleware is **already deployed and working** on job detail pages — those return proper `<title>`, meta description, canonical, OG tags, JobPosting JSON-LD, and BreadcrumbList JSON-LD on first byte.

---

## Why GSC reports "Discovered, currently not indexed"

Google's algorithm marks URLs this way when it has *seen* them (via sitemap/links) but **chosen not to crawl/index** them. The two strongest negative signals on this site:

### Signal 1: Broken HTTP responses on landing/category/blog URLs

When Googlebot fetches `/jobs`, `/blog`, `/blog/:slug`, `/jobs/it`, `/jobs/fresher`, `/jobs/part-time`, it gets **404** or **308 → 404**. Google can't index 404s. These URLs are in your sitemap, so Google retries them — and each retry confirms 404.

### Signal 2: Historical thin/duplicate content on job pages (now resolved)

Before the SEO fix that you just deployed, every job detail URL returned the **same** SPA shell HTML with the homepage `<title>` and no per-page content. Google's classifier marks identical-looking URLs as duplicate/thin → "Discovered, currently not indexed."

This is now fixed for job detail pages — the new edge middleware injects unique `<title>`, description, canonical, JobPosting JSON-LD, and BreadcrumbList per URL on first byte. But:

- Google needs **1–4 weeks** to re-crawl 134 URLs
- The "Validation started 5/2/26" timestamp is from a **previous validation request** — your recent fix won't be measured against it. You'll need to click "Validate Fix" again now.

---

## Root cause analysis

### Root cause #1: `vercel.json` legacy redirect catches category URLs

[`vercel.json`](../vercel.json) lines 23–27:

```23:27:vercel.json
{
  "source": "/jobs/:jobId",
  "destination": "/job/:jobId",
  "permanent": true
},
```

This was added when job URLs were single-segment (`/jobs/<id>`). But the React Router config in [`src/App.jsx`](../src/App.jsx) now uses **two-segment** URLs (`/jobs/:jobSegment/:jobSlug`), with single-segment `/jobs/<segment>` reserved for category landing pages:

```111:115:src/App.jsx
<Route path="/jobs/it" element={<ItJobsInVizagPage />} />
<Route path="/jobs/fresher" element={<FresherJobsInVizagPage />} />
<Route path="/jobs/part-time" element={<PartTimeJobsVizagPage />} />
```

**Effect of the redirect:**
- `/jobs/it` matches `:jobId = "it"` → 308 to `/job/it`
- `/jobs/fresher` → 308 to `/job/fresher`
- `/jobs/part-time` → 308 to `/job/part-time`

The destinations then 404 because there's no job in the DB with id `it`, `fresher`, or `part-time`, and the SPA shows "Job not found."

The `/job/:id` legacy redirect is now handled correctly by [`middleware.ts`](../middleware.ts) (it does a real Supabase lookup and 301s to the canonical URL only when a job actually exists). The vercel.json rule is **redundant and harmful**.

### Root cause #2: No SPA fallback rewrite in `vercel.json`

Vercel only serves static files from the build output. For an SPA, every client-side route must rewrite to `/index.html` so React Router can take over. Your [`vercel.json`](../vercel.json) has only `redirects`, no `rewrites`.

- `/` → `index.html` exists → 200
- `/jobs` → no `jobs/index.html` → **404**
- `/blog` → no `blog/index.html` → **404**
- `/blog/why-vizag-is-becoming-indias-next-data-center-hub` → no file → **404**

The Edge Middleware accidentally rescues only the routes it explicitly matches (`/jobs/:segment/:slug` and `/job/:id`) by calling `fetch(new URL('/index.html', req.url))` and serving the shell back. Everything else 404s.

### Root cause #3: Edge middleware doesn't cover blog/listing/category pages

Current `matcher` in [`middleware.ts`](../middleware.ts):

```ts
export const config = { matcher: ['/jobs/:segment/:slug', '/job/:id'] };
```

After fixing root causes #1 and #2, the listing/blog pages will start serving the SPA shell with **no per-page SEO** — they'd hydrate via `react-helmet-async` after JS runs, which is the same weak signal that caused this problem in the first place.

---

## Fix plan (priority ordered)

### P0 — Production 404 fix (5 minutes)

Update [`vercel.json`](../vercel.json):

1. **Remove** the broken redirect:
   ```json
   { "source": "/jobs/:jobId", "destination": "/job/:jobId", "permanent": true }
   ```
   The middleware now handles legacy `/job/:id` URLs correctly.

2. **Add** SPA fallback rewrites:
   ```json
   {
     "rewrites": [
       { "source": "/((?!api/|assets/|_next/|favicon|robots\\.txt|sitemap\\.xml|manifest|sw\\.js|workbox|registerSW|.*\\.[a-z0-9]+).*)", "destination": "/index.html" }
     ]
   }
   ```

After this single change, `/jobs`, `/blog`, `/blog/:slug`, `/jobs/it`, `/jobs/fresher`, `/jobs/part-time` will all return 200 (serving the SPA shell, hydrating client-side).

### P1 — Extend middleware to cover all SEO-critical pages

Extend [`middleware.ts`](../middleware.ts) matcher to also inject per-page SEO for:

- `/jobs` → `<title>Jobs in Vizag</title>` + `CollectionPage` JSON-LD
- `/jobs/it` → `<title>IT Jobs in Vizag</title>` + `CollectionPage` JSON-LD
- `/jobs/fresher` → `<title>Fresher Jobs in Vizag</title>` + `CollectionPage` JSON-LD
- `/jobs/part-time` → `<title>Part-time Jobs in Vizag</title>` + `CollectionPage` JSON-LD
- `/blog` → `<title>Vizag Jobs Blog</title>` + `Blog` JSON-LD
- `/blog/:slug` → per-post `<title>` + `BlogPosting` JSON-LD (fetches blog post from Supabase)

This is similar to the existing job-detail middleware path. Add a new schema builder `src/lib/blogPostingSchema.js` and `src/lib/collectionPageSchema.js`.

### P2 — Search Console actions

Once P0 is deployed:

1. **GSC → Sitemaps** → confirm `https://jobsinvizag.in/sitemap.xml` is submitted (currently shows 296 URLs)
2. **GSC → Pages → Discovered, currently not indexed → Validate Fix** (this restarts Google's evaluation against the new content)
3. **GSC → URL Inspection** → for top 5–10 priority URLs (popular categories, recently-published jobs), click "Request Indexing"
4. Wait 1–4 weeks. Re-crawling takes time, and Google needs to see consistent improvements before promoting URLs from "Discovered" to "Indexed"

### P3 — Long-term SEO improvements (already partially done)

- ✓ `JobPosting` JSON-LD on job detail pages (deployed)
- ✓ `BreadcrumbList` JSON-LD on job detail pages (deployed)
- ✓ Per-job `<title>`, description, canonical (deployed)
- ✓ `noindex` for expired jobs (deployed)
- Pending: Add `BlogPosting` schema for blog
- Pending: Add `CollectionPage` / `ItemList` schema for listing pages
- Pending: Some real jobs have `Company: Unknown` — improve scraper data quality

---

## How to verify after deploying P0

```bash
# Each should return 200, not 404 or 308
curl -I https://jobsinvizag.in/jobs
curl -I https://jobsinvizag.in/blog
curl -I https://jobsinvizag.in/blog/why-vizag-is-becoming-indias-next-data-center-hub
curl -I https://jobsinvizag.in/jobs/it
curl -I https://jobsinvizag.in/jobs/fresher
curl -I https://jobsinvizag.in/jobs/part-time
```

Then in GSC:
- "Pages" → "Discovered, currently not indexed" → click "Validate Fix"
- "URL Inspection" tool → paste a sample URL → "Test Live URL" → confirm "URL is available to Google"
