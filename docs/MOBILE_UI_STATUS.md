# Mobile UI Optimization Status

Tracking document for mobile-friendly UI enhancements across all VizagJobs screens, routes, and shared components.

Last updated: 2026-10-14 (Asia/Kolkata)  
Current branch: `develop`

---

## 1. Mobile Quality Standards (For Every Screen)

- **Viewports tested:** 320px (iPhone SE narrow), 360px, 390px (iPhone 14/15), 430px (iPhone Pro Max), 768px (Tablet), and desktop.
- **Touch targets:** Minimum 44 × 44px for buttons, links, toggles, and modal close triggers (`min-h-11` or `h-11`).
- **No horizontal overflow:** `overflow-x: hidden`, flexible grids, wrapping text (`break-words`), and responsive image/table containers.
- **Mobile bottom navigation clearance:** Pages with mobile bottom nav or sticky bottom actions must include safe-area padding (`pb-mobile-chrome` / `pb-[max(0.75rem,env(safe-area-inset-bottom))]`).
- **Input accessibility:** Form inputs have minimum 16px font-size on mobile to prevent iOS auto-zoom, clear labels, and error states.
- **Modals & Dialogs:** Trapped focus, responsive dimensions (`max-h-[calc(100dvh-2rem)]`), internal scrolling, and backdrop dismiss.

---

## 2. Summary Dashboard

| Category | Total Screens | Fixed / Mobile-Friendly | In Progress / Planned Next | Pending |
|---|---|---|---|---|
| **Public Core** | 8 | 4 | 2 | 2 |
| **Category Listings** | 15 | 0 | 0 | 15 |
| **Student Portal** | 8 | 5 | 0 | 3 |
| **Employer Portal** | 10 | 0 | 2 | 8 |
| **Admin Portal** | 24 | 0 | 0 | 24 |
| **Quick Apply / Static** | 14 | 0 | 0 | 14 |
| **Total** | **79** | **9** | **4** | **66** |

---

## 3. Fixed Screens (Completed & Verified)

### Batch 1: Home & Jobs Search
- **`/` (Home - S007):**
  - Constrained filter grid children so chip rows cannot widen the viewport.
  - Wrapped long active search chips with accessible 44px dismiss controls.
  - Sized filter toggles and category chips for touch devices.
  - Resolved tab overlap at 320px viewport width.
- **`/jobs` (Jobs Listing & Search - S056):**
  - Responsive numbered pagination on desktop, clean Previous / Next buttons on mobile.
  - Empty states updated with 44px reset action.
  - Preserved keyword search intent without dropping multiword spaces.

### Batch 2: Job Details & Student Application
- **`/jobs/:jobSegment/:jobSlug`, `/job/:jobSlug`, `/jobs/:jobId` (Job Details - S064, S065, S066):**
  - Sticky mobile apply bar at bottom with safe-area bottom insets and 48px touch target (`min-h-12`).
  - Hides desktop-only action row on mobile to prevent duplicate action hierarchy.
  - Share drawer (`JobShareButtons`) sized with 44px touch buttons for WhatsApp, Telegram, Native Share, and Copy Link.
  - Markdown descriptions wrapped with `[overflow-wrap:anywhere]` and responsive horizontal scroll tables.
  - Admin Action Bar updated with `min-h-11 sm:min-h-9` touch targets on mobile.
  - Candidate matching button and applicant modal button updated to 44px minimum height.
  - Floating feedback and chatbot buttons dynamically adjust bottom offset when sticky apply bar is active.
- **`/student/apply/:jobId` (Student Job Apply - S028):**
  - Updated back link to full 44px touch target (`min-h-11 inline-flex`).
  - Saved resume toggle wrapped in 44px touch target (`min-h-11`).
  - Full-width touch-friendly file input and submit CTA (`min-h-12`).
  - Responsive applicant info grid with `break-words` for long emails and degrees.
  - Post-submission WhatsApp group modal fits mobile viewports with escape & focus trapping.
- **Shared Student Layout (`StudentShell.jsx` - U01):**
  - Added `pb-mobile-chrome` padding to main container to ensure the mobile bottom navigation bar never obscures bottom form fields or actions.
  - Responsive top header with `break-all` for long student email addresses and touch-friendly navigation pills.
- **Job Doubts & AI Q&A (`JobQuestionsSection.jsx` - U11):**
  - Increased touch targets on "Ask Gemini AI", "Sign In", "Cancel", "Helpful", and moderator actions to 44px (`min-h-11`).
  - "Show all questions" button upgraded to `min-h-11 w-full`.

### Batch 3: Student Authentication
- **`/student/login` (Student Login - S020):**
  - Upgraded "Forgot password?", "Create free student account", and "Back to job listings" links to full touch targets (`inline-flex min-h-11 items-center`).
  - Form submission buttons standardized with 48px touch height (`min-h-12`).
  - Role switcher toggles kept at `min-h-11` for mobile finger switching.
  - Added `pb-mobile-chrome` padding to ensure the mobile bottom navigation bar never overlaps the bottom links or actions.
