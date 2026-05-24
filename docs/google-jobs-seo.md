# Google Jobs Schema + Edge SEO

This project injects `JobPosting` JSON-LD on job detail pages using Vercel Edge Middleware so Googlebot receives structured data in the initial HTML response (before React hydrates).

## How it works

1. **Gemini Make SEO** (external jobs) returns `json_ld` in `seo_meta` during admin review.
2. **Publish** persists `json_ld` and `seo_meta` to `public.jobs` (see migration `20260524_add_jobs_json_ld_seo.sql`).
3. **Employer-posted jobs** without Gemini output get a fallback `JobPosting` built at render time from job columns (`src/lib/jobPostingSchema.js`).
4. **Vercel Edge Middleware** (`middleware.ts`) intercepts `/jobs/:segment/:slug` and `/job/:id`, fetches the job from Supabase, and injects meta tags + JSON-LD into `index.html`.

## Required Vercel environment variables

Edge middleware **cannot** read `VITE_*` variables (those are client-bundled at build time). Add these in the Vercel project dashboard (**Settings → Environment Variables**) for **Production** and **Preview**:

| Variable | Value |
|----------|--------|
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Same as `VITE_SUPABASE_ANON_KEY` |
| `SITE_URL` | `https://jobsinvizag.in` (optional; defaults to production domain) |
| `SUPABASE_JOBS_TABLE` | `jobs` (optional; only if your table name differs) |

Using the CLI:

```bash
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SITE_URL production
```

Redeploy after adding env vars so middleware picks them up.

## Database migration

Run in Supabase SQL Editor:

```
supabase/migrations/20260524_add_jobs_json_ld_seo.sql
```

Adds:

- `json_ld jsonb` — persisted Gemini `JobPosting` schema
- `seo_meta jsonb` — hashtags, keyword density, Gemini metadata

## Post-deploy validation

1. Publish or pick an existing job URL, e.g. `https://jobsinvizag.in/jobs/it/software-engineer-jobs-visakhapatnam-example`.
2. **View page source** (not DevTools Elements) and confirm `<script type="application/ld+json">` with `"@type":"JobPosting"` appears in `<head>`.
3. Run [Google Rich Results Test](https://search.google.com/test/rich-results) on:
   - One Gemini-optimized external job (has `json_ld` in DB)
   - One employer-posted job (fallback schema from columns)
   - One expired job (should show `noindex` meta)
4. In [Google Search Console](https://search.google.com/search-console), resubmit `https://jobsinvizag.in/sitemap.xml`.
5. Monitor **Enhancements → Job postings** for valid/invalid counts over the next 1–2 weeks.

## Legacy URLs

- `/job/:id` → 301 redirect to canonical `/jobs/:segment/:slug`
- Non-canonical segment/slug combinations → 301 to canonical path from `getJobDetailPath`
