# Student registration (phase 1)

Lean student accounts for fresher job seekers in Vizag. Designed to stay within Supabase **free tier** database limits (~500 MB).

## Student features (phase 1)

- Register at `/student/register` (name, college, **email and mobile**, password)
- Sign in at `/student/login` with **email + password**
- **Apply Now** requires sign-in **and** a complete student profile
- Complete profile at `/student/profile` — **all fields mandatory**:
  - Degree, branch, graduation year (dropdowns)
  - Mobile number
  - Skills (multi-select, stored lowercase for matching)
  - Fresher yes/no
  - Certifications / courses completed
- Admin list at `/admin/students` (shows complete vs incomplete profiles)

### Mobile sign-in (no SMS)

Registration collects **both email and mobile**. Sign-in uses your email and password. Mobile is stored on your profile for recruiters.

### Apply gate

Visitors who click **Apply Now** without a session are sent to `/student/login?next=…&apply=1`. After sign-in they return to the job and the apply link opens automatically.

### Consent (registration)

Students must agree at registration (stored with timestamps on `student_profiles`):

- Terms of Service and Privacy Policy
- Sharing profile with matching employers in Vizag
- Information is accurate
- Age 18 or older

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