- **`/student/register` (Student Register Wizard - S021):**
  - Added `pb-mobile-chrome` safe-area bottom padding to the page container.
  - Sized top back buttons ("Back to Education", "Back to Account Info") to `inline-flex min-h-11 items-center` with `flex-wrap` so headers never clip on 320px screens.
  - Upgraded "Employer registration" and footer "Sign in here" links to `min-h-11` touch targets.
  - Responsive multi-step wizard preserves input readability with font-size $\ge 16\text{px}$ on mobile viewports.

### Batch 4: Student Profile & Applied Jobs
- **`/student/profile` (Student Profile - S025):**
  - Upgraded "Browse fresher jobs in Vizag" and "view saved jobs" helper links to `inline-flex min-h-11 items-center` with wrapping flex container.
  - Sized "Add sector" and "Add skill" buttons to 44px (`min-h-11 h-11`).
  - Standardized custom skills buttons to `min-h-11 max-w-full rounded-full border border-indigo-500 bg-indigo-500 px-3 py-2 text-sm font-semibold text-white` matching preset chip touch targets.
  - Elevated "Are you a fresher?" radio button options to 44px touch targets (`min-h-11 cursor-pointer`).
  - Enhanced registration consent checkboxes to 20px (`h-5 w-5`) with `cursor-pointer` labels.
  - Safe-area bottom spacing verified with `pb-mobile-chrome` via `StudentShell.jsx`.
- **`/student/applied-jobs`, `/student/applications` (Student Applied Jobs & Redirect - S026, S027):**
  - Upgraded "Browse jobs" empty state button to `min-h-11` touch target.
  - Added "Show all applications" reset button in filtered empty states for quick recovery.
  - Application cards optimized with `min-w-0 flex-1 break-words` preventing text truncation or overlap with status pills on 320px screens.
  - Filter pills maintain `min-h-11` touch targets.

---

## 4. Work Queue: Next Screens Up

| Priority | Batch | Screen Routes | Target Focus |
|---|---|---|---|
| **P1 (Next)** | Day 5 | `/saved-jobs`, `/apply` | Saved jobs list, Instagram direct application feed |
| **P2** | Day 6 | `/quick-register`, `/apply/:slug` | One-page fast apply form, receipt confirmation |
| **P3** | Day 7 | `/quick-applications/claim`, `/oauth/consent` | OAuth modal on mobile, receipt claim flow |
| **P4** | Day 8 | `/employer/login`, `/employer/register` | Recruiter auth layout, company registration fields |
| **P5** | Day 9 | `/employer/profile`, `/employer/jobs` | Company profile editor, job management cards |
| **P6** | Day 10 | `/admin/quick-jobs/new`, `/admin/quick-jobs/:jobId/edit` | Mobile dynamic field editor |

---

## 5. Master Screen Inventory & Mobile Status

