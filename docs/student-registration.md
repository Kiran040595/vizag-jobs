# Student registration

Lean student accounts for job seekers in Vizag. Designed to stay within Supabase **free tier** database limits (~500 MB).

## Student features

- Register at `/student/register` with a **complete profile** in one step:
  - Full name, college, degree, branch, graduation year
  - Email, mobile, password
  - Fresher yes/no
  - **Target roles** (multi-select chips live from currently published `jobs.role` values via `distinct_job_roles()`; students can still type a custom role)
  - **Primary target role** (autocomplete from the same live role list), **role experience level**, **availability**
  - **Preferred work locations** (Vizag-first chips: Visakhapatnam, Gajuwaka, Remote, …)
  - Skills (multi-select, stored lowercase for matching)
  - Certifications / courses completed
  - Optional expected salary min/max
  - Registration consents
- Sign in at `/student/login` with **email + password**
- **Apply Now** requires sign-in **and** a complete student profile (new accounts are complete at register)
- Update profile anytime at `/student/profile`
- Resume / CV upload on apply (new uploads → Cloudflare R2 with `r2:` path prefix; older files stay in Supabase Storage `student-resumes`; path stored on `student_profiles.resume_path`)
- On-platform applications with status tracking (`job_applications`)
- Admin list at `/admin/students` (complete vs incomplete, search by skills/categories/roles)
- Signed-in students with a complete profile see **Jobs matching your profile** on the home page (ranked by target roles, skills, fresher fit, and preferred locations)

### Live role targeting

When admins/employers post a job they set a **Role** field (`jobs.role`). Published roles are exposed by the SQL function `distinct_job_roles()` and shown as chips on student registration/profile. Newly posted roles become selectable immediately — no admin approval queue. Matching in `src/lib/studentJobMatch.js` scores exact role-slug matches first, then falls back to title-token overlap for older data.

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

Email confirmation is **not** required. Students are signed in immediately after register (`supabase/config.toml` has `enable_confirmations = false`, and a DB trigger auto-confirms student auth users).

## Personalized job matching

Matching data is collected at registration (and editable on the profile). Ranking lives in `src/lib/studentJobMatch.js`:

- Scores published jobs on target-role slug match against `jobs.role` (with title-token fallback), skill tokens, fresher-friendly flag, preferred locations, and primary role text
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
| -------- | ---------------- |
| 1 SEO job | 20–40 KB |
| 1 student profile | ~5–7 KB (with auth row) |
| 6,000 jobs + 20,000 students | ~300 MB |

Monitor **Database size** in Supabase → Project Settings → Usage.
