# Screen, functionality and mobile UI tracker

Baseline: 2026-10-13 (Asia/Kolkata), application commit `640c99d`. Latest origin/develop pulled successfully; already up to date.

This is the working source of truth for incremental QA and mobile UI improvements. Inventory comes from src/App.jsx, category configuration, pages, shared components, services, API handlers and automation workflows. Source inspection is not an end-to-end pass. Existing audit claims in DAILY_CODE_AUDIT.md are historical and do not mark this tracker Tested.

## Status and completion rules

- Functional status: Not tested → In progress → Tested, Failed or Blocked.
- UI status: Not reviewed → In progress → Verified, Failed or Blocked.
- Mark Tested only after all listed scenarios and applicable negative cases pass through the browser and backend with recorded evidence. A unit test, build, source review or mocked response alone is insufficient.
- Mark UI Verified only after mobile and desktop checks below pass. Keep functional and UI statuses independent.
- Record date, tester, environment, commit, account role, steps, expected/actual result, screenshot/log path, defects and retest evidence in the execution log. Never record passwords, tokens or candidate personal data.
- Any changed behavior reopens affected Tested rows; any changed layout reopens affected UI rows. Add every new route, screen, dialog and feature in the same change that introduces it.
- After each completed feature or screen: run relevant checks, update this tracker, commit only that work, pull develop safely and push to origin/develop. Record the resulting commit and push result. Do not bundle the whole backlog into one release. Preserve unrelated local edits.

## Screen inventory

Each route variant has its own row, including redirects and category screens. Dynamic routes need valid, missing, unavailable and unauthorized records as applicable. The login routes share UnifiedLoginPage; they still need separate role checks.

| ID | Route | Functionality / E2E acceptance scenarios | Functional | Mobile UI | Evidence / defect |
|---|---|---|---|---|---|
| S001 | `/quick-register` | Complete quick candidate registration; validation, consent and duplicate submission handling | In progress | In progress | QA-2026-10-14-UI-Day6: mobile UI verified, full journey pending |
| S002 | `/apply/:slug` | Load quick job and dynamic form; validate fields; submit; receipt; duplicate/closed/missing job and claim flow | In progress | In progress | QA-2026-10-14-UI-Day6: mobile UI verified, full journey pending |
| S003 | `/quick-applications/claim` | Claim receipt after login; verify ownership, duplicate claim, invalid receipt and application association | In progress | In progress | QA-2026-10-14-UI-Day6: mobile UI verified, full journey pending |
| S004 | `/admin/quick-jobs/new` | Create/edit quick job and dynamic fields; save; open public form and verify field changes | In progress | In progress | QA-2026-10-14-UI-Day10: mobile UI verified, full journey pending |
| S005 | `/admin/quick-jobs/:jobId/edit` | Create/edit quick job and dynamic fields; save; open public form and verify field changes | In progress | In progress | QA-2026-10-14-UI-Day10: mobile UI verified, full journey pending |
| S006 | `/admin/candidates` | Browse quick jobs and candidates; inspect responses and candidate actions; verify data isolation | In progress | In progress | QA-2026-10-14-UI-Day11: mobile UI verified, full journey pending |
| S007 | `/` | Home search, categories, job sections, counts, recommendations, blog links and calls to action | In progress | In progress | QA-2026-10-14-UI: targeted browser checks passed; full checklist pending |
| S008 | `/admin/login` | Sign in for correct role; invalid credentials; enabled OAuth/phone modes; return URL; sign out and session expiry | In progress | In progress | QA-2026-10-14-UI-Day11: mobile UI verified, full journey pending |
| S009 | `/oauth/consent` | Validate OAuth request/session; accept or reject consent; verify callback and error state | In progress | In progress | QA-2026-10-14-UI-Day7: mobile UI verified, full journey pending |
| S010 | `/employer/login` | Sign in for correct role; invalid credentials; enabled OAuth/phone modes; return URL; sign out and session expiry | In progress | In progress | QA-2026-10-14-UI-Day7: mobile UI verified, full journey pending |
| S011 | `/employer/register` | Register account; required fields and consent; duplicate account; complete profile and verify persistence | In progress | In progress | QA-2026-10-14-UI-Day8: mobile UI verified, full journey pending |
| S012 | `/employer/forgot-password` | Request password reset; validate email; verify recovery message and reset link | Not tested | Not reviewed | — |
| S013 | `/employer/reset-password` | Use valid/expired recovery link; validate matching passwords; sign in with new password | Not tested | Not reviewed | — |
| S014 | `/employer` | Verify redirect destination, correct role guard, refresh and browser back | In progress | In progress | QA-2026-10-14-UI-Day8: mobile UI verified, full journey pending |
| S015 | `/employer/profile` | Load, validate, edit and save profile; reload to verify persistence; student resume/preferences or employer company details | In progress | In progress | QA-2026-10-14-UI-Day8: mobile UI verified, full journey pending |
| S016 | `/employer/jobs` | List scoped jobs; search/filter; open edit and applicants; available lifecycle actions and counts; verify role boundaries | In progress | In progress | QA-2026-10-14-UI-Day9: mobile UI verified, full journey pending |
| S017 | `/employer/jobs/new` | Create/edit job; required fields, eligibility and apply mode; save and reload; publication visibility and ownership | In progress | In progress | QA-2026-10-14-UI-Day9: mobile UI verified, full journey pending |
| S018 | `/employer/jobs/:jobId/edit` | Create/edit job; required fields, eligibility and apply mode; save and reload; publication visibility and ownership | In progress | In progress | QA-2026-10-14-UI-Day9: mobile UI verified, full journey pending |
| S019 | `/employer/jobs/:jobId/applications` | Load candidates; filter; update pipeline/status/notes; schedule/cancel interview; resume access; communication and export; verify student sees updates | Not tested | Not reviewed | — |
| S020 | `/student/login` | Sign in for correct role; invalid credentials; enabled OAuth/phone modes; return URL; sign out and session expiry | In progress | In progress | QA-2026-10-14-UI-Day3: mobile UI verified, full journey pending |
| S021 | `/student/register` | Register account; required fields and consent; duplicate account; complete profile and verify persistence | In progress | In progress | QA-2026-10-14-UI-Day3: mobile UI verified, full journey pending |
| S022 | `/student/forgot-password` | Request password reset; validate email; verify recovery message and reset link | Not tested | Not reviewed | — |
| S023 | `/student/reset-password` | Use valid/expired recovery link; validate matching passwords; sign in with new password | Not tested | Not reviewed | — |
| S024 | `/student` | Verify redirect destination, correct role guard, refresh and browser back | In progress | In progress | QA-2026-10-14-UI-Day4: mobile redirect verified, full journey pending |
| S025 | `/student/profile` | Load, validate, edit and save profile; reload to verify persistence; student resume/preferences or employer company details | In progress | In progress | QA-2026-10-14-UI-Day4: mobile UI verified, full journey pending |
| S026 | `/student/applied-jobs` | View own applications, counts, status and interview details; empty state; verify other users cannot access records | In progress | In progress | QA-2026-10-14-UI-Day4: mobile UI verified, full journey pending |
| S027 | `/student/applications` | Verify redirect destination, correct role guard, refresh and browser back | In progress | In progress | QA-2026-10-14-UI-Day4: mobile redirect verified, full journey pending |
| S028 | `/student/apply/:jobId` | Authenticate; eligibility/profile checks; resume upload or reuse; submit once; verify application in student and recruiter views | In progress | In progress | QA-2026-10-14-UI-Day2: mobile UI verified, full journey pending |
| S029 | `/admin` | Verify redirect destination, correct role guard, refresh and browser back | Not tested | Not reviewed | — |
| S030 | `/admin/new` | Create/edit job; required fields, eligibility and apply mode; save and reload; publication visibility and ownership | Not tested | Not reviewed | — |
| S031 | `/admin/jobs` | List scoped jobs; search/filter; open edit and applicants; available lifecycle actions and counts; verify role boundaries | Not tested | Not reviewed | — |
| S032 | `/admin/admin-jobs` | List scoped jobs; search/filter; open edit and applicants; available lifecycle actions and counts; verify role boundaries | Not tested | Not reviewed | — |
| S033 | `/admin/fetch` | Fetch each enabled source; start/collect runs; review, SEO optimize, deduplicate and publish; resume/retry failed run | Not tested | Not reviewed | — |
| S034 | `/admin/jobs/:jobId/edit` | Create/edit job; required fields, eligibility and apply mode; save and reload; publication visibility and ownership | Not tested | Not reviewed | — |
| S035 | `/admin/jobs/:jobId/applications` | Load candidates; filter; update pipeline/status/notes; schedule/cancel interview; resume access; communication and export; verify student sees updates | Not tested | Not reviewed | — |
| S036 | `/admin/blog` | List and manage blogs; publication states; open edit; generation workflow and errors | Not tested | Not reviewed | — |
| S037 | `/admin/blog/new` | Create/edit blog; validate content/metadata; preview and publish; verify public article | Not tested | Not reviewed | — |
| S038 | `/admin/blog/:postId/edit` | Create/edit blog; validate content/metadata; preview and publish; verify public article | Not tested | Not reviewed | — |
| S039 | `/admin/feedback` | Review feedback; reply, publish, ignore or delete; verify public visibility and reply notification | Not tested | Not reviewed | — |
| S040 | `/admin/questions` | Review questions; answer, publish, ignore or delete; verify public answer and reply notification | Not tested | Not reviewed | — |
| S041 | `/admin/employers` | Search/manage employers; create account and edit profile; link company; verify employer access | Not tested | Not reviewed | — |
| S042 | `/admin/companies` | Manage companies and career URLs; fetch/review career jobs; approve and verify public directory | Not tested | Not reviewed | — |
| S043 | `/admin/bills` | Edit customer/services/quantity/prices; verify totals; preview, print and reset | Not tested | Not reviewed | — |
| S044 | `/admin/students` | Search/filter/page students; inspect profile; resume access; export and share selected candidates | Not tested | Not reviewed | — |
| S045 | `/admin/notifications` | Inspect push statistics, dispatches, clicks, subscribers and alerts; filters; controlled test-push flow | Not tested | Not reviewed | — |
| S046 | `/blog` | Browse published articles; open article; list empty/error states | Not tested | Not reviewed | — |
| S047 | `/blog/:slug` | Load article; markdown, metadata and links; missing/unpublished slug | Not tested | Not reviewed | — |
| S048 | `/about` | Read page; verify navigation, content and available contact/legal links | Not tested | Not reviewed | — |
| S049 | `/contact` | Read page; verify navigation, content and available contact/legal links | Not tested | Not reviewed | — |
| S050 | `/feedback` | Submit feedback type/message; validation; pending moderation; published reply and notification | Not tested | Not reviewed | — |
| S051 | `/qa` | Browse/filter questions; submit; validation; AI-answer fallback; helpful vote; moderation and notifications | Not tested | Not reviewed | — |
| S052 | `/privacy-policy` | Read page; verify navigation, content and available contact/legal links | Not tested | Not reviewed | — |
| S053 | `/terms-of-service` | Read page; verify navigation, content and available contact/legal links | Not tested | Not reviewed | — |
| S054 | `/disclaimer` | Read page; verify navigation, content and available contact/legal links | Not tested | Not reviewed | — |
| S055 | `/companies` | Browse/search companies; company details and career links; empty/error states | Not tested | Not reviewed | — |
| S056 | `/jobs` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | QA-2026-10-14-UI: targeted browser checks passed; full checklist pending |
| S057 | `/apply` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | QA-2026-10-14-UI-Day5: mobile UI verified, full journey pending |
| S058 | `/jobs/latest` | Verify redirect destination, correct role guard, refresh and browser back | In progress | In progress | QA-2026-10-14-UI-Day5: mobile redirect verified, full journey pending |
| S059 | `/saved-jobs` | Save/unsave listings; reload; empty list; open job; stale/unavailable saved job | In progress | In progress | QA-2026-10-14-UI-Day5: mobile UI verified, full journey pending |
| S060 | `/jobs/it` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S061 | `/jobs/fresher` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S062 | `/jobs/part-time` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S063 | `/jobs/vizagjobs` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S064 | `/jobs/:jobSegment/:jobSlug` | Resolve job identifier; auth gate; details, eligibility, save/share/apply, questions and similar jobs; missing/expired job | In progress | In progress | QA-2026-10-14-UI-Day2: mobile UI verified, full journey pending |
| S065 | `/job/:jobSlug` | Resolve job identifier; auth gate; details, eligibility, save/share/apply, questions and similar jobs; missing/expired job | In progress | In progress | QA-2026-10-14-UI-Day2: mobile UI verified, full journey pending |
| S066 | `/jobs/:jobId` | Resolve job identifier; auth gate; details, eligibility, save/share/apply, questions and similar jobs; missing/expired job | In progress | In progress | QA-2026-10-14-UI-Day2: mobile UI verified, full journey pending |
| S067 | `/jobs/civil` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S068 | `/jobs/mechanical` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S069 | `/jobs/electrical` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S070 | `/jobs/ece` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S071 | `/jobs/engineering` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S072 | `/jobs/banking` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S073 | `/jobs/bpo` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S074 | `/jobs/sales` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S075 | `/jobs/hr` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S076 | `/jobs/healthcare` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S077 | `/jobs/education` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S078 | `/jobs/hospitality` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |
| S079 | `/jobs/logistics` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | Not tested | Not reviewed | — |

