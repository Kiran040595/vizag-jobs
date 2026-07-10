# Student registration (phase 1)

Lean student accounts for fresher job seekers in Vizag. Designed to stay within Supabase **free tier** database limits (~500 MB).

## Student features (phase 1)

- Register at `/student/register` (name, college, email, password)
- Complete profile at `/student/profile` (degree, branch, graduation year, skills, phone)
- Admin list at `/admin/students`

## Deferred (phase 2)

These are **not** implemented yet to avoid filling the 1 GB Storage bucket and adding complexity:

- Resume / CV upload (Supabase Storage)
- Saved jobs synced to account (still browser `localStorage` via `savedJobs.js`)
- Email job alerts
- Apply tracking through the portal

Revisit phase 2 when job retention is running and database size is monitored in the Supabase dashboard.

## Database

- Table: `student_profiles` (see `supabase/migrations/20260710_job_retention_and_student_profiles.sql`)
- Signup metadata: `user_type: 'student'` in `auth.users.raw_user_meta_data`
- Employer signups use `user_type: 'employer'` (default when omitted)

## Job retention (free tier)

Published jobs older than **90 days** are archived (heavy SEO fields cleared). Archived jobs older than **180 days** are deleted.

- Config: `src/lib/jobRetention.js`
- Cron script: `node scripts/prune-stale-jobs.mjs`
- GitHub Actions: `.github/workflows/job-retention-weekly.yml` (Sundays)

## Capacity (rough)

| Records | Approx. DB use |
|---------|----------------|
| 1 SEO job | 20–40 KB |
| 1 student profile | ~5–7 KB (with auth row) |
| 6,000 jobs + 20,000 students | ~300 MB |

Monitor **Database size** in Supabase → Project Settings → Usage.
