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

### Supabase Auth settings

1. Enable the **Email** provider in `Authentication -> Providers`.
2. Set **Site URL** to your production URL (for example `https://jobsinvizag.in`).
3. Add redirect URLs for `/employer/login` and `/employer/register` if you use email confirmation.
4. For production, enable **Confirm email** so only verified employers can sign in.

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

## 7. Notes

- Public users can only read `published` jobs because RLS is enabled.
- Employer submissions stay hidden until an admin approves them (`pending` -> `published`).
- The app includes `/admin/login` for allowlisted admins and `/employer/login` for companies.
- Create the admin user in Supabase Auth first, then allowlist it in `public.admin_users`.
- Example admin allowlist insert:

```sql
insert into public.admin_users (user_id)
values ('your-auth-user-uuid');
```