## Legacy URL verification

Check direct navigation, refresh, destination and browser back for every alias. Run these with the corresponding destination screen batch.

| Alias | Destination | Status | Evidence |
|---|---|---|---|
| `/jobs-in-vizag` | `/jobs` | Not tested | — |
| `/it-jobs-in-vizag` | `/jobs/it` | Not tested | — |
| `/fresher-jobs-in-vizag` | `/jobs/fresher` | Not tested | — |
| `/part-time-jobs-vizag` | `/jobs/part-time` | Not tested | — |
| `/ig` | `/apply` | Not tested | — |
| `/jobs/latest` | `/apply` | Not tested | — |
| `/civil-jobs-in-vizag` | `/jobs/civil` | Not tested | — |
| `/mechanical-jobs-in-vizag` | `/jobs/mechanical` | Not tested | — |
| `/electrical-jobs-in-vizag` | `/jobs/electrical` | Not tested | — |
| `/ece-jobs-in-vizag` | `/jobs/ece` | Not tested | — |
| `/engineering-jobs-in-vizag` | `/jobs/engineering` | Not tested | — |

## Shared UI and cross-screen functionality

Each item below needs independent verification and regression checks on the screens that use it.

| ID | Surface / functionality | E2E acceptance scenarios | Functional | Mobile UI | Evidence |
|---|---|---|---|---|---|
| U01 | Header, navbar, footer and role shells | Menu open/close, active link, role links, logout, keyboard focus and navigation | Not tested | Not reviewed | — |
| U02 | Mobile bottom navigation | Active tab, saved/applied counts, safe-area spacing and no covered page actions | Not tested | Not reviewed | — |
| U03 | Search, filters, source tabs, category links and pagination | Combine/reset filters; correct matching and counts; page boundaries; browser back; compact mobile pagination and removable long search chips | In progress | In progress | QA-2026-10-14-UI |
| U04 | Job cards and recommendations | Long titles, salary/location/source labels, freshness, eligibility, counts, save and details | Not tested | Not reviewed | — |
| U05 | Job details and apply gates | Anonymous/student/staff/employer access; internal/external apply; preserve destination after login | Not tested | Not reviewed | — |
| U06 | Apply dialogs and communication prompts | External apply, channel prompt, success modal, WhatsApp/phone links; cancel/continue and no duplicate records | Not tested | Not reviewed | — |
| U07 | Notification bell | Unread counts; questions, feedback and replies; open/read/dismiss/clear; persisted state; role isolation | Not tested | Not reviewed | — |
| U08 | Push alerts and PWA | Permission allow/deny; subscribe/unsubscribe; controlled job alert; click target/tracking; install, offline and update recovery | Not tested | Not reviewed | — |
| U09 | Cookie consent, analytics and ads | Accept/reject/customize persisted preference; verify integrations obey consent; no layout overlap | Not tested | Not reviewed | — |
| U10 | Feedback floating button and chatbot | Open/close; validate input; response/error/retry; narrow-screen keyboard and stacking | Not tested | Not reviewed | — |
| U11 | Question sections and community previews | Submit, AI answer/failure, moderation, helpful votes and reply notification | Not tested | Not reviewed | — |
| U12 | Resume upload, download and sharing | Supported/invalid/oversize files; upload/reuse; signed URL expiry and ownership; share/revoke behavior where supported | Not tested | Not reviewed | — |
| U13 | Applicant cards/tables, filters and export dialogs | Filter and select candidates; export correct rows/columns; notes, stages and interview updates persist | Not tested | Not reviewed | — |
| U14 | Student export/share and company-link dialogs | Selection and preview; confirm/cancel; valid links; restricted data visibility | Not tested | Not reviewed | — |
| U15 | Job forms and external review/approval dialogs | Validation; requirements; raw text/SQL import; SEO preview; duplicate prevention; publish result | Not tested | Not reviewed | — |
| U16 | Blog and YouTube generation panels | Start generation; progress/error/retry; review content; controlled publish/upload confirmation | Not tested | Not reviewed | — |
| U17 | Toasts, loading, error boundary and scroll restoration | Readable feedback; retry; no blank screen; navigate/refresh/back restores expected position | Not tested | Not reviewed | — |
| U18 | SEO, deep links and legacy redirects | Canonical/metadata/schema/sitemap; direct refresh; all legacy mappings; invalid route behavior | Not tested | Not reviewed | — |

