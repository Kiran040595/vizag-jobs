# Student registration

Lean student accounts for job seekers in Vizag. Designed to stay within Supabase **free tier** database limits (~500 MB).

## Student features

- Register at `/student/register` (name, college, **email and mobile**, password) — lean signup only
- Sign in at `/student/login` with **email + password**
- **Apply Now** requires sign-in **and** a complete student profile
- Complete profile at `/student/profile` — required for applying:
  - Degree, branch, graduation year (dropdowns)
  - Mobile number
  - Fresher yes/no
  - **Target job categories** (multi-select chips: frontend, BPO, mechanical, etc.)
  - **Primary target role**, **role experience level**, **availability**
  - **Preferred work locations** (Vizag-first chips: Visakhapatnam, Gajuwaka, Remote, …)
  - Skills (multi-select, stored lowercase for matching)
  - Certifications / courses completed
  - Optional expected salary min/max
- Resume / CV upload on apply (Supabase Storage; path stored on `student_profiles.resume_path`)
- On-platform applications with status tracking (`job_applications`)
- Admin list at `/admin/students` (complete vs incomplete, search by skills/categories/roles)
- Signed-in students with a complete profile see **Jobs matching your profile** on the home page (ranked by category, skills, fresher fit, location, and target role)

### Mobile sign-in (no SMS)

Registration collects **both email and mobile**. Sign-in uses your email and password. Mobile is stored on your profile for recruiters.

### Apply gate

Visitors who click **Apply Now** without a session are sent to `/student/login?next=…&apply=1`. After sign-in they return to the job and the apply link opens automatically.

### Full job details gate

Visitors who click **Full Job Details** (or open a job URL directly) without a student session are sent to `/student/login?next=…`. They can sign in or create an account; after auth they return to the complete job page. Admins and employers already signed in can still open full details.

### Consent (registration)

Students must agree at registration (stored with timestamps on `student_profiles`):

- Terms of Service and Privacy Policy
- Sharing profile with matching employers in Vizag
- Information is accurate
- Age 18 or older

## Personalized job matching

Matching data is collected on the profile. Ranking lives in `src/lib/studentJobMatch.js`:

- Bridges student categories (`software_frontend`, `telecaller_bpo`, …) to job categories (`IT & Software`, `BPO / Customer Support`, …)
- Scores published jobs on category overlap, skill tokens, fresher-friendly flag, preferred locations, and primary role text in the job title
- Home page surfaces the top ranked jobs for complete student profiles only; guests keep public filters unchanged

Admin student search remains the ops path for finding candidates by skill/category text.

## Deferred (later)

- Saved jobs synced to account (still browser `localStorage` via `savedJobs.js`)
- Email job alerts
- Employer talent-pool browser (filter applicants by skill/category beyond status)

## Database

- Table: `student_profiles` (see `supabase/migrations/20260710_job_retention_and_student_profiles.sql` plus later migrations for certifications, consent, resume path, career preferences)
- Career prefs migration: `supabase/migrations/20260721_student_career_preferences.sql`
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
