# Supabase Setup

This project now expects a Supabase table named `jobs` with snake_case column names.

## 1. Create the Supabase project

1. Create a new project in Supabase.
2. Open `SQL Editor`.
3. Run [20260427_create_jobs_schema.sql](/D:/School%20Project/VIzagJobs/supabase/migrations/20260427_create_jobs_schema.sql).
4. Run [20260503_add_admin_jobs_policies.sql](/D:/School%20Project/VIzagJobs/supabase/migrations/20260503_add_admin_jobs_policies.sql) to add admin allowlisting and write policies.
5. Optionally run [seed.sql](/D:/School%20Project/VIzagJobs/supabase/seed.sql) to add two sample jobs.

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

## 6. Notes

- Public users can only read `published` jobs because RLS is enabled.
- The app now includes `/admin/login` and `/admin` for allowlisted admins.
- Create the admin user in Supabase Auth first, then allowlist it in `public.admin_users`.
- Example allowlist insert:

```sql
insert into public.admin_users (user_id)
values ('your-auth-user-uuid');
```