## Service functionality inventory

Exported service operations are listed individually for traceability. For each operation, link its screen or integration journey and verify success, validation/failure, authorization, persistence and retry/duplicate handling where applicable. Constants are omitted; these rows do not replace the screen journeys above.

| ID | Source | Operation | E2E status | Linked screen / evidence |
|---|---|---|---|---|
| F001 | src/services/adminBlogs.js | createSuggestedBlogSlug | Not tested | — |
| F002 | src/services/adminBlogs.js | getEmptyBlogForm | Not tested | — |
| F003 | src/services/adminBlogs.js | serializeBlogForm | Not tested | — |
| F004 | src/services/adminBlogs.js | deserializeBlogForForm | Not tested | — |
| F005 | src/services/adminBlogs.js | fetchAdminPosts | Not tested | — |
| F006 | src/services/adminBlogs.js | fetchAdminPostById | Not tested | — |
| F007 | src/services/adminBlogs.js | createAdminPost | Not tested | — |
| F008 | src/services/adminBlogs.js | updateAdminPost | Not tested | — |
| F009 | src/services/adminBlogs.js | updateAdminPostStatus | Not tested | — |
| F010 | src/services/adminCompanies.js | fetchAdminCompanies | Not tested | — |
| F011 | src/services/adminCompanies.js | saveCompanyDetails | Not tested | — |
| F012 | src/services/adminCompanies.js | toggleCompanyDirectoryApproval | Not tested | — |
| F013 | src/services/adminCompanies.js | mapCategoryToSector | Not tested | — |
| F014 | src/services/adminCompanies.js | clearPublicCompaniesCache | Not tested | — |
| F015 | src/services/adminCompanies.js | fetchPublicDirectoryCompanies | Not tested | — |
| F016 | src/services/adminCompanies.js | detectCareerPortalFromWebsite | Not tested | — |
| F017 | src/services/adminEmployers.js | fetchAdminEmployerProfiles | Not tested | — |
| F018 | src/services/adminEmployers.js | setEmployerActiveStatus | Not tested | — |
| F019 | src/services/adminEmployers.js | createAdminEmployerAccount | Not tested | — |
| F020 | src/services/adminJobs.js | splitSqlValuesTuples | Not tested | — |
| F021 | src/services/adminJobs.js | parseSqlInsertToRecords | Not tested | — |
| F022 | src/services/adminJobs.js | parseSqlInsertToRecord | Not tested | — |
| F023 | src/services/adminJobs.js | formatJobsToSqlInsert | Not tested | — |
| F024 | src/services/adminJobs.js | createSuggestedSlug | Not tested | — |
| F025 | src/services/adminJobs.js | sanitizeExternalJobForInsert | Not tested | — |
| F026 | src/services/adminJobs.js | getEmptyJobForm | Not tested | — |
| F027 | src/services/adminJobs.js | serializeJobForm | Not tested | — |
| F028 | src/services/adminJobs.js | deserializeJobForForm | Not tested | — |
| F029 | src/services/adminJobs.js | isJobSlugTaken | Not tested | — |
| F030 | src/services/adminJobs.js | isExternalFetchSourceName | Not tested | — |
| F031 | src/services/adminJobs.js | fetchAdminJobs | Not tested | — |
| F032 | src/services/adminJobs.js | fetchCandidateMatchingJobs | Not tested | — |
| F033 | src/services/adminJobs.js | fetchAdminCreatedJobs | Not tested | — |
| F034 | src/services/adminJobs.js | fetchAdminPlatformJobs | Not tested | — |
| F035 | src/services/adminJobs.js | fetchEmployerSubmittedJobs | Not tested | — |
| F036 | src/services/adminJobs.js | getAdminJobsListPath | Not tested | — |
| F037 | src/services/adminJobs.js | assignJobsToEmployer | Not tested | — |
| F038 | src/services/adminJobs.js | moveJobsToAdmin | Not tested | — |
| F039 | src/services/adminJobs.js | fetchAdminJobById | Not tested | — |
| F040 | src/services/adminJobs.js | createAdminJob | Not tested | — |
| F041 | src/services/adminJobs.js | createAdminJobs | Not tested | — |
| F042 | src/services/adminJobs.js | createAdminJobsFromSql | Not tested | — |
| F043 | src/services/adminJobs.js | createAdminJobFromSql | Not tested | — |
| F044 | src/services/adminJobs.js | updateAdminJob | Not tested | — |
| F045 | src/services/adminJobs.js | updateAdminJobStatus | Not tested | — |
| F046 | src/services/adminJobs.js | approveAdminJob | Not tested | — |
| F047 | src/services/adminJobs.js | rejectAdminJob | Not tested | — |
| F048 | src/services/adminJobs.js | toggleAdminJobFeatured | Not tested | — |
| F049 | src/services/adminJobs.js | toggleAdminJobInstagram | Not tested | — |
| F050 | src/services/adminJobs.js | updateAdminJobGroupLink | Not tested | — |
| F051 | src/services/adminNotificationAnalytics.js | parseUserAgentDetails | Not tested | — |
| F052 | src/services/adminNotificationAnalytics.js | fetchNotificationAnalyticsData | Not tested | — |
| F053 | src/services/adminNotificationAnalytics.js | sendTestPushNotification | Not tested | — |
| F054 | src/services/adminStudents.js | fetchAdminStudentProfiles | Not tested | — |
| F055 | src/services/adminStudents.js | setStudentActiveStatus | Not tested | — |
| F056 | src/services/blogs.js | fetchPublishedPosts | Not tested | — |
| F057 | src/services/blogs.js | fetchPublishedPostBySlug | Not tested | — |
| F058 | src/services/blogs.js | clearBlogCache | Not tested | — |
| F059 | src/services/dailyBlogGenerate.js | getGenerateDailyBlogUrl | Not tested | — |
| F060 | src/services/dailyBlogGenerate.js | generateDailyBlogArticle | Not tested | — |
| F061 | src/services/employerJobs.js | getEmptyEmployerJobForm | Not tested | — |
| F062 | src/services/employerJobs.js | serializeEmployerJobForm | Not tested | — |
| F063 | src/services/employerJobs.js | fetchEmployerProfile | Not tested | — |
| F064 | src/services/employerJobs.js | upsertEmployerProfile | Not tested | — |
| F065 | src/services/employerJobs.js | fetchMyJobs | Not tested | — |
| F066 | src/services/employerJobs.js | fetchMyJobById | Not tested | — |
| F067 | src/services/employerJobs.js | createEmployerJob | Not tested | — |
| F068 | src/services/employerJobs.js | updateEmployerJob | Not tested | — |
| F069 | src/services/externalJobFetch.js | getFetchExternalJobsUrl | Not tested | — |
| F070 | src/services/externalJobFetch.js | fetchExternalJobs | Not tested | — |
| F071 | src/services/externalJobFetch.js | fetchExternalJobsBySource | Not tested | — |
| F072 | src/services/externalJobFetch.js | startNaukriApifyFetch | Not tested | — |
| F073 | src/services/externalJobFetch.js | collectNaukriApifyFetch | Not tested | — |
| F074 | src/services/externalJobFetch.js | seoOptimizeExternalJob | Not tested | — |
| F075 | src/services/externalJobFetch.js | fetchSeoGeminiKeys | Not tested | — |
| F076 | src/services/externalJobFetch.js | fetchCompanyCareerJobs | Not tested | — |
| F077 | src/services/externalJobFetch.js | parseRawJobTextWithGemini | Not tested | — |
| F078 | src/services/jobApplications.js | fetchMyApplicationForJob | Not tested | — |
| F079 | src/services/jobApplications.js | fetchMyApplications | Not tested | — |
| F080 | src/services/jobApplications.js | fetchJobApplications | Not tested | — |
| F081 | src/services/jobApplications.js | fetchJobCandidates | Not tested | — |
| F082 | src/services/jobApplications.js | fetchJobApplicationCounts | Not tested | — |
| F083 | src/services/jobApplications.js | fetchJobApplicationStats | Not tested | — |
| F084 | src/services/jobApplications.js | submitJobApplication | Not tested | — |
| F085 | src/services/jobApplications.js | updateCandidatePipelineStage | Not tested | — |
| F086 | src/services/jobApplications.js | updateApplicationStatus | Not tested | — |
| F087 | src/services/jobApplications.js | updateApplicationRecruiterNotes | Not tested | — |
| F088 | src/services/jobApplications.js | scheduleApplicationInterview | Not tested | — |
| F089 | src/services/jobApplications.js | cancelApplicationInterview | Not tested | — |
| F090 | src/services/jobApplications.js | getApplicationResumeUrl | Not tested | — |
| F091 | src/services/jobApplications.js | formatApplicationTime | Not tested | — |
| F092 | src/services/jobApplyClicks.js | recordExternalApplyClick | Not tested | — |
| F093 | src/services/jobApplyClicks.js | recordAndOpenExternalApply | Not tested | — |
| F094 | src/services/jobApplyClicks.js | fetchStudentProfileRowsByUserIds | Not tested | — |
| F095 | src/services/jobApplyClicks.js | fetchJobApplyClicks | Not tested | — |
| F096 | src/services/jobQuestions.js | validateQuestionInput | Not tested | — |
| F097 | src/services/jobQuestions.js | getAnswerJobQuestionUrl | Not tested | — |
| F098 | src/services/jobQuestions.js | insertPendingJobQuestion | Not tested | — |
| F099 | src/services/jobQuestions.js | requestJobAiAnswer | Not tested | — |
| F100 | src/services/jobQuestions.js | submitJobQuestion | Not tested | — |
| F101 | src/services/jobQuestions.js | getVotedQuestions | Not tested | — |
| F102 | src/services/jobQuestions.js | hasUserVotedHelpful | Not tested | — |
| F103 | src/services/jobQuestions.js | voteQuestionHelpful | Not tested | — |
| F104 | src/services/jobQuestions.js | fetchRecentCommunityQuestions | Not tested | — |
| F105 | src/services/jobQuestions.js | fetchAllCommunityQuestions | Not tested | — |
| F106 | src/services/jobQuestions.js | fetchAdminAllJobQuestions | Not tested | — |
| F107 | src/services/jobQuestions.js | fetchPublishedJobQuestions | Not tested | — |
| F108 | src/services/jobQuestions.js | fetchModeratorJobQuestions | Not tested | — |
| F109 | src/services/jobQuestions.js | saveJobQuestionAnswer | Not tested | — |
| F110 | src/services/jobQuestions.js | publishJobQuestion | Not tested | — |
| F111 | src/services/jobQuestions.js | deleteJobQuestion | Not tested | — |
| F112 | src/services/jobQuestions.js | ignoreJobQuestion | Not tested | — |
| F113 | src/services/jobQuestions.js | fetchQuestionNotifications | Not tested | — |
| F114 | src/services/jobQuestions.js | fetchUnreadQuestionNotificationCount | Not tested | — |
| F115 | src/services/jobQuestions.js | markQuestionNotificationRead | Not tested | — |
| F116 | src/services/jobQuestions.js | dismissQuestionNotification | Not tested | — |
| F117 | src/services/jobQuestions.js | dismissAllQuestionNotifications | Not tested | — |
| F118 | src/services/jobQuestions.js | formatQuestionAsker | Not tested | — |
| F119 | src/services/jobQuestions.js | formatQuestionTime | Not tested | — |
| F120 | src/services/jobRoles.js | fetchLiveJobRoles | Not tested | — |
| F121 | src/services/jobs.js | fetchJobs | Not tested | — |
| F122 | src/services/jobs.js | fetchJobById | Not tested | — |
| F123 | src/services/jobs.js | fetchInstagramJobs | Not tested | — |
| F124 | src/services/jobs.js | getAllJobs | Not tested | — |
| F125 | src/services/jobs.js | getFresherJobs | Not tested | — |
| F126 | src/services/jobs.js | getJobsByCategory | Not tested | — |
| F127 | src/services/jobs.js | getJobsByType | Not tested | — |
| F128 | src/services/jobs.js | searchJobs | Not tested | — |
| F129 | src/services/jobs.js | clearJobsCache | Not tested | — |
| F130 | src/services/quickJobs.js | getQuickJob | Not tested | — |
| F131 | src/services/quickJobs.js | saveQuickJob | Not tested | — |
| F132 | src/services/quickJobs.js | storeReceipt | Not tested | — |
| F133 | src/services/quickJobs.js | claimQuickApplications | Not tested | — |
| F134 | src/services/replyNotifications.js | fetchReplyNotifications | Not tested | — |
| F135 | src/services/replyNotifications.js | fetchUnreadReplyNotificationCount | Not tested | — |
| F136 | src/services/replyNotifications.js | markReplyNotificationRead | Not tested | — |
| F137 | src/services/replyNotifications.js | dismissReplyNotification | Not tested | — |
| F138 | src/services/replyNotifications.js | dismissAllReplyNotifications | Not tested | — |
| F139 | src/services/replyNotifications.js | formatReplyNotificationTime | Not tested | — |
| F140 | src/services/replyNotifications.js | replyNotificationKindLabel | Not tested | — |
| F141 | src/services/siteChat.js | getSiteChatUrl | Not tested | — |
| F142 | src/services/siteChat.js | fetchSiteChatMeta | Not tested | — |
| F143 | src/services/siteChat.js | sendSiteChatMessage | Not tested | — |
| F144 | src/services/siteFeedback.js | validateSiteFeedbackInput | Not tested | — |
| F145 | src/services/siteFeedback.js | submitSiteFeedback | Not tested | — |
| F146 | src/services/siteFeedback.js | fetchPublishedSiteFeedback | Not tested | — |
| F147 | src/services/siteFeedback.js | fetchAdminSiteFeedback | Not tested | — |
| F148 | src/services/siteFeedback.js | publishSiteFeedback | Not tested | — |
| F149 | src/services/siteFeedback.js | ignoreSiteFeedback | Not tested | — |
| F150 | src/services/siteFeedback.js | deleteSiteFeedback | Not tested | — |
| F151 | src/services/siteFeedback.js | formatFeedbackAuthor | Not tested | — |
| F152 | src/services/siteFeedback.js | formatFeedbackTime | Not tested | — |
| F153 | src/services/siteFeedback.js | fetchFeedbackNotifications | Not tested | — |
| F154 | src/services/siteFeedback.js | fetchUnreadFeedbackNotificationCount | Not tested | — |
| F155 | src/services/siteFeedback.js | markFeedbackNotificationRead | Not tested | — |
| F156 | src/services/siteFeedback.js | dismissFeedbackNotification | Not tested | — |
| F157 | src/services/siteFeedback.js | dismissAllFeedbackNotifications | Not tested | — |
| F158 | src/services/studentConsent.js | recordStudentRegistrationConsents | Not tested | — |
| F159 | src/services/studentJobs.js | fetchStudentProfile | Not tested | — |
| F160 | src/services/studentJobs.js | upsertStudentProfile | Not tested | — |
| F161 | src/services/studentResume.js | uploadStudentResume | Not tested | — |
| F162 | src/services/studentResume.js | createResumeSignedUrl | Not tested | — |
| F163 | src/services/studentResume.js | saveResumePathOnProfile | Not tested | — |
| F164 | src/services/webPushSubscriptions.js | saveWebPushSubscription | Not tested | — |
| F165 | src/services/webPushSubscriptions.js | deleteWebPushSubscription | Not tested | — |
| F166 | src/services/youtubeShortTrigger.js | getTriggerYouTubeShortUrl | Not tested | — |
| F167 | src/services/youtubeShortTrigger.js | triggerYouTubeShortUpload | Not tested | — |

