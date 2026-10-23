# Student registration

## Candidate discovery workflow (2026-10-23)

Admin Students is a candidate finder rather than a long list of account details.
Start with **Required skills**, choose **All selected skills** or **Any selected
skill**, select alternative qualifications, and enter part of the desired role.
For example, React + SQL (All), B.Tech or B.E, and role containing Developer
narrows candidates using their recorded facts. Current city searches residence;
preferred work locations are shown separately and never establish residence.

The finder also supports the actual registration experience buckets, joining
availability, exact primary/secondary role, career sector, branch, batch,
education status, relocation, certification/course, account status, and missing
matching information. Existing saved qualifications not in the current presets
remain selectable. General search matches words across fields, recognizes common
qualification/skill spellings, and supports quoted phrases. Specific required
skills keep C, C++, C#, Java and JavaScript distinct.

Candidate cards put qualifications, desired role, location, experience, joining
time and skills first. They explain matching criteria and show missing facts.
Contact information and the complete profile are expandable. Reviewed-job checks
separate recorded requirement matches, missing information and known failures;
they are screening aids, not hiring decisions. Gender is not a targeting or
sorting criterion. Active accounts are the default, with explicit all/inactive
options. Filter URLs survive reload; page size is bounded to 25/50/100 candidates.

Export matching downloads exactly the current results. A visit-only shortlist
can be built across pages and filters, then exported separately. The UI discloses
shortlisted candidates hidden by current filters. Skill/role/sector counts follow
account status; other criteria further narrow results. Failed pagination no
longer silently omits students or permits a partial new export.

New signups must explicitly provide current city, education status, fresher versus
experienced, role experience, and joining availability alongside the existing
qualification, skills and desired-role requirements. No fresher, experienced
duration, or immediate-joining answer is guessed. Existing profiles remain valid;
missing facts are shown in the finder, including field-specific missing-data
filters. These facts must be supplied by the student rather than inferred from
work preferences or administrative flags.

Registration stays on the form until profile persistence completes. If auth
succeeds but profile saving fails, the error and input remain visible; retry
records consent and saves the existing student's profile without another signup.

Verification and limitations are in `docs/SCREEN_FUNCTIONALITY_TEST_TRACKER.md`
under QA-2026-10-23-Candidate-Discovery. No schema migration is required for this
finder update. Production student profiles were not changed during verification.

## Shared student role catalog (2026-10-23)

Saving a student profile captures its primary target role and interested roles in
`public.student_role_catalog` in the same database transaction. Existing profiles
are backfilled by `supabase/migrations/20261023120000_shared_student_roles.sql`.
Labels are deduplicated by case and whitespace, while punctuation is preserved
(C++ and C# remain different roles). The catalog retains previously entered labels
when a student changes roles. It contains role labels only, with no student IDs,
contact details, or candidate counts exposed publicly.

Registration and profile editing call `student_role_suggestions(search_text,
limit_count)` as the primary role is typed. Search is applied before limiting
results, so a rare role outside the initial suggestions remains discoverable on
another browser/device. Published job roles are included. Browser-local role
history is only a convenience, not the shared source. If the migration is missing
or the database is unavailable, existing job/preset suggestions and manual entry
remain usable; cross-student reuse requires the migration.

Admin Students has an all-role selector covering primary and secondary roles,
including roles outside the twelve shortcut chips. Counts deduplicate each
candidate per role. The role chips, selector, and role-specific Excel shortcut use
the same matching rules and include registered candidates regardless of active
status. Other filters can further narrow the main list; its normal filtered export
uses that narrowed list. The role-chip Excel shortcut exports that whole role group.
Candidate details display both the primary role and all interested roles.

### Deployment and acceptance

The linked project is `fbyyfyhdglcpkhxskffj` (`supabase-citrine-cloud`). On 2026-10-23,
after explicit user approval, deployed only this migration with
`npx supabase db query --linked --file supabase/migrations/20261023120000_shared_student_roles.sql`
and recorded only version `20261023120000` as applied using
`npx supabase migration repair --linked --status applied 20261023120000`.
The normal migration dry run had exposed pre-existing remote/local history
differences; unrelated history and pending migrations were left unchanged.

Deployment checks found 729 catalog role labels, zero missing backfill roles,
the profile capture trigger enabled, catalog RLS enabled, direct catalog access
denied, and suggestion execution granted to anonymous/authenticated callers.
`node scripts/verify-shared-student-roles.mjs` passed against the deployed public
API with independent stateless requests, role-only result fields, deduplication,
the 200-result cap, and direct catalog access denied. This script is read-only
and prints no role labels, credentials, or student information. Frontend code
was pushed to `origin/develop` in `fd313e9`; frontend release follows the normal
release flow.

Local verification:

- `node --test tests/*.test.mjs`: 158 tests passed.
- `node scripts/test-shared-student-roles.mjs <path-to-@electric-sql/pglite/dist/index.js>`:
  executes the actual migration against PostgreSQL with fixtures and verifies
  backfill, insert/update triggers, independent anonymous/authenticated reads,
  deduplication, more than 200 roles, rare-role search, punctuation, rollback,
  published-job-only suggestions, and denial of direct table reads/writes.
- Lint and production bundle build are recorded in the functionality tracker.

Full acceptance still requires authenticated browser
journeys: register/save a new role in browser A, find it during registration in
browser B with no shared browser storage, verify the new candidate in Admin
Students, filter a primary and secondary role, compare exports and counts, and
repeat with a role outside the top twelve. Repeat the affected layouts at mobile
widths. Local automated checks are not a full registration/admin E2E pass.

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
