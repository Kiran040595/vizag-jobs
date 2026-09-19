# JobsInVizag — Android Feature Specification

**Product:** JobsInVizag.in (Vizag Jobs)  
**Purpose of this document:** Feature inventory and implementation guide for building a native Android app that mirrors the existing web application.  
**Backend:** Supabase (Auth, Postgres, Storage, Edge Functions)  
**Web stack reference:** React + Vite (`/workspace`)  
**Document version:** 1.0  
**Base branch reference:** `develop`

---

## 1. Product overview

JobsInVizag is a **local job portal for Visakhapatnam (Vizag)**. Users browse published jobs, filter by category/type/freshness, save jobs, share listings, ask questions on jobs, and (as students) register, upload a resume, and apply. Employers post jobs (pending admin approval) and review applications. Admins moderate jobs, users, blogs, and feedback.

**Public site:** `https://jobsinvizag.in`  
**Public job window:** only jobs with `posted_at` within the **last 30 days** are shown in public lists.

### Android scope recommendation

| Priority | Scope | Include in Android MVP? |
|----------|--------|-------------------------|
| P0 | Guest browse, search, filters, job detail, share, dial, WhatsApp | Yes |
| P0 | Student auth, profile, resume, apply, applied jobs | Yes |
| P1 | Saved jobs (local or account-synced) | Yes |
| P1 | Job Q&A (ask + view published answers) | Optional |
| P1 | Employer auth, post/edit job, applications inbox | If employer app is in scope |
| P2 | Blog reading | Optional |
| P2 | Site feedback | Optional |
| Out of scope (web/admin only) | Admin console, external job fetch, SEO/blog automation, YouTube Shorts, AdSense, PWA, cookie banner | Defer / keep on web |

---

## 2. User roles

| Role | Identification | Capabilities |
|------|----------------|--------------|
| **Guest** | No Supabase session | Browse jobs, search/filter/paginate, save jobs locally, share, ask job questions, read blogs, submit feedback. Apply redirects to student login. |
| **Student (job seeker)** | Row in `student_profiles` with `is_active = true` | Register/login, edit profile, upload resume, apply to `apply_mode = internal` jobs, track applications, see “Jobs for you”, receive application status notifications. |
| **Employer** | Row in `employer_profiles` with `is_active = true` | Register/login, company profile, post/edit **pending** jobs, review applicants, answer questions on own jobs. |
| **Admin** | Row in `admin_users` | Full moderation on web. **Not required for Android MVP.** |

Auth metadata: `raw_user_meta_data.user_type` = `'student'` or `'employer'`. Wrong-role login must be rejected (sign out if profile table does not match).

---

## 3. Suggested Android screens (map from web routes)

### 3.1 Public / guest

| Screen | Web route | Notes |
|--------|-----------|--------|
| Home / Jobs feed | `/` | Search, filters, list, Jobs for You (if student), categories |
| All jobs | `/jobs` | Listing landing |
| Category landings | `/jobs/it`, `/jobs/fresher`, `/jobs/part-time`, `/jobs/civil`, … | Same filters + category preselected |
| Latest / Instagram jobs | `/jobs/latest` | Jobs with `is_instagram = true` |
| Job detail | `/jobs/:segment/:slug`, `/job/:slug`, `/jobs/:id` | Full details + Apply + Share |
| Saved jobs | `/saved-jobs` | Local bookmarks (web uses `localStorage`) |
| Blog list / post | `/blog`, `/blog/:slug` | Optional |
| About / Contact | `/about`, `/contact` | Optional |
| Feedback | `/feedback` | Optional |
| Legal | `/privacy-policy`, `/terms-of-service`, `/disclaimer` | Required for Play Store |

### 3.2 Student

| Screen | Web route |
|--------|-----------|
| Login | `/student/login` |
| Register | `/student/register` |
| Forgot password | `/student/forgot-password` |
| Reset password | `/student/reset-password` |
| Profile | `/student/profile` |
| Applied jobs | `/student/applied-jobs` |
| Apply to job | `/student/apply/:jobId` |