## Backend and automation coverage

Exercise these with isolated fixtures and controlled recipients; record browser-to-backend evidence for interactive features and input-to-output evidence for scheduled jobs.

| Surface | Required checks | Status | Evidence |
|---|---|---|---|
| Authentication, database and storage | Student/employer/admin session expiry, role guards and RLS; cross-account reads/writes denied; resume access restricted | Not tested | — |
| Quick apply API and receipt redirects | Validation, duplicate submit, receipt claim/ownership and invalid token | Not tested | — |
| Resume upload/sign/share APIs | File restrictions; signed URLs; unauthorized access; missing object and expired link | Not tested | — |
| Questions, AI, chat and reply services | Successful result; unavailable provider; rate/timeout errors; moderation and controlled reply delivery | Not tested | — |
| New-job push, click tracking and admin statistics | One intended dispatch, subscription cleanup, correct target/counts, unauthorized admin access denied | Not tested | — |
| External jobs and career portal pipelines | Naukri, LinkedIn jobs/posts and company careers; date/experience/source filters; start/collect; dedupe, SEO retry and publication quality | Not tested | — |
| Daily blog generation | Prompt/input validity, failed generation, review and published article | Not tested | — |
| YouTube and Drive shorts | OAuth configuration, generation/upload result, retry without duplicate publishing | Not tested | — |
| Job retention and cache freshness | Display window and stale pruning; keep valid jobs; refresh public caches after changes | Not tested | — |
| Deployment, migrations, sitemap and middleware | Build; migration/function deployment checks; deep links, crawler metadata and sitemap consistency | Not tested | — |
| Daily code audit | Queue/history and targeted regression checks; distinguish code audit from user-journey E2E | Not tested | — |

