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

The admin **Existing Jobs** page includes **Fetch external jobs**, which calls a Supabase Edge Function named **`fetch-external-jobs`**. It uses **Firecrawl** (preferred) or **Scrapfly**, and optionally **Google Gemini** to turn crawled text into structured JSON. Results are **preview-only** (nothing is written to `jobs`).

Source code for this function lives in the repo at [`supabase/functions/fetch-external-jobs/index.ts`](../supabase/functions/fetch-external-jobs/index.ts).

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
| `FIRECRAWL_API_KEY` | Enable Firecrawl search/scrape (recommended). |
| `SCRAPFLY_API_KEY` | Fallback if Firecrawl is not set; requires `SCRAPFLY_SCRAPE_URLS` (comma-separated URLs to scrape). |
| `SCRAPFLY_SCRAPE_URLS` | e.g. `https://example.com/jobs-vizag,https://other.com/listings` |
| `GEMINI_API_KEY` | Optional; improves structured extraction. Without it, the function returns a simple row per search/scrape hit. |
| `GEMINI_MODEL` | Optional override (default `gemini-2.0-flash`). |
| `FETCH_JOB_SEARCH_QUERIES` | Optional comma-separated Firecrawl queries (defaults to Vizag-focused searches). |
| `FETCH_JOB_SEARCH_LIMIT` | Optional max results per query (default `6`). |
| `FETCH_JOB_SCRAPE_PAGE_LIMIT` | Optional max listing URLs to **fully scrape** for markdown per request (default `10`, max `20`). Higher = more individual roles parsed, slower and more Firecrawl usage. |
| `FETCH_JOB_MAX_GEMINI_CHUNKS` | Optional max Gemini calls per request when context is split into chunks (default `4`, max `8`). |
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