### 3.3 Employer (optional module)

| Screen | Web route |
|--------|-----------|
| Login / Register / Forgot / Reset | `/employer/...` |
| Profile | `/employer/profile` |
| My jobs | `/employer/jobs` |
| New / Edit job | `/employer/jobs/new`, `/employer/jobs/:jobId/edit` |
| Applications | `/employer/jobs/:jobId/applications` |

---

## 4. Job browsing features (P0)

### 4.1 Search

- Query param / state: `q`
- Match (AND of tokens) against: title, company, skills, short description, category, location, experience
- Debounce ~300ms recommended

### 4.2 Filters

| Filter | Values |
|--------|--------|
| **Category** | `all`, taxonomy ids (`it`, `civil`, `mechanical`, `electrical`, `ece`, `banking`, `bpo`, `sales`, `hr`, `healthcare`, `education`, `hospitality`, `logistics`, …), plus `engineering`, `non-it`, `fresher`, `walk-in` |
| **Job type** | `all`, `full-time`, `part-time`, `internship`, `contract` |
| **Freshness** | `all`, `24h`, `7d`, `30d` (relative to `postedAt`) |

URL-style state on web: `q`, `category`, `jobType`, `freshness`, `page`.

### 4.3 Sort & pagination

- **Sort:** featured first (`is_featured`), then newest `posted_at`
- **Page size:** 12
- **Public window:** `posted_at` within last 30 days

### 4.4 Category landing pages

| Path | Focus |
|------|--------|
| `/jobs/it` | IT & Software |
| `/jobs/fresher` | Fresher-friendly |
| `/jobs/part-time` | Part-time |
| `/jobs/civil` | Civil / construction |
| `/jobs/mechanical` | Mechanical / production |
| `/jobs/electrical` | Electrical |
| `/jobs/ece` | ECE |
| `/jobs/engineering` | Broad engineering |
| `/jobs/banking` | Banking / finance |
| `/jobs/bpo` | BPO / customer support |
| `/jobs/sales` | Sales / marketing |
| `/jobs/hr` | HR |
| `/jobs/healthcare` | Healthcare |
| `/jobs/education` | Education / teaching |
| `/jobs/hospitality` | Hospitality / retail |
| `/jobs/logistics` | Logistics / delivery |

### 4.5 Save job

- Web: browser `localStorage` key `vizagjobs:saved-jobs` (not synced to account yet)
- Snapshot fields: `id`, `slug`, `title`, `company`, `location`, `jobPath`, `savedAt`
- **Android:** use Room / DataStore; optional future sync to account

### 4.6 Apply behavior

| `apply_mode` | Behavior |
|--------------|----------|
| `external` | Open `apply_link` in Custom Tab / browser; may show join-channel prompt if `group_link` set |
| `internal` | Navigate to Apply screen; requires student session + complete profile + employer-share consent |

Unauthenticated Apply → login with return path (`next=…&apply=1`), then continue apply flow.

### 4.7 Share & contact

- Native share (Android Sharesheet)
- WhatsApp share (`wa.me/?text=…`)
- Telegram share (optional)
- Copy link
- Phone dial: `tel:+91…`
- WhatsApp contact on applicant/recruiter phones: `wa.me/91…`

### 4.8 Similar jobs & Jobs for you

- **Similar jobs:** up to 6, scored by category segment, category, skills, job type, fresher, company, location
- **Jobs for you:** top **8** for signed-in students with complete profile (category, skills, fresher fit, preferred locations, primary target role)

### 4.9 Job questions (optional P1)

- Guests/students can ask a question (name, email, body)
- Published Q&A shown on detail
- Employers/admins moderate on web (answer / publish / ignore / delete)

---

## 5. Student features (P0)

### 5.1 Authentication