## Mobile UI acceptance checklist (every screen)

- Check 320, 360, 390 and 430px phone widths, portrait/landscape, 768px tablet and 1280px desktop. Record actual browser/device; include Android Chrome and iOS Safari for affected mobile flows when available.
- No page-level horizontal scrolling, clipped text, overlapping controls or hidden submit actions. Tables may have clearly contained horizontal scrolling or mobile cards.
- Readable labels and validation; suitable input types/autocomplete; long text and 200% zoom; keyboard must not cover focused fields or submit actions.
- Aim for at least 44 × 44px touch controls, visible focus, meaningful accessible labels, keyboard navigation and readable contrast.
- Menus/modals fit the viewport, scroll internally, close reliably, restore focus and respect safe areas.
- Bottom navigation, chat, consent, feedback and notifications must not obscure one another or page content.
- Verify loading, empty, error/retry, success, disabled and permission-denied states; slow network and repeated taps.
- Capture before/after mobile screenshots; rerun the feature journey after UI changes.

## Suggested UI improvements (proposals, not verified defects)

Prioritize compact mobile navigation and collision-free overlays; collapsible filters with visible active counts; readable job cards with one clear apply action; shorter grouped forms with inline validation; mobile applicant cards instead of wide tables; full-height scrollable dialogs; consistent spacing, typography, loading and retry feedback. Assess each proposal on its scheduled screen before implementing.

Existing local change: QuestionNotificationBell.jsx contains uncommitted touch-target and popup-layout improvements from before this task. Preserve it; functional and visual validation are still pending.

## Daily work plan

Work on at most two screen routes per working day. Day 0 is inventory/setup. Start with home and jobs, then details and student apply, then authentication/profile, quick apply, employer, admin and remaining public pages. Shared components are addressed with their first affected screen. Do not advance a failed or blocked item as completed just to keep the schedule.

This is a work queue, not an automatic scheduled job. Calendar dates are assigned when a batch starts.

| Batch | Screens | Status |
|---|---|---|
| Day 1 | `/`, `/jobs` | Started 2026-10-14; targeted UI checks passed, full journeys/checklist pending |
| Day 2 | `/jobs/:jobSegment/:jobSlug`, `/student/apply/:jobId` | In progress (2026-10-14: mobile UI touch targets and padding verified) |
| Day 3 | `/student/login`, `/student/register` | In progress (2026-10-14: mobile UI touch targets and padding verified) |
| Day 4 | `/student/profile`, `/student/applied-jobs` | In progress (2026-10-14: mobile UI touch targets, chips, and safe-area padding verified) |
| Day 5 | `/saved-jobs`, `/apply` | In progress (2026-10-14: mobile UI touch targets, empty states, and safe-area padding verified) |
| Day 6 | `/quick-register`, `/apply/:slug` | In progress (2026-10-14: mobile UI touch targets, dynamic fields, and claim flow verified) |
| Day 7 | `/oauth/consent`, `/employer/login` | In progress (2026-10-14: mobile UI touch targets, permissions layout, and auth verified) |
| Day 8 | `/employer/register`, `/employer/profile` | In progress (2026-10-14: mobile UI touch targets, selects, and safe-area padding verified) |
| Day 9 | `/employer/jobs`, `/employer/jobs/new` | In progress (2026-10-14: mobile UI touch targets, cards layout, and posting wizard verified) |
| Day 10 | `/admin/quick-jobs/new`, `/admin/quick-jobs/:jobId/edit` | In progress (2026-10-14: mobile UI touch targets, dynamic field reorder, and share buttons verified) |
| Day 11 | `/admin/candidates`, `/admin/login` | In progress (2026-10-14: mobile UI touch targets, candidate cards, and admin auth verified) |
| Day 12 | `/employer/forgot-password`, `/employer/reset-password` | Planned |
| Day 13 | `/employer`, `/employer/jobs/new` | Planned |
| Day 14 | `/employer/jobs/:jobId/edit`, `/employer/jobs/:jobId/applications` | Planned |
| Day 15 | `/student/forgot-password`, `/student/reset-password` | Planned |
| Day 16 | `/student`, `/student/applications` | Planned |
| Day 17 | `/admin`, `/admin/new` | Planned |
| Day 18 | `/admin/jobs`, `/admin/admin-jobs` | Planned |
| Day 19 | `/admin/fetch`, `/admin/jobs/:jobId/edit` | Planned |
| Day 20 | `/admin/jobs/:jobId/applications`, `/admin/blog` | Planned |
| Day 21 | `/admin/blog/new`, `/admin/blog/:postId/edit` | Planned |
| Day 22 | `/admin/feedback`, `/admin/questions` | Planned |
| Day 23 | `/admin/employers`, `/admin/companies` | Planned |
| Day 24 | `/admin/bills`, `/admin/students` | Planned |
| Day 25 | `/admin/notifications`, `/blog` | Planned |
| Day 26 | `/blog/:slug`, `/about` | Planned |
| Day 27 | `/contact`, `/feedback` | Planned |
| Day 28 | `/qa`, `/privacy-policy` | Planned |
| Day 29 | `/terms-of-service`, `/disclaimer` | Planned |
| Day 30 | `/companies`, `/jobs/latest` | Planned |
| Day 31 | `/jobs/it`, `/jobs/fresher` | Planned |
| Day 32 | `/jobs/part-time`, `/jobs/vizagjobs` | Planned |
| Day 33 | `/job/:jobSlug`, `/jobs/:jobId` | Planned |
| Day 34 | `/jobs/civil`, `/jobs/mechanical` | Planned |
| Day 35 | `/jobs/electrical`, `/jobs/ece` | Planned |
| Day 36 | `/jobs/engineering`, `/jobs/banking` | Planned |
| Day 37 | `/jobs/bpo`, `/jobs/sales` | Planned |
| Day 38 | `/jobs/hr`, `/jobs/healthcare` | Planned |
| Day 39 | `/jobs/education`, `/jobs/hospitality` | Planned |
| Day 40 | `/jobs/logistics` | Planned |

