# Supabase Setup

This project now expects a Supabase table named `jobs` with snake_case column names.

## 1. Create the Supabase project

1. Create a new project in Supabase.
2. Open `SQL Editor`.
3. Run [20260427_create_jobs_schema.sql](/D:/School%20Project/VIzagJobs/supabase/migrations/20260427_create_jobs_schema.sql).
4. Run [20260503_add_admin_jobs_policies.sql](/D:/School%20Project/VIzagJobs/supabase/migrations/20260503_add_admin_jobs_policies.sql) to add admin allowlisting and write policies.
5. Run [20260515_employer_job_posting.sql](/D:/School%20Project/VIzagJobs/supabase/migrations/20260515_employer_job_posting.sql) for employer profiles, pending job submissions, and employer RLS.
6. Optionally run [seed.sql](/D:/School%20Project/VIzagJobs/supabase/seed.sql) to add two sample jobs.

## 2. Add frontend env values

Update [.env](/D:/School%20Project/VIzagJobs/.env) with:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_JOBS_TABLE=jobs
```

You can find these in Supabase:

- `Project Settings -> API -> Project URL`
- `Project Settings -> API -> anon public key`

## 3. Add jobs

You have two simple options:

1. Insert rows manually in `Table Editor -> jobs`.
2. Import a CSV based on [jobs-import-template.csv](/D:/School%20Project/VIzagJobs/supabase/jobs-import-template.csv).

For CSV imports:

- Keep `responsibilities`, `eligibility`, and `skills` as pipe-separated values in the CSV first.
- After import, convert those columns to proper Postgres arrays if you use a custom import pipeline.
- If you import directly in the Supabase table editor, entering JSON-style arrays such as `{"React","JavaScript"}` is more reliable than pipe-separated text.

## 4. Recommended data rules

- Keep `status` as `published` for visible jobs.
- Use `draft` for jobs you do not want visible yet.
- Use unique `slug` values for cleaner future URLs and easier admin handling.
- Set `posted_at` explicitly when importing old jobs so newest jobs sort correctly.

## 5. Current frontend mapping

The frontend reads these database columns:

- `title`
- `company`
- `location`
- `category`
- `job_type`
- `work_mode`
- `experience`
- `is_fresher`
- `salary`
- `apply_link`
- `short_description`
- `description`
- `responsibilities`
- `eligibility`
- `warning`
- `posted_at`
- `source_name`
- `source_url`
- `skills`
- `company_logo_url`
- `status`

## 6. Employer accounts and job approval

Employers can sign up at `/employer/register`, complete their company profile, and submit jobs as `pending`. Admins review submissions at `/admin/jobs` and use **Approve** (publishes to the portal) or **Reject** (archives with an optional reason).

### Supabase Auth settings (fixes localhost redirects in production)

Email confirmation links use Supabase **URL Configuration**, not only your app code.

1. Open **Authentication -> URL Configuration** in the Supabase dashboard.
2. Set **Site URL** to your live site (not localhost):
   - `https://jobsinvizag.in`
3. Under **Redirect URLs**, add every URL Supabase may send users to (wildcards allowed):
   - `https://jobsinvizag.in/**`
   - `https://www.jobsinvizag.in/**` (if you use www)
   - `http://localhost:5173/**` (local dev only)
4. Enable the **Email** provider in `Authentication -> Providers`.
5. **Confirm email** (optional for now): leave **disabled** in Supabase so employers can sign in immediately after register. Set `VITE_REQUIRE_EMAIL_CONFIRMATION=true` in the app only if you turn confirm email on later.

If **Site URL** is still `http://localhost:5173`, confirmation emails will keep redirecting to localhost even when users register on production.

### Vercel / production env

Set in Vercel (or your host) **before** redeploying:

```env
VITE_SITE_URL=https://jobsinvizag.in
```

The employer sign-up flow passes `emailRedirectTo` using this value so confirmation links target `/employer/login` on your live domain.

After changing Supabase URL settings or env vars, **redeploy** the frontend and register a **new** test user (old emails still contain old links).

### Google sign-in for employers (Sign in with Google)

This is **not** the same as **Authentication → OAuth Server** in the dashboard. Use **Providers → Google** for employer login.

1. **Authentication → URL Configuration**
   - Site URL: `https://jobsinvizag.in`
   - Redirect URLs: `https://jobsinvizag.in/**`, `http://localhost:5173/**`