- **Method:** email + password (`signInWithPassword`)
- **Login identifier:** email **or** Indian mobile (lookup maps phone → email); **no SMS OTP**
- **Registration:** always uses real email; phone stored on profile
- **No Google/OAuth for students**
- Email confirmation is **disabled** (students signed in immediately after register)
- Signup metadata: `user_type: 'student'`, `full_name`, `college`, `phone`, `auth_method: 'email'`
- Forgot / reset password flows required

### 5.2 Registration & profile fields

#### Required for complete profile (`profileComplete`)

| Field | Rules |
|-------|--------|
| `full_name` | Required |
| `college` | Required |
| `degree` | From degree options |
| `branch` | From branch options |
| `graduation_year` | Year |
| `phone` | Indian mobile: +91, starts 6–9 |
| `skills` | Array, ≥ 1 (stored lowercase for matching) |
| `certifications` | Array, ≥ 1 |
| `is_fresher` | Boolean |
| `target_job_categories` | Array, 1–8 |
| `primary_target_role` | Text |
| `role_experience_level` | Enum (below) |
| `availability` | Enum (below) |
| `preferred_locations` | Array, ≥ 1 |
| Consents | All four timestamps set |

#### Optional

- `expected_salary_min`, `expected_salary_max`
- `contact_email`
- `resume_path`

#### Degree options

`10th Pass`, `12th Pass`, `Diploma`, `B.Tech`, `B.E`, `B.Sc`, `B.Com`, `BBA`, `BCA`, `MCA`, `M.Tech`, `MBA`, `Other`

#### Branch options

`CSE`, `IT`, `ECE`, `EEE`, `Mechanical`, `Civil`, `Chemical`, `Automobile`, `Commerce`, `Accounting & Finance`, `Business Administration`, `Science`, `Arts/Humanities`, `Not Applicable`

#### Target job categories (chips)

`software_frontend`, `software_backend`, `software_full_stack`, `data_analytics`, `testing_qa`, `telecaller_bpo`, `customer_support`, `sales_marketing`, `digital_marketing`, `accounting_finance`, `mechanical_production`, `electrical_electronics`, `civil_construction`, `medical_healthcare`, `pharma_lab`, `delivery_logistics`, `operations_admin`, `teaching_training`, `retail_hospitality`, `other` (+ custom snake_case tokens allowed)

#### Role experience level

`fresher` | `0_6_months` | `6_12_months` | `1_2_years` | `2_4_years` | `4_plus_years`

#### Availability

`immediate` | `within_15_days` | `within_30_days` | `more_than_30_days`

#### Preferred locations (chips)

`Visakhapatnam`, `Vizag`, `Gajuwaka`, `Madhurawada`, `Anakapalle`, `Remote`, `Hybrid`, `Other (Andhra Pradesh)`

#### Registration consents (store timestamps)

1. Terms of Service and Privacy Policy (`consent_terms_at`)
2. Share profile with matching employers in Vizag (`consent_share_with_employers_at`)
3. Information is accurate (`consent_accurate_info_at`)
4. Age 18 or older (`consent_age_18_at`)

### 5.3 Resume upload

- Supabase Storage bucket: `student-resumes`
- Max size: **5 MB**
- Types: `.pdf`, `.doc`, `.docx`
- Path stored on `student_profiles.resume_path`; reused when applying

### 5.4 Applications

**Statuses:** `applied` | `viewed` | `processing` | `hired` | `rejected` | `withdrawn`  
(Legacy map: `submitted` → `applied`, `shortlisted` → `processing`)

**Student filters on Applied Jobs:** All / Applied / Viewed / Processing / Hired / Rejected

**Apply form:**

- Cover note
- Resume file **or** reuse saved resume
- Unique constraint: `(job_id, student_user_id)` — one application per job

**Profile snapshot at apply** (stored on `job_applications.profile_snapshot`):

`fullName`, `college`, `degree`, `branch`, `graduationYear`, `phone`, `contactEmail`, `skills`, `certifications`, `isFresher`, `targetJobCategories`, `primaryTargetRole`, `roleExperienceLevel`, `preferredLocations`, `availability`, `expectedSalaryMin`, `expectedSalaryMax`

**After apply:** optional modal to join WhatsApp/Telegram via job `group_link`.