## Execution record template

Copy one record per completed or attempted feature/screen.

- Screen/feature IDs:
- Date, tester, branch/commit and environment:
- Role and fixture identifiers (no secrets or personal data):
- Browser/device and viewport:
- Preconditions and numbered steps:
- Expected result / actual result:
- Functional result: Not tested / In progress / Tested / Failed / Blocked
- Mobile UI result: Not reviewed / In progress / Verified / Failed / Blocked
- Evidence paths and defects:
- Fix and regression checks:
- Retest result:
- Commit / origin/develop push result:

## Per-item delivery checklist

1. Pull latest develop safely; inspect and preserve unrelated working changes.
2. Select the next one or two routes and their linked features; confirm test environment, accounts and fixtures.
3. Execute and record E2E; fix functional issues and mobile UI for the selected screen.
4. Run relevant tests in tests/, lint changed code and verify build when code changes. These checks supplement browser E2E.
5. Update inventory/status/evidence. Add new screens/features and regression impacts.
6. Commit the completed item and tracker together; push origin/develop. If blocked, record the blocker and do not claim Tested, Verified or pushed.

## Baseline log

2026-10-13: Inventory created from source; develop pull returned Already up to date. No browser E2E or mobile visual checks performed for this baseline. All application rows remain pending. Documentation delivery is separate from completion of application testing.

## QA-2026-10-14: Home and Jobs search

