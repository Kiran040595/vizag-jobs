# Student registration

Lean student accounts for job seekers in Vizag. Designed to stay within Supabase **free tier** database limits (~500 MB).

## Student features

- Register at `/student/register` with a **complete profile** across three steps (personal/account, education, career preferences):
  - Full name, college, degree, branch, graduation year
  - Email, mobile, password
  - Fresher yes/no
  - **Target sectors** (up to three), plus separate **interested roles** (multiple selections)
  - **Primary target role** (autocomplete from the same live role list), **role experience level**, **availability**
  - **Preferred work locations** (Vizag-first chips: Visakhapatnam, Gajuwaka, Remote, …)
  - Skills (multi-select, stored lowercase for matching)
  - Optional certifications / courses completed
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


## Structured candidate eligibility (October 2026)

Student profiles now store `current_city`, `current_area`, `education_status` (`studying`/`completed`), optional `gender`, nullable `willing_to_relocate`, and `interested_roles` (text array). New fields are optional for existing accounts and do not change their completion state. School qualifications automatically use `Not Applicable` for branch. Certifications can be empty. Registration and profile editing use sectors separately from specific roles; existing mixed category values are retained because their original intent cannot safely be inferred.

Jobs now store `accepted_degrees`, `accepted_branches`, `required_education_status`, `required_experience`, `required_skills`, `preferred_skills`, `required_candidate_locations`, `accepts_relocation`, and `requirements_verified`. Both admin and employer forms use the same controls and serialization. Empty restrictions mean any; employers/admins must explicitly mark requirements reviewed before they are evaluated. Imported and old jobs default to unverified.

`candidateEligibility.js` evaluates mandatory requirements independently of recommendation scoring. Alternatives within a qualification/branch/location list use OR; separate requirements use AND. It returns eligible, ineligible, needs_information, or unverified. Residence uses exact normalized city/locality matching (Vizag/Visakhapatnam aliases); preferred work locations never establish residence. Relocation is accepted only when both job and candidate explicitly allow it. Required skills are mandatory; preferred skills affect ranking. Gender is excluded from eligibility, ranking, and export fields; only owner/admin profile access applies under existing RLS.

Recommendations omit known ineligible jobs, retain unknown results with a profile-completion link, and label legacy eligibility as unverified. The job details page displays eligibility without blocking applications. The admin student list supports current city, education status, relocation, and optional gender filters, plus a reviewed-job selector. The job detail page links admins to matching candidates. Exports include the new non-demographic fields as optional columns.

### Database rollout

Apply `supabase/migrations/20261008090000_candidate_eligibility.sql` **before deploying the frontend**. It adds columns, defaults, constraints, indexes, and refreshes the PostgREST schema cache, without rewriting old records or changing RLS. The frontend selects the new job columns explicitly, so deploying before migration will cause job queries to fail. Inspect pending migrations with `npx supabase db push --linked --dry-run` before running the normal migration deployment. Do not assume a migration file has been applied to the linked database.

### Verification

Run `node --test tests/*.test.mjs`, `npm run lint`, and `npx vite build`. The eligibility regression tests cover mandatory/alternative education, diploma-only jobs, studying/completed status, required skills, experience, current residence versus preferences, relocation, missing facts, legacy jobs, admin profile mapping, secondary roles, and optional demographics.