**Notifications:** status changes create `reply_notifications` kind `application_status`.

### 5.5 Apply gate

1. User taps Apply without session → Login (`next=…&apply=1`)
2. After login, if profile incomplete → Profile
3. Then open Apply screen (internal) or external link (external)

---

## 6. Employer features (P1 / optional)

### 6.1 Auth

- Email + password
- Signup with company name → `user_type: 'employer'`
- Google OAuth exists in code but is **hidden** (`SHOW_EMPLOYER_GOOGLE_AUTH = false`) — do not rely on it for Android unless product enables it
- Forgot / reset password

### 6.2 Profile (`employer_profiles`)

| Field | Notes |
|-------|--------|
| `company_name` | Required |
| `contact_name` | |
| `contact_email` | |
| `phone` | |
| `website` | |
| `company_logo_url` | |
| `is_active` | Must be true to use portal |

### 6.3 Jobs

- Default `apply_mode: 'internal'`
- New employer jobs forced `status: 'pending'`, `is_featured: false`
- Employer can edit only while `pending` / `draft`; resubmit clears review fields
- Admin must approve → `published` before public visibility
- Applications inbox: update status (`applied` / `viewed` / `processing` / `hired` / `rejected`)
- Resume signed URLs / share links; WhatsApp + Call on applicant phone
- New application → notification kind `new_application`
- Moderate questions on own jobs

---

## 7. Admin features (out of scope for Android)

Keep on web admin console:

- Job CRUD, approve/reject, feature, Instagram flag, group link
- Assign jobs to employers / move to admin
- Students & employers activate/deactivate
- Blog CMS + Gemini daily generate
- Feedback moderation
- External fetch (Naukri / LinkedIn) + SEO optimize
- YouTube Shorts automation

---

## 8. Content & misc features

| Feature | Behavior | Android |
|---------|----------|---------|
| Blog | Public list + markdown posts | Optional read-only |
| Instagram / latest jobs | `is_instagram = true` list | Optional tab |
| About / Contact | Static; contact email `kkumardadi@gmail.com` | Optional |
| Feedback | Types: `feature_request`, `problem`, `general` | Optional |
| Legal pages | Privacy, Terms, Disclaimer | Required for store listing |
| Cookie consent / AdSense / Analytics | Web-only | Use Play-compliant privacy + analytics |
| PWA / service worker | Web install | Skip — native shell |

---

## 9. Data models (Supabase)

### 9.1 `jobs`

| Column | Type / notes |
|--------|----------------|
| `id` | UUID |
| `slug` | Unique URL slug |
| `title` | Text |
| `company` | Text |
| `location` | Default Visakhapatnam |
| `category` | Text (e.g. IT & Software) |
| `job_type` | full-time / part-time / internship / contract |
| `work_mode` | Optional (hide vague values in UI if placeholder) |
| `experience` | Text |
| `is_fresher` | Boolean / Yes-No in UI |
| `salary` | Text |
| `apply_link` | URL for external apply |
| `apply_mode` | `external` \| `internal` |
| `short_description` | Card/overview blurb |
| `description` | Markdown body |
| `responsibilities` | Text[] |
| `eligibility` | Text[] |
| `warning` | Optional banner |
| `posted_at` | Timestamptz |
| `expires_at` | Optional |
| `source_name`, `source_url` | Attribution |
| `skills` | Text[] |
| `company_logo_url` | Optional |
| `status` | `draft` \| `pending` \| `published` \| `archived` |
| `is_featured` | Boolean |
| `is_instagram` | Boolean |
| `group_link` | WhatsApp/Telegram group URL |
| `created_by` | Auth user id |
| `reviewed_at`, `reviewed_by`, `rejection_reason` | Moderation |
| `json_ld`, `seo_meta` | SEO (web) |
| `search_document` | Search helper |
| timestamps | `created_at`, `updated_at` |

### 9.2 `student_profiles`