| ID | Route | Screen Name | Mobile Status | Last Updated |
|---|---|---|---|---|
| S001 | `/quick-register` | Quick Registration | ⏳ Pending | — |
| S002 | `/apply/:slug` | Quick Job Apply | ⏳ Pending | — |
| S003 | `/quick-applications/claim` | Claim Quick Application | ⏳ Pending | — |
| S004 | `/admin/quick-jobs/new` | Admin Create Quick Job | ⏳ Pending | — |
| S005 | `/admin/quick-jobs/:jobId/edit` | Admin Edit Quick Job | ⏳ Pending | — |
| S006 | `/admin/candidates` | Admin Quick Candidates | ⏳ Pending | — |
| S007 | `/` | Home Page | ✅ Fixed | 2026-10-14 |
| S008 | `/admin/login` | Admin Login | ⏳ Pending | — |
| S009 | `/oauth/consent` | OAuth Consent | ⏳ Pending | — |
| S010 | `/employer/login` | Employer Login | ⏳ Pending | — |
| S011 | `/employer/register` | Employer Register | ⏳ Pending | — |
| S012 | `/employer/forgot-password` | Employer Forgot Password | ⏳ Pending | — |
| S013 | `/employer/reset-password` | Employer Reset Password | ⏳ Pending | — |
| S014 | `/employer` | Employer Dashboard Redirect | ⏳ Pending | — |
| S015 | `/employer/profile` | Employer Profile | ⏳ Pending | — |
| S016 | `/employer/jobs` | Employer Jobs List | ⏳ Pending | — |
| S017 | `/employer/jobs/new` | Employer New Job | ⏳ Pending | — |
| S018 | `/employer/jobs/:jobId/edit` | Employer Edit Job | ⏳ Pending | — |
| S019 | `/employer/jobs/:jobId/applications` | Employer Job Applicants | ⏳ Pending | — |
| S020 | `/student/login` | Student Login | ✅ Fixed | 2026-10-14 |
| S021 | `/student/register` | Student Register | ✅ Fixed | 2026-10-14 |
| S022 | `/student/forgot-password` | Student Forgot Password | ⏳ Pending | — |
| S023 | `/student/reset-password` | Student Reset Password | ⏳ Pending | — |
| S024 | `/student` | Student Dashboard Redirect | ✅ Fixed | 2026-10-14 |
| S025 | `/student/profile` | Student Profile | ✅ Fixed | 2026-10-14 |
| S026 | `/student/applied-jobs` | Student Applied Jobs | ✅ Fixed | 2026-10-14 |
| S027 | `/student/applications` | Student Applications Redirect | ✅ Fixed | 2026-10-14 |
| S028 | `/student/apply/:jobId` | Student Job Apply | ✅ Fixed | 2026-10-14 |
| S029 | `/admin` | Admin Dashboard Redirect | ⏳ Pending | — |
| S030 | `/admin/new` | Admin New Job | ⏳ Pending | — |
| S031 | `/admin/jobs` | Admin Employer Jobs | ⏳ Pending | — |
| S032 | `/admin/admin-jobs` | Admin Platform Jobs | ⏳ Pending | — |
| S033 | `/admin/fetch` | Admin External Job Fetch | ⏳ Pending | — |
| S034 | `/admin/jobs/:jobId/edit` | Admin Edit Job | ⏳ Pending | — |
| S035 | `/admin/jobs/:jobId/applications` | Admin Job Applications | ⏳ Pending | — |
| S036 | `/admin/blog` | Admin Blog List | ⏳ Pending | — |
| S037 | `/admin/blog/new` | Admin New Blog | ⏳ Pending | — |
| S038 | `/admin/blog/:postId/edit` | Admin Edit Blog | ⏳ Pending | — |
| S039 | `/admin/feedback` | Admin Feedback Review | ⏳ Pending | — |
| S040 | `/admin/questions` | Admin Questions Review | ⏳ Pending | — |
| S041 | `/admin/employers` | Admin Employers Management | ⏳ Pending | — |
| S042 | `/admin/companies` | Admin Companies Management | ⏳ Pending | — |
| S043 | `/admin/bills` | Admin Billing Tool | ⏳ Pending | — |
| S044 | `/admin/students` | Admin Student Directory | ⏳ Pending | — |
| S045 | `/admin/notifications` | Admin Notification Analytics | ⏳ Pending | — |
| S046 | `/blog` | Public Blog List | ⏳ Pending | — |
| S047 | `/blog/:slug` | Public Blog Post | ⏳ Pending | — |
| S048 | `/about` | About Vizag Jobs | ⏳ Pending | — |
| S049 | `/contact` | Contact Us | ⏳ Pending | — |
| S050 | `/feedback` | Submit Feedback | ⏳ Pending | — |
| S051 | `/qa` | Community Q&A | ⏳ Pending | — |
| S052 | `/privacy-policy` | Privacy Policy | ⏳ Pending | — |
| S053 | `/terms-of-service` | Terms of Service | ⏳ Pending | — |
| S054 | `/disclaimer` | Disclaimer | ⏳ Pending | — |
| S055 | `/companies` | Companies in Vizag Directory | ⏳ Pending | — |
| S056 | `/jobs` | All Jobs in Vizag | ✅ Fixed | 2026-10-14 |
| S057 | `/apply` | Instagram Jobs Stream | ⏳ Pending | — |
| S058 | `/jobs/latest` | Latest Jobs Redirect | ⏳ Pending | — |
| S059 | `/saved-jobs` | Saved Jobs Bookmark List | ⏳ Pending | — |
| S060 | `/jobs/it` | IT Jobs in Vizag | ⏳ Pending | — |
| S061 | `/jobs/fresher` | Fresher Jobs in Vizag | ⏳ Pending | — |
| S062 | `/jobs/part-time` | Part Time Jobs | ⏳ Pending | — |
| S063 | `/jobs/vizagjobs` | Direct Platform Jobs | ⏳ Pending | — |
| S064 | `/jobs/:jobSegment/:jobSlug` | Canonical Job Details | ✅ Fixed | 2026-10-14 |
| S065 | `/job/:jobSlug` | Job Details Slug Alias | ✅ Fixed | 2026-10-14 |
| S066 | `/jobs/:jobId` | Job Details ID Alias | ✅ Fixed | 2026-10-14 |
| S067 | `/jobs/civil` | Civil Engineering Jobs | ⏳ Pending | — |
| S068 | `/jobs/mechanical` | Mechanical Jobs | ⏳ Pending | — |
| S069 | `/jobs/electrical` | Electrical Jobs | ⏳ Pending | — |
| S070 | `/jobs/ece` | ECE Jobs | ⏳ Pending | — |
| S071 | `/jobs/engineering` | Engineering Jobs | ⏳ Pending | — |
| S072 | `/jobs/banking` | Banking Jobs | ⏳ Pending | — |
| S073 | `/jobs/bpo` | BPO & Support Jobs | ⏳ Pending | — |
| S074 | `/jobs/sales` | Sales Jobs | ⏳ Pending | — |
| S075 | `/jobs/hr` | HR Jobs | ⏳ Pending | — |
| S076 | `/jobs/healthcare` | Healthcare Jobs | ⏳ Pending | — |
| S077 | `/jobs/education` | Teaching & Education Jobs | ⏳ Pending | — |
| S078 | `/jobs/hospitality` | Hospitality Jobs | ⏳ Pending | — |
| S079 | `/jobs/logistics` | Logistics & Supply Chain | ⏳ Pending | — |