2. In [Google Cloud Console](https://console.cloud.google.com/), create OAuth credentials (Web application).
3. Add **Authorized JavaScript origins**: `https://jobsinvizag.in`, `http://localhost:5173`
4. Add **Authorized redirect URI** (from Supabase **Providers → Google**):  
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. **Authentication → Providers → Google**: enable, paste Client ID and Client Secret.
6. **Sign in with Google** appears on `/employer/login` and `/employer/register` (no env flag required).

### Supabase OAuth Server (`/oauth/consent`)

If you enabled **Authentication → OAuth Server** with authorization path `/oauth/consent` and Site URL `https://jobsinvizag.in`, the app serves that page at [https://jobsinvizag.in/oauth/consent](https://jobsinvizag.in/oauth/consent).

Users sign in (employer account) then approve or deny third-party OAuth clients. When `@supabase/supabase-js` exposes `auth.oauth.*` in your installed version, approve/deny works automatically after deploy.

### Self-service employer signup

When a user registers, a row is created automatically in `public.employer_profiles` from signup metadata (`company_name`).

### Manual employer setup (invite-only)

1. Create the user in **Authentication -> Users** (or ask them to register).
2. Insert or update their profile:

```sql
insert into public.employer_profiles (user_id, company_name, contact_email, is_active)
values ('auth-user-uuid', 'Company Name Pvt Ltd', 'hr@company.com', true)
on conflict (user_id) do update
set company_name = excluded.company_name,
    contact_email = excluded.contact_email,
    is_active = true;
```

## 7. External job fetch (Edge Function)

The admin **Fetch external jobs** page (`/admin/fetch`) calls the Supabase Edge Function **`fetch-external-jobs`** with one source per button.

**Per-source fetch** — `POST` with `{ "mode": "fetch", "fetch_channel": "naukri" }` (or `linkedin_jobs`, `linkedin_posts`, `vizag_it`, `indeed`). Only that source runs. Use channel-specific secrets (below) to spread API load across keys.

**LinkedIn Posts presets** — for `fetch_channel: "linkedin_posts"`, add `linkedin_post_preset`: `general` (default), `it`, `bank`, or `custom`. For `custom`, also send `linkedin_custom_search_url` (full LinkedIn content search URL with past-24h filter). The admin fetch page uses a single **LinkedIn Posts** card with a preset dropdown. Response `filters_applied` includes `linkedin_post_preset`, `linkedin_post_preset_label`, and `linkedin_search_queries_used`; each job may carry the same preset fields for review badges.

The **Existing Jobs** page links to `/admin/fetch` for discovery; manage published listings stays on `/admin/jobs`.

**Admin workflow (two steps):**

1. **Fetch external jobs** — `POST` with `{ "mode": "fetch" }` (default). **Apify** (when `APIFY_API_TOKEN` is set) fetches LinkedIn [jobs in Vishakhapatnam, past 24h](https://in.linkedin.com/jobs/jobs-in-vishakhapatnam?keywords=&location=Vishakhapatnam&geoId=106055329&distance=25&f_TPR=r86400&position=1&pageNum=0) and [Vizag content posts, past 24h](https://www.linkedin.com/search/results/content/?keywords=vizag&origin=CLUSTER_EXPANSION&datePosted=%5B%22past-24h%22%5D). Posts are parsed with **Gemini** when `GEMINI_API_KEY` is set. Naukri still uses **Firecrawl**. Each job has `seo_optimized: false` until step 2.
2. **Make SEO** (per card in admin) — `POST` with `{ "mode": "seo", "job": { ... }, "seo_source_context": "..." }`. One Gemini call per job using the **8-task Vizag SEO prompt** (title, meta, slug, Markdown description + FAQs, JSON-LD JobPosting, hashtags, keyword density). Output extras appear in `seo_meta` on the review card. Requires **`GEMINI_API_KEY`** (optional **`GEMINI_API_KEYS`** for failover).
3. **Approve & publish** — inserts via `createAdminJob` (same as manual form). Publishing without SEO shows a warning only (not blocked).

**Fetch pipeline details:**

- **LinkedIn (Apify):** Default when `APIFY_API_TOKEN` is set. Runs two Store actors (IDs configurable): jobs listing URL + content search URL. Response includes `linkedin_provider: "apify"`, `apify_jobs_count`, `apify_posts_count`. Set **`FETCH_JOB_SOURCES=linkedin`** for LinkedIn-only.
- **LinkedIn (Firecrawl fallback):** Set `FETCH_LINKEDIN_PROVIDER=firecrawl` or `FETCH_LINKEDIN_FALLBACK_FIRECRAWL=true` when Apify returns nothing.
- **Naukri:** Unchanged — Firecrawl only (`FETCH_JOB_SOURCES=both` requires `FIRECRAWL_API_KEY`).
- **Naukri:** Firecrawl `site:naukri.com/job-listings` search — only **single job detail** pages are kept (search/hub SERP pages are skipped; embedded listings on a SERP are scraped instead).
- **`jobs[]`:** By default only roles with **`posted_at` within the last 24 hours** (`FETCH_REQUIRE_POSTED_WITHIN_24H=true`). Undated roles go to `jobs_undated`.
- **`FETCH_JOB_SOURCES`:** Set to `linkedin` to fetch **LinkedIn only** (no Naukri). Values: `linkedin`, `naukri`, `both` (default).
- **Sources:** **`linkedin.com`** and **`naukri.com`** detail URLs only.
- **Area:** Visakhapatnam / Vizag / Andhra context, or verified detail apply URLs.
- **`jobs` array:** Scraped + mapped listings (raw copy until you run Make SEO).
- **Diagnostics:** `detail_job_urls_discovered`, `scrape_stats`, `gemini_status: "skipped"` on fetch.
- **Optional:** `FETCH_JOB_DETAIL_SCRAPE_LIMIT` (default **12**, max **20**).

**Secrets (recommended):** `APIFY_API_TOKEN` (LinkedIn), `GEMINI_API_KEY` (post parsing + Make SEO). For Naukri or fallback: `FIRECRAWL_API_KEY`.

**Apify setup:** Create an account at [apify.com](https://apify.com), copy your **API token** from Integrations → API, and add it as `APIFY_API_TOKEN`. Each fetch runs up to **two** actor runs (jobs + posts); cost depends on your chosen Store actors (typically a few cents per run on free/paid plans).

**Multiple Gemini accounts (quota failover):** Set `GEMINI_API_KEY` to your primary key. Add extra keys from other Google accounts as comma-separated values in `GEMINI_API_KEYS` (e.g. `AIza...account2,AIza...account3`). Make SEO tries key 1, then key 2, etc., and within each key tries fallback models on quota errors. Remove `GEMINI_SEO_MODEL` if it is set to a depleted model like `gemini-2.0-flash-lite`.

Source code: [`supabase/functions/fetch-external-jobs/index.ts`](../supabase/functions/fetch-external-jobs/index.ts), [`apify-linkedin.ts`](../supabase/functions/fetch-external-jobs/apify-linkedin.ts).

### Step 1 — Confirm the function exists in the Dashboard

Before debugging Firecrawl or Gemini, make sure Supabase actually has this Edge Function deployed.

1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and select **your project** (the same project whose URL and anon key you put in `.env`).
2. In the left sidebar, open **Edge Functions**.
3. Look at the list of functions.

**What you should see**

| Dashboard list | Meaning |
|----------------|---------|
| **`fetch-external-jobs` appears** | Deploy succeeded (or someone deployed it already). Continue with secrets below and retry **Fetch external jobs** in the admin UI. |
| **It does not appear / list is empty** | Nothing has been deployed yet (this matches errors such as **404** or “could not reach” from the admin panel). Go to **Step 2** and deploy from your PC. |

The slug **must** be exactly `fetch-external-jobs` (hyphens, lowercase). That matches the folder name under `supabase/functions/` and the URL path `/functions/v1/fetch-external-jobs`.

### Step 2 — Deploy `fetch-external-jobs` from your computer

Do this once per project (and again whenever you change the function code).

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) if you don’t have it.
2. In a terminal, log in and link **this** project (replace `YOUR_PROJECT_REF` with **Project ID / reference** from Supabase → **Settings → General**):

```bash
supabase login
cd path/to/VIzagJobs
supabase link --project-ref YOUR_PROJECT_REF
```

3. Deploy the function:

```bash
supabase functions deploy fetch-external-jobs --no-verify-jwt
```

4. **Verify again:** Dashboard → **Edge Functions** → you should now see **`fetch-external-jobs`** in the list. Open it if you want to check logs after calling **Fetch external jobs** from the admin site.

(`verify_jwt` is disabled in [`supabase/config.toml`](../supabase/config.toml) because the function validates either an admin session JWT or an optional cron secret.)

### Secrets (Dashboard → Edge Functions → Secrets, or CLI)

| Secret | Purpose |
|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Usually injected automatically on hosted Supabase; required for `auth.getUser` + `admin_users` checks if missing locally. |
| `APIFY_API_TOKEN` | **LinkedIn fetch (recommended).** Apify API token from [Apify Console → Integrations](https://console.apify.com/account/integrations). |
| `APIFY_API_TOKEN_LINKEDIN_JOBS` | Optional. Apify token used only for **LinkedIn Jobs** channel (`fetch_channel=linkedin_jobs`). |
| `APIFY_API_TOKEN_LINKEDIN_POSTS` | Optional. Apify token used only for **LinkedIn Posts** channel. |
| `FIRECRAWL_API_KEY_NAUKRI` | Optional. Firecrawl key for **Naukri** channel only. |
| `FIRECRAWL_API_KEY_LINKEDIN_JOBS` | Optional. Firecrawl fallback for LinkedIn jobs listing. |
| `FIRECRAWL_API_KEY_LINKEDIN_POSTS` | Optional. Firecrawl fallback for LinkedIn posts. |
| `FIRECRAWL_API_KEY_VIZAG_IT` | Optional. Firecrawl key for **Vizag IT companies** channel. |
| `FIRECRAWL_API_KEY_INDEED` | Optional. Firecrawl key for **Indeed** channel. |
| `GEMINI_API_KEY_LINKEDIN_POSTS` | Optional. Gemini key for parsing LinkedIn posts to jobs. |
| `GEMINI_API_KEY_SEO` | Optional. Gemini key for **Make SEO** on review cards. |
| `FETCH_LINKEDIN_PROVIDER` | `apify` (default if token set), `firecrawl`, or `apify_then_firecrawl`. |
| `APIFY_LINKEDIN_JOBS_ACTOR` | Jobs actor (default `curious_coder~linkedin-jobs-scraper` — uses your Vizag jobs listing URL). |
| `APIFY_LINKEDIN_JOBS_ACTOR_FALLBACK` | Second jobs actor if first fails (default `harvestapi~linkedin-job-search`). |
| `APIFY_LINKEDIN_VIZAG_POSTS_ACTOR` | LinkedIn **Posts** actor slug (default **`harvestapi~linkedin-post-search`**). Sync API: `POST https://api.apify.com/v2/acts/harvestapi~linkedin-post-search/run-sync-get-dataset-items`. Console actor id: [buIWk2uOUzTmcLsuB](https://console.apify.com/actors/buIWk2uOUzTmcLsuB). |
| `APIFY_LINKEDIN_POSTS_ACTOR` | Optional override — use **`harvestapi~linkedin-post-search`** only. Do **not** use `curious_coder~linkedin-post-search-scraper` (`urls` input). |
| `FETCH_LINKEDIN_POST_SEARCH_QUERIES` | Comma-separated searches for harvestapi posts actor (general default: **`jobs in vizag,#VizagJobs`**). |
| `FETCH_LINKEDIN_POST_SEARCH` | Override with a **single** search string (replaces the query list). |
| `FETCH_LINKEDIN_CONTENT_POSTS_LIMIT` | Max posts to map and parse after Apify (default **20**). `maxPosts` per search query is half of this (e.g. **10** × 2 queries ≈ 20 raw items). |
| `FETCH_LINKEDIN_POST_SEARCH_PAGE` | `startPage` for harvestapi actor (default **1**). |
| `FETCH_LINKEDIN_POSTS_EXTRA_ACTORS` | Set `true` to allow fallback actors after `buIWk2uOUzTmcLsuB` on general preset (default **false** — avoids duplicate runs with 50+ unrelated posts). |
| `FETCH_LINKEDIN_POST_SEARCH_PAGE` | Page number for Vizag posts actor (default **1**). |
| `APIFY_LINKEDIN_POSTS_ACTOR` | Override posts actor for all presets. If unset, general uses `APIFY_LINKEDIN_VIZAG_POSTS_ACTOR`, then falls back to **`harvestapi~linkedin-post-search`**. |
| `APIFY_LINKEDIN_POSTS_ACTOR_FALLBACK` | Second posts actor (default `curious_coder~linkedin-post-search-scraper`; requires rental + often cookies). |
| `APIFY_LINKEDIN_POSTS_COOKIE_JSON` | Only for **curious_coder** content-URL scraper. Not needed for harvestapi. |
| `APIFY_LINKEDIN_USER_AGENT` | Optional browser user-agent string passed to the posts actor. |
| `APIFY_LINKEDIN_JOBS_INPUT_JSON` | Optional full JSON input override for jobs actor. |
| `FETCH_LINKEDIN_POSTS_ONLY` | Set `true` to skip formal `/jobs/view/` listing scrape and fetch **only** LinkedIn posts (vizag + past 24h content URLs). |
| `FETCH_LINKEDIN_POSTS_PRIORITY` | Run posts actor before jobs listing (default **true**). |
| `APIFY_LINKEDIN_POSTS_INPUT_JSON` | Optional full JSON input override for posts actor. |
| `APIFY_SYNC_TIMEOUT_SEC` | Max wait per Apify sync run (default **60–90**). |
| `FETCH_LINKEDIN_FALLBACK_FIRECRAWL` | If Apify returns 0 items, try Firecrawl LinkedIn scrape (default **true**). |
| `FETCH_LINKEDIN_FALLBACK_FIRECRAWL_POSTS` | If Apify posts are 0, try Firecrawl content URLs. Default **false** when `APIFY_API_TOKEN_LINKEDIN_POSTS` is set (Firecrawl blocks linkedin.com). Set `true` only to opt in. |
| `FIRECRAWL_API_KEY` | Required for **Naukri** (`FETCH_JOB_SOURCES=both` or `naukri`). LinkedIn fallback. |
| `FIRECRAWL_API_KEYS` | Optional. Extra Firecrawl keys (comma- or newline-separated). Each search/scrape picks a **random** key order; on 429/503/quota errors the next key is tried automatically. |
| `SCRAPFLY_API_KEY` | Fallback if Firecrawl is not set; requires `SCRAPFLY_SCRAPE_URLS` (comma-separated URLs to scrape). |
| `SCRAPFLY_SCRAPE_URLS` | e.g. `https://example.com/jobs-vizag,https://other.com/listings` |
| `GEMINI_API_KEY` | **Required for Make SEO** (not for fetch). Primary Gemini API key. |
| `GEMINI_API_KEYS` | Optional. Extra keys (comma- or newline-separated) from other Google accounts. **Shuffled per Make SEO request**; on 429/503/quota the next key and fallback model are tried. |
| `FETCH_LINKEDIN_JOBS_LISTING_24H` | Scrape Vishakhapatnam jobs SERP with `f_TPR=r86400` (default **true**). |
| `FETCH_LINKEDIN_JOBS_LISTING_URL` | Override jobs listing URL (default: `in.linkedin.com/jobs/jobs-in-vishakhapatnam?...f_TPR=r86400`). |
| `FETCH_LINKEDIN_JOBS_LISTING_LIMIT` | Max jobs parsed from listing page (default **20**). |
| `FETCH_LINKEDIN_CONTENT_24H` | Set `false` to disable LinkedIn content-search discovery (default **true**). |
| `FETCH_LINKEDIN_CONTENT_KEYWORDS` | Comma-separated keywords for content search (default `vizag,visakhapatnam,jobs vizag`). |
| `FETCH_LINKEDIN_CONTENT_URL` | Override general preset content-search URL (same as built-in Vizag 24h URL). |
| `FETCH_LINKEDIN_POST_PRESET_IT_URL` | Optional full LinkedIn content SERP URL for **IT** preset (admin dropdown). |
| `FETCH_LINKEDIN_POST_PRESET_BANK_URL` | Optional full LinkedIn content SERP URL for **Bank** preset. |
| `FETCH_LINKEDIN_POST_PRESETS_JSON` | Optional JSON map to override preset `keywords`, `urls`, `label`, or `categoryDefault` per id (`general`, `it`, `bank`). |
| `FETCH_LINKEDIN_CONTENT_PAGES` | Max content SERP pages to scrape per run (default **3**, max **5**). |
| `FETCH_JOB_SOURCES` | `linkedin` (LinkedIn only), `naukri`, or `both` (default). |
| `FETCH_REQUIRE_POSTED_WITHIN_24H` | Set `false` to include jobs without a parsed `posted_at` in `jobs[]` (default **true**). |
| `FETCH_LINKEDIN_SCRAPE_WAIT_MS` | Extra wait for LinkedIn pages in Firecrawl (default **4000**). |
| `FETCH_LINKEDIN_CONTENT_POSTS` | Set `false` to skip hiring-post extraction from the content feed (default **true**). |
| `FETCH_LINKEDIN_CONTENT_POSTS_LIMIT` | Max hiring posts per fetch (default **20**). Response includes `apify_posts_raw_count` (dataset items) and `apify_posts_count` (after Vizag/hiring filters). |
| `FETCH_LINKEDIN_SEARCH_POSTS` | Firecrawl-only: web search for `site:linkedin.com/posts` when feed scrape is empty (default **false**; set `true` for Firecrawl path). |
| `FETCH_LINKEDIN_SEARCH_LIMIT` | Results per hiring search query (default **5**). |
| `FETCH_LINKEDIN_SKIP_JOB_VIEW_SCRAPE` | Skip `/jobs/view/` scrapes when posts were found (default **true**). |
| `GEMINI_MODEL` | Optional override for batch/legacy paths (default **`gemini-2.5-flash`**). |
| `GEMINI_SEO_MODEL` | Model for **Make SEO** (default **`gemini-2.5-flash`**). Do not set `gemini-2.0-flash-lite` unless that model still has quota. |
| `GEMINI_SEO_FALLBACK_MODELS` | Comma-separated fallbacks if primary returns 429 quota (default `gemini-2.5-flash,gemini-2.0-flash`). |
| `GEMINI_SEO_TRY_FALLBACK_MODELS` | Set `false` to disable model fallback on quota errors (default **true**). |
| `GEMINI_SEO_TIMEOUT_MS` | Per-request Gemini timeout for Make SEO (default **72000** ms). |
| `GEMINI_SEO_MAX_RETRIES` | Retries per key+model on 429/overload before trying the next key (default **2** = 3 attempts with backoff). |
| `GEMINI_MAX_RETRIES` | Retries for batch/legacy Gemini (default **4**). |
| `FETCH_JOB_DETAIL_SCRAPE_LIMIT` | Max job URLs scraped per run (default **6**, max **20**). Lower this if you see HTTP **546**. |
| `FETCH_JOB_SEO_LIMIT` | Max jobs sent to Gemini SEO (defaults to scrape limit). |
| `FETCH_JOB_SEO_BATCH_SIZE` | Jobs per Gemini call (default **4**). Batching avoids timeouts. |
| `FETCH_JOB_MAX_RUNTIME_MS` | Stop early before platform kill (default **110000** ms). |
| `FETCH_JOB_FULL_DISCOVER` | Set `true` for slower hub crawl; default is fast search-only discovery. |
| `FIRECRAWL_TIMEOUT_MS` | Per-request Firecrawl timeout (default **20000**). |
| `FETCH_JOB_SEARCH_QUERIES` | Optional comma-separated Firecrawl queries (defaults to **LinkedIn + Naukri** Vizag/Visakhapatnam `site:` searches only). |
| `FETCH_JOB_SEARCH_LIMIT` | Optional max results per query (default `6`). |
| `FETCH_JOB_SCRAPE_PAGE_LIMIT` | Optional max **hub / SERP** URLs to fully scrape before mining for detail links (default `10`, max `20`). |
| `FETCH_JOB_DETAIL_SCRAPE_LIMIT` | Max individual job detail URLs to scrape per run (default `24`, max `45`). |
| `FETCH_JOBS_CRON_SECRET` | Optional long random string for scheduled runs (see below). |

### Frontend env

No secrets in Vite. Optionally set `VITE_SUPABASE_FUNCTIONS_URL` if your functions base URL differs from `{VITE_SUPABASE_URL}/functions/v1/fetch-external-jobs`.

### Scheduled runs (optional)

If `FETCH_JOBS_CRON_SECRET` is set, automation can call the same endpoint **without** an admin user JWT:

- Send header `x-fetch-jobs-cron-secret: <same value>` **or** `Authorization: Bearer <same value>`.
- Always include your public `apikey` header (anon key) like normal Supabase Edge Function calls.

Example:

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/fetch-external-jobs" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $FETCH_JOBS_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

Persisting snapshots (e.g. private Storage or email) is not implemented in-repo; pipe or store the JSON in your scheduler.

### Compliance

Respect third-party site terms and robots rules; prefer licensed APIs or feeds where possible.

## 8. Notes

- Public users can only read `published` jobs because RLS is enabled.
- Employer submissions stay hidden until an admin approves them (`pending` -> `published`).
- The app includes `/admin/login` for allowlisted admins and `/employer/login` for companies.
- Create the admin user in Supabase Auth first, then allowlist it in `public.admin_users`.
- Example admin allowlist insert:

```sql
insert into public.admin_users (user_id)
values ('your-auth-user-uuid');
```