`user_id`, `full_name`, `college`, `degree`, `branch`, `graduation_year`, `contact_email`, `phone`, `skills[]`, `certifications[]`, `is_fresher`, `is_active`, `resume_path`, career preference fields (section 5.2), consent timestamps, timestamps.

### 9.3 `employer_profiles`

`user_id`, `company_name`, `contact_name`, `contact_email`, `phone`, `website`, `company_logo_url`, `is_active`, timestamps.

### 9.4 `job_applications`

`id`, `job_id`, `student_user_id`, `status`, `cover_note`, `resume_path`, `resume_share_token`, `profile_snapshot` (JSONB), `submitted_at`, `updated_at`  
Unique: `(job_id, student_user_id)`.

### 9.5 `job_questions`

`asker_name`, `asker_email`, `asker_user_id`, `body`, `status` (`pending` \| `published` \| `ignored` \| `deleted`), `answer_body`, answer/publish metadata.

### 9.6 `site_feedback`

`feedback_type`, author fields, `body`, `page_url`, `wants_public`, `status`, `admin_reply`, `author_user_id`.

### 9.7 `blog_posts`

`slug`, `title`, `excerpt`, `body`, `status` (`draft` \| `published` \| `archived`), `published_at`.

### 9.8 `reply_notifications`

Kinds: `job_question`, `site_feedback`, `application_status`, `new_application`.

### 9.9 Saved jobs

**No server table** — client-only on web. Android should persist locally (or add a future `saved_jobs` table).

---

## 10. Job UI fields

### 10.1 Job card

Always show: title, company (if real), bookmark, “Full Job Details”, relative posted time, Featured badge when set.

Highlight chips when real (non-placeholder): **Category, Job type, Experience, Fresher (Yes/No), Salary, Work mode**.

Optional: short description (2 lines).

### 10.2 Job detail

- Header: title, company · location, Apply, share
- Facts: Category, Job Type, Work Mode, Experience, Fresher, Salary, Posted At
- Source attribution (`source_name` / `source_url`)
- Overview (`shortDescription`) when useful
- Job details (markdown `description`)
- Skills chips, Responsibilities, Eligibility
- Warning banner
- Questions section
- Similar jobs
- Sticky bottom Apply (mobile pattern)

### 10.3 Public job object (camelCase used in web)

`id`, `slug`, `title`, `company`, `location`, `category`, `jobType`, `workMode`, `experience`, `isFresher`, `isFeatured`, `isInstagram`, `groupLink`, `salary`, `applyLink`, `applyMode`, `description`, `shortDescription`, `responsibilities`, `eligibility`, `warning`, `postedAt`, `expiresAt`, `status`, `createdBy`, `source`, `sourceUrl`, `skills`, `companyLogo` / `companyLogoUrl`, `jsonLd`, `tags`

---

## 11. Backend integration for Android

### 11.1 Environment

Use the same Supabase project as the web app:

| Variable | Purpose |
|----------|---------|
| Supabase project URL | Auth + REST + Realtime |
| Supabase anon key | Client SDK |
| Site URL | `https://jobsinvizag.in` (deep links / password reset redirects) |

Do **not** embed service-role keys in the Android app. Use anon key + RLS policies (same as web).

### 11.2 Client services to mirror (`src/services/`)

| Service file | Responsibility |
|--------------|----------------|
| `jobs.js` | Fetch published jobs, by id, Instagram jobs, category helpers |
| `studentJobs.js` | Fetch / upsert student profile |
| `studentResume.js` | Upload resume, signed URL, save path |
| `studentConsent.js` | Record consents |
| `jobApplications.js` | Submit application, list mine, status updates (employer) |
| `jobQuestions.js` | Ask / list published Q&A |
| `employerJobs.js` | Employer profile + CRUD pending jobs |
| `blogs.js` | Public blog list/post |
| `siteFeedback.js` | Submit feedback |
| `replyNotifications.js` | In-app notification inbox |

### 11.3 Edge functions (mostly admin / automation)

Usually **not** called from Android MVP:

`admin-create-employer`, `fetch-external-jobs`, `generate-daily-blog`, `notify-reply`, `resume-share`, `send-automation-summary`, `trigger-youtube-short`

### 11.4 Resume share API

`api/r/[token]` — public resume download via share token (`?dl=1`). Employers may open this URL; Android can open in Custom Tab.

### 11.5 Suggested Android stack

- Kotlin + Jetpack Compose (or existing team stack)
- Supabase Kotlin SDK (Auth, Postgrest, Storage)
- Navigation: bottom nav (Home, Saved, Applied, Profile) + auth graph
- Deep links: map web job URLs to Job Detail
- Image loading for company logos
- Markdown renderer for job `description` and blog body

---

## 12. Auth session notes

| Role | Sign-in | Gate | Web session cache key |
|------|---------|------|------------------------|
| Student | Password; email or phone→email | `student_profiles.is_active` | `vizagjobs:student-access-cache` (15m) |
| Employer | Password | `employer_profiles.is_active` | `vizagjobs:employer-access-cache` (15m) |
| Admin | Password | `admin_users` | `vizagjobs:admin-access-cache` (15m) |

Trigger `handle_new_auth_user_profile` creates student or employer profile from signup metadata.

---

## 13. Android UX adaptations

| Web feature | Android approach |
|-------------|------------------|
| PWA / offline SW | Native app; optional offline cache of saved jobs |
| Cookie consent banner | Play privacy policy + in-app consent if using analytics/ads |
| `navigator.share` | Android Sharesheet |
| WhatsApp / Telegram links | Intents |
| `tel:` links | Dialer Intent |
| Sticky Apply bar | Bottom bar / FAB |
| Safe-area CSS | WindowInsets |
| AdSense | AdMob only if product decides; respect Play policies |
| External apply | Chrome Custom Tabs |
| Job detail auth gate | Web gate is currently pass-through; product may still require login for Apply |

---

## 14. MVP implementation checklist

### Phase 1 — Browse

- [ ] Home feed with search, category, job type, freshness filters
- [ ] Pagination (12) + featured-first sort
- [ ] Job detail with markdown + facts + share + dial
- [ ] Category shortcuts (IT, Fresher, Part-time, branches)
- [ ] Saved jobs (local)
- [ ] Deep link from `jobsinvizag.in` job URLs

### Phase 2 — Student

- [ ] Register (full profile + consents)
- [ ] Login (email or phone + password)
- [ ] Forgot / reset password
- [ ] Profile edit
- [ ] Resume upload
- [ ] Internal apply + Applied Jobs list + status filters
- [ ] Jobs for You ranking for complete profiles
- [ ] External apply via Custom Tabs + optional group link

### Phase 3 — Polish / optional

- [ ] Job Q&A
- [ ] Notifications (application status)
- [ ] Blog reader
- [ ] Feedback form
- [ ] Employer module
- [ ] Account-synced saved jobs (new API)

---

## 15. Related docs in this repo

| Doc | Topic |
|-----|--------|
| [README.md](../README.md) | Project overview |
| [docs/student-registration.md](./student-registration.md) | Student auth & matching |
| [docs/supabase-setup.md](./supabase-setup.md) | Supabase schema & setup |
| [docs/pwa-setup.md](./pwa-setup.md) | Web PWA (skip for native) |
| [docs/google-jobs-seo.md](./google-jobs-seo.md) | Web SEO JobPosting schema |
| `.env.example` | Env var names |

---

## 16. Glossary

| Term | Meaning |
|------|---------|
| **Internal apply** | Apply on JobsInVizag with profile + resume |
| **External apply** | Redirect to employer’s `apply_link` |
| **Featured job** | `is_featured`; sorted to top of lists |
| **Instagram job** | `is_instagram`; shown on `/jobs/latest` |
| **Group link** | WhatsApp/Telegram community link after apply |
| **Complete profile** | All required student fields + consents present |

---

*Generated from the JobsInVizag web codebase for Android implementation. Prefer reading live Supabase RLS policies and `src/services/*` when wiring API calls.*