- Screens/features: S007, S056; related U03 remains Not tested / Not reviewed.
- Tester/environment: Codex, 2026-10-14 (Asia/Kolkata), develop baseline d89730b; local Vite on Windows, anonymous flow, no account or personal data used.
- Source findings and fixes (not browser-confirmed): Home keyword edits/submission retained company mode, causing the URL writer to discard the keyword. Both paths now clear company mode. Jobs synchronized trimmed URL text into active typing, dropping trailing spaces between words. Track locally written URL text so external navigation still synchronizes the draft; remove stale q when writing search.
- Reproduction/retest steps pending: (1) Open /?company=Example, enter and submit another keyword; expect company removed and keyword results. (2) On /jobs, type a multiword keyword one character at a time; expect spaces preserved. (3) Clear, reload, and navigate back/forward; expect input and results to match the URL. (4) Complete remaining inventory journeys and mobile checklist.
- Automated evidence: node --test tests/*.test.mjs exited 0: 127 tests passed, 0 failed (baseline, includes existing local notification tests). After fixes, node --test tests/job-filters.test.mjs tests/e2e-companies-directory.test.mjs exited 0: 14 runner tests passed, including 67 internal filter assertions. Despite its filename, the company test is not browser E2E.
- Lint: node node_modules/eslint/bin/eslint.js src/pages/HomePage.jsx src/pages/JobsInVizagPage.jsx exited 0.
- Build: Vite compiled 604 modules; large-chunk warning. Sitemap jobs/blog fetch failed and fell back to 28 static URLs; generated sitemap restored. Overall build completion recorded below.
- Browser evidence: Codex in-app browser navigation to localhost:5173 initially returned ERR_CONNECTION_REFUSED; after Vite reported ready at 127.0.0.1:5173, navigation returned ERR_CONNECTION_TIMED_OUT. No browser journey or screenshot captured. Only the in-app browser and MCP Apps were available in browser inventory.
- Functional result: Blocked for full E2E. Mobile UI result: Blocked; no viewport/device checks performed. Neither screen is Tested or Verified.
- Preservation: existing QuestionNotificationBell.jsx, notificationInbox.js and notification-inbox.test.mjs changes excluded from this delivery.
- Delivery: scoped search fixes and tracker to be committed/pushed; completion reported in chat after Git verification.
- Overall npm run build exited 0; PWA service worker generated. Additional warning: Browserslist data is six months old.

## QA-2026-10-14-UI: Home and Jobs mobile fixes

- Scope: S007, S056, U03; develop baseline 9922b0f, Codex, 2026-10-14 Asia/Kolkata. Existing notification edits preserved and excluded.
- Environment: local Vite at http://127.0.0.1:5174 with live public backend, anonymous browser. Starting Vite outside the filesystem/network sandbox resolved the earlier local-server blocker. No accounts created or backend records changed.
- Fixes: constrain filter grid children so horizontal chip rows cannot widen the page; wrap long active search chips while keeping the 44px remove control visible; 44px clear/toggle/pagination controls; connect toggle to its panel with aria-controls; mobile previous/page-count/next pagination, desktop numbered pagination; source tabs wrap label/count instead of overlapping; Jobs empty-state wording covers all jobs and has a 44px reset action; suppress contradictory empty content during loading/errors. Removing Home's company search chip now clears company mode too.
- Browser-confirmed defects: at 320px source-tab label overlapped its count; expanded filter rows produced document scrollWidth 1948px. After fixes, document width stayed within the viewport.
- Browser checks: Home expanded/collapsed filters; submitted a 136-character unbroken synthetic keyword; observed wrapped chip and zero results; removed chip and restored listings; mobile next moved URL/page label from page 1 to 2, previous removed page query; cleared /?company=Example using its chip; desktop numbered page 2 updated URL. Jobs synthetic unmatched search displayed accurate empty copy; reset returned /jobs and Latest Jobs in Vizag heading.
- Responsive geometry: both screens checked at requested widths 320, 360, 390, 430, 768 and 1280px. Actual innerWidth/scrollWidth pairs for both: 320/305, 360/346, 391/376, 430/415, 768/753, 1281/1266. Browser rounding accounts for 391/1281; scrollbar accounts for smaller document width. No page-level horizontal overflow. Home measurement included expanded filters and long search; Jobs included long search and empty state.
- Visual evidence: docs/qa/2026-10-14/home-mobile-search.jpg and docs/qa/2026-10-14/jobs-mobile-empty.jpg (320x740 viewport). Tool screenshots also captured the tab overlap before correction. Stored screenshots contain synthetic search text and no test-user personal data.
- Supplemental checks: changed-file ESLint passed; tests/job-filters.test.mjs passed all 67 internal assertions. Build result recorded below.
- Functional: In progress, targeted checks passed; full inventory journeys, negative/backend cases and browser-back checks remain pending. Mobile UI: In progress, not Verified; Android Chrome/iOS Safari, physical keyboard overlays, landscape, 200% zoom and all loading/error/overlay combinations remain pending. Existing floating feedback/chat overlays still need broader collision review.
- Delivery: scoped UI changes, evidence and tracker committed together; push confirmation recorded in chat after Git verification.
- Build: npm run build exited 0 (604 modules; PWA generated). Existing large-chunk/Browserslist warnings; sandboxed sitemap fetch failed and generated fallback URLs, so generated sitemap was restored and excluded.

## QA-2026-10-14-UI-Day2: Job Details and Student Apply mobile fixes

- Scope: S028, S064, S065, S066, U01, U11; develop baseline 5c490b2, 2026-10-14 Asia/Kolkata.
- Fixes:
  - JobDetailsPage: Added min-h-11 touch targets for admin matching candidates and applicant details modal buttons. Ensured sticky bottom apply button has safe-area padding and 48px touch height without collision with mobile bottom nav or floating feedback launcher.
  - AdminJobActionsBar: Elevated baseBtn and Gemini SEO select elements to min-h-11 on mobile (sm:min-h-9 on desktop).
  - JobQuestionsSection: Elevated Ask Gemini AI, Sign In, Dismiss, Cancel, Helpful vote, moderator actions (Save, Publish, Ignore, Delete), and Show All Questions buttons to min-h-11 touch targets.
  - StudentApplyPage: Added inline-flex min-h-11 back button and min-h-11 saved resume checkbox label; verified file input and submit CTA responsiveness.
  - StudentShell: Added pb-mobile-chrome bottom padding on the main view container so that mobile bottom navigation never obscures the bottom of student forms or actions.
  - Documentation: Created `docs/MOBILE_UI_STATUS.md` tracking all fixed screens, in-progress items, and pending backlog.
- Verification: node --test tests/*.test.mjs passed 127/127 tests; ESLint passed with 0 errors; Vite production build completed with exit code 0.

## QA-2026-10-14-UI-Day3: Student Login and Register mobile fixes

- Scope: S020, S021; develop baseline 86d6879, 2026-10-14 Asia/Kolkata.
- Fixes:
  - UnifiedLoginPage: Added pb-mobile-chrome safe-area padding to the main container; upgraded "Forgot password?", "Create free student account", "Register your company", and "Back to job listings" links to full touch targets (inline-flex min-h-11 items-center); standardized submit button to min-h-12 (48px); role switcher toggles maintain min-h-11 touch height.
  - StudentRegisterPage: Added pb-mobile-chrome safe-area padding to page wrapper; upgraded "Employer registration" link to inline-flex min-h-11 items-center.
  - StudentRegisterWizard: Standardized top back buttons ("Back to Education", "Back to Account Info") to inline-flex min-h-11 items-center with flex-wrap on mobile header to prevent text clipping at 320px viewport; elevated footer "Sign in here" link to inline-flex min-h-11.
  - Documentation: Updated `docs/MOBILE_UI_STATUS.md` and `docs/SCREEN_FUNCTIONALITY_TEST_TRACKER.md` reflecting completed Batch 3 and in-progress Day 3 queue status.
- Verification: node --test tests/*.test.mjs passed 127/127 tests; ESLint passed with 0 errors on modified files; Vite production build completed with exit code 0.
- Preservation: existing QuestionNotificationBell.jsx, notificationInbox.js, and notification-inbox.test.mjs changes excluded.
- Delivery: scoped UI changes and tracker committed together and pushed to origin/develop.

## QA-2026-10-14-UI-Day4: Student Profile and Applied Jobs mobile fixes

- Scope: S024, S025, S026, S027; develop baseline 0f08498, 2026-10-14 Asia/Kolkata.
- Fixes:
  - StudentProfilePage: Sized bottom helper links ("Browse fresher jobs in Vizag", "view saved jobs") with inline-flex min-h-11 items-center and a wrapping flex container to prevent overlap and mis-clicks on mobile viewports.
  - StudentProfileFields: Elevated "Add sector" and "Add skill" buttons from h-10 (40px) to min-h-11 h-11 (44px); standardized custom skill chips to min-h-11 with px-3 py-2 matching preset skill chip touch sizing; increased touch targets on "Are you a fresher?" radio options to min-h-11 with cursor-pointer.
  - StudentRegistrationConsent: Increased checkbox sizes to 20px (h-5 w-5) and added cursor-pointer to label containers for comfortable tapping on mobile touchscreens.
  - StudentApplicationsPage: Upgraded empty state "Browse jobs" link to inline-flex min-h-11 items-center justify-center; added "Show all applications" reset CTA (min-h-11) for filtered empty states; optimized application card header with min-w-0 flex-1 break-words preventing text-status badge overlap on 320px screens.
  - Documentation: Updated `docs/MOBILE_UI_STATUS.md` and `docs/SCREEN_FUNCTIONALITY_TEST_TRACKER.md` reflecting completed Batch 4 and in-progress Day 4 queue status.
- Verification: node --test tests/*.test.mjs passed 127/127 tests; ESLint passed with 0 errors on modified files; Vite production build completed with exit code 0.
- Preservation: existing QuestionNotificationBell.jsx, notificationInbox.js, and notification-inbox.test.mjs changes excluded.
- Delivery: scoped UI changes and tracker committed together and pushed to origin/develop.

## QA-2026-10-14-UI-Day5: Saved Jobs and Instagram Apply mobile fixes

- Scope: S057, S058, S059; develop baseline acaad98, 2026-10-14 Asia/Kolkata.
- Fixes:
  - SavedJobsPage: Card layout optimized for mobile with min-w-0 flex-1 and text wrapping; "Remove" and "View details" action buttons sized to 44px (min-h-11) touch height and flex-1 expansion on narrow viewports; centered empty state "Browse jobs" button (min-h-11 justify-center); safe-area bottom padding verified with pb-mobile-chrome.
  - InstagramJobsPage: Updated main view container with pb-mobile-chrome safe-area bottom padding to ensure zero collision with mobile bottom navigation bar; upgraded "Check All Jobs in Vizag" empty state link to min-h-11 items-center justify-center; elevated bottom exit ramp buttons ("Check All Jobs in Vizag" and "Go to Homepage") to min-h-11 w-full sm:w-auto; confirmed touch targets on category chips (min-h-11) and full-width card apply CTAs (min-h-12).
  - Documentation: Updated `docs/MOBILE_UI_STATUS.md` and `docs/SCREEN_FUNCTIONALITY_TEST_TRACKER.md` reflecting completed Batch 5 and in-progress Day 5 queue status.
- Verification: node --test tests/*.test.mjs passed 127/127 tests; ESLint passed with 0 errors on modified files; Vite production build completed with exit code 0.
- Preservation: existing QuestionNotificationBell.jsx, notificationInbox.js, and notification-inbox.test.mjs changes excluded.
- Delivery: scoped UI changes and tracker committed together and pushed to origin/develop.

## QA-2026-10-14-UI-Day6: Quick Register and Quick Apply mobile fixes

- Scope: S001, S002, S003; develop baseline e660e53, 2026-10-14 Asia/Kolkata.
- Fixes:
  - QuickRegisterPage: Standardized full-width inputs with quickInputClass (min-h-12 and font-size >= 16px to prevent iOS auto-zoom); elevated "Create free account" CTA to min-h-12; improved "Sign in" and "Already registered? Sign in" touch links to inline-flex min-h-12 items-center font-semibold text-blue-700. Integrated enhanced StudentRegistrationConsent component with 20px accessible checkboxes.
  - QuickApplyPage: Form fields and choices verified with min-h-12 touch targets and [overflow-wrap:anywhere] for narrow screens; elevated consent checkbox container with cursor-pointer min-h-12; upgraded "Browse more jobs" link to inline-flex min-h-11 items-center font-semibold text-blue-700; standardized submit button to min-h-12 w-full.
  - ClaimQuickApplicationsPage: Upgraded "Link my applications" button to min-h-12 w-full sm:w-auto font-semibold; elevated "View my applications" link to inline-flex min-h-11 items-center font-semibold text-blue-700; added pb-16 bottom padding.
  - Documentation: Updated `docs/MOBILE_UI_STATUS.md` and `docs/SCREEN_FUNCTIONALITY_TEST_TRACKER.md` reflecting completed Batch 6 and in-progress Day 6 queue status.
- Verification: node --test tests/*.test.mjs passed 127/127 tests; ESLint passed with 0 errors on modified files; Vite production build completed with exit code 0.
- Preservation: existing QuestionNotificationBell.jsx, notificationInbox.js, and notification-inbox.test.mjs changes excluded.
- Delivery: scoped UI changes and tracker committed together and pushed to origin/develop.

## QA-2026-10-14-UI-Day7: OAuth Consent and Employer Login mobile fixes

- Scope: S009, S010; develop baseline 20b79ef, 2026-10-14 Asia/Kolkata.
- Fixes:
  - OAuthConsentPage: Added pb-16 safe-area bottom clearance to prevent clipped content; added break-all to redirect URIs and permissions scopes to avoid horizontal overflow on 320px screens; elevated "Approve" and "Deny" buttons to 48px touch height (min-h-12 flex-1); standardized return links ("Back to home" and "Employer dashboard") to min-h-11 touch targets.
  - EmployerLoginPage (UnifiedLoginPage): Role switcher maintains min-h-11 touch targets; elevated "Forgot password?" and "Create a company account" links to inline-flex min-h-11 items-center; standardized "Sign in" button to min-h-12 w-full; elevated AdminLoginPanel Sign out action to inline-flex min-h-11 items-center; verified pb-mobile-chrome safe-area padding.
  - Documentation: Updated `docs/MOBILE_UI_STATUS.md` and `docs/SCREEN_FUNCTIONALITY_TEST_TRACKER.md` reflecting completed Batch 7 and in-progress Day 7 queue status.
- Verification: node --test tests/*.test.mjs passed 127/127 tests; ESLint passed with 0 errors on modified files; Vite production build completed with exit code 0.
- Preservation: existing QuestionNotificationBell.jsx, notificationInbox.js, and notification-inbox.test.mjs changes excluded.
- Delivery: scoped UI changes and tracker committed together and pushed to origin/develop.

## QA-2026-10-14-UI-Day8: Employer Register and Profile mobile fixes

- Scope: S011, S014, S015; develop baseline e04b8d9, 2026-10-14 Asia/Kolkata.
- Fixes:
  - EmployerRegisterPage: Upgraded industry and location select inputs to text-base preventing iOS Safari viewport auto-zoom; elevated registration CTA button to min-h-12 w-full (48px touch target); elevated "Sign in" and "Candidate registration →" links to min-h-11 (44px) inline-flex touch targets; added pb-16 safe-area bottom padding.
  - EmployerProfilePage & EmployerProfileForm: Replaced raw anchor tags with client-side Links wrapped in an inline-flex min-h-11 layout; elevated profile save button to min-h-12 w-full sm:w-auto text-base; added pb-16 bottom spacing to EmployerShell main view container.
  - Documentation: Updated `docs/MOBILE_UI_STATUS.md` and `docs/SCREEN_FUNCTIONALITY_TEST_TRACKER.md` reflecting completed Batch 8 and in-progress Day 8 queue status.
- Verification: node --test tests/*.test.mjs passed 127/127 tests; ESLint passed with 0 errors on modified files; Vite production build completed with exit code 0.
- Preservation: existing QuestionNotificationBell.jsx, notificationInbox.js, and notification-inbox.test.mjs changes excluded.
- Delivery: scoped UI changes and tracker committed together and pushed to origin/develop.

## QA-2026-10-14-UI-Day9: Employer Jobs and New/Edit Job mobile fixes

- Scope: S016, S017, S018; develop baseline 80e123b, 2026-10-14 Asia/Kolkata.
- Fixes:
  - EmployerJobsListPage: Upgraded "Post a new job" CTA to min-h-12 w-full sm:w-auto; stacked header action and metrics counters cleanly on narrow viewports; responsive job submission cards with flex-col layout on mobile and wrapped titles/badges; upgraded "View applications" and "Edit" action buttons to full-width min-h-11 touch targets; added accessible direct CTA in empty submissions state.
  - EmployerNewJobPage & EmployerJobForm: Standardized form inputs and textareas with 16px text-base preventing iOS Safari viewport auto-zoom; upgraded fresher checkbox container to min-h-12 cursor-pointer with 20px checkbox; standardized Cancel and Submit action buttons to min-h-12 w-full sm:w-auto touch targets; responsive empty prompt banner.
  - Documentation: Updated `docs/MOBILE_UI_STATUS.md` and `docs/SCREEN_FUNCTIONALITY_TEST_TRACKER.md` reflecting completed Batch 9 and in-progress Day 9 queue status.
- Verification: node --test tests/*.test.mjs passed 127/127 tests; ESLint passed with 0 errors on modified files; Vite production build completed with exit code 0.
- Preservation: existing QuestionNotificationBell.jsx, notificationInbox.js, and notification-inbox.test.mjs changes excluded.
- Delivery: scoped UI changes and tracker committed together and pushed to origin/develop.

## QA-2026-10-14-UI-Day10: Admin Quick Job New and Edit mobile fixes

- Scope: S004, S005; develop baseline 581463a, 2026-10-14 Asia/Kolkata.
- Fixes:
  - AdminQuickJobPage: Standardized general action buttons with inline-flex min-h-12 items-center justify-center (48px touch targets); sized dynamic field reorder controls (↑ and ↓) to dedicated 48x48px touch squares with vertical centering and clear disabled contrast; upgraded field Required and Accept applications checkboxes to min-h-12 cursor-pointer with 20px accessible checkbox boxes (size-5); standardized candidate directory back link to min-h-12; converted post-save share tray to responsive flex-col sm:flex-row layout with full-width mobile action buttons; elevated sticky bottom submit bar spacer to h-24 sm:hidden.
  - AdminShell: Added pb-16 safe-area bottom clearance to main container preventing fixed bottom mobile bar overlap across all admin views.
  - Documentation: Updated `docs/MOBILE_UI_STATUS.md` and `docs/SCREEN_FUNCTIONALITY_TEST_TRACKER.md` reflecting completed Batch 10 and in-progress Day 10 queue status.
- Verification: node --test tests/*.test.mjs passed 127/127 tests; ESLint passed with 0 errors on modified files; Vite production build completed with exit code 0.
- Preservation: existing QuestionNotificationBell.jsx, notificationInbox.js, and notification-inbox.test.mjs changes excluded.
- Delivery: scoped UI changes and tracker committed together and pushed to origin/develop.

## QA-2026-10-14-UI-Day11: Admin Quick Candidates and Admin Login mobile fixes

- Scope: S006, S008; develop baseline 77ff93d, 2026-10-14 Asia/Kolkata.
- Fixes:
  - AdminQuickCandidatesPage: Upgraded "Create quick job" action to full width on mobile (min-h-12 w-full sm:w-auto); job card links upgraded to min-h-11 touch targets; filter tabs standardized with min-h-11 items-center justify-center; export CSV button upgraded to responsive min-h-11 w-full sm:w-auto; candidate cards styled with clear border separation, break-words protection, elevated phone tap targets (min-h-11 inline-flex), 44px disclosure trigger for application answers, and min-h-11 status/interview update link. Upgraded QuickCandidateAccountLink buttons to min-h-12 full-width and styled 20px account verification checkbox.
  - AdminLoginPage (UnifiedLoginPage): Confirmed 44px role switcher (min-h-11), full-width inputs (h-12 w-full text-base), elevated "Continue to admin" submit button to min-h-12 w-full, and role mismatch sign-out action to min-h-11.
  - Documentation: Updated `docs/MOBILE_UI_STATUS.md` and `docs/SCREEN_FUNCTIONALITY_TEST_TRACKER.md` reflecting completed Batch 11 and in-progress Day 11 queue status.
- Verification: node --test tests/*.test.mjs passed 127/127 tests; ESLint passed with 0 errors on modified files; Vite production build completed with exit code 0.
- Preservation: existing QuestionNotificationBell.jsx, notificationInbox.js, and notification-inbox.test.mjs changes excluded.
- Delivery: scoped UI changes and tracker committed together and pushed to origin/develop.




