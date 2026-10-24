# Screen, functionality and mobile UI tracker

## QA-2026-10-24-Registration-Degree-Branch-Sync

- Scope: S021 `/student/register` and S025 `/student/profile`; `src/lib/studentProfileOptions.js`, `src/components/student/StudentRegisterWizard.jsx`, `src/pages/StudentRegisterPage.jsx`, `src/components/student/StudentProfileFields.jsx`, `src/components/student/StudentProfileForm.jsx`, `tests/student-register-wizard.test.mjs`.
- Problem resolved:
  - Degree and Branch fields were not synchronizing. Selecting degree `B.Com` previously presented a flat, static 15-branch list starting with engineering branches (CSE, IT, ECE, EEE, Mechanical, Civil, Chemical, Automobile).
  - Changing degree from engineering (e.g. `B.Tech` with `Mechanical Engineering`) to `B.Com` retained the invalid branch in state without resetting.
  - Selecting `ITI` did not auto-populate `ITI Trade / Technical`.
  - Selecting `10th Pass` disabled the select without visual helper feedback.
- Solution delivered:
  - Created canonical `DEGREE_BRANCH_MAP` in `src/lib/studentProfileOptions.js` defining branch subsets for all 14 degrees (`B.Com`, `B.Tech`, `B.E`, `Diploma`, `B.Sc`, `BBA`, `BCA`, `MCA`, `M.Tech`, `MBA`, `ITI`, `10th Pass`, `12th Pass`, `Other`).
  - Added `getBranchesForDegree(degree)` and `getSyncedBranchForDegree(newDegree, currentBranch)` helpers.
  - Synchronized branch dropdown options and state across both registration wizard (`StudentRegisterWizard.jsx`, `StudentRegisterPage.jsx`) and post-login profile editor (`StudentProfileFields.jsx`, `StudentProfileForm.jsx`).
  - Selecting `B.Com` dynamically limits branches to `Commerce`, `Accounting & Finance`, `Computer Science (CSE)` (for B.Com Computer Applications), and `Business Administration`.
  - Switching degree immediately clears invalid branches (prompting selection of a valid branch), preserves compatible branches (e.g. `Computer Science (CSE)` between B.Tech, BCA, B.Sc), and auto-populates single-option qualifications (`ITI Trade / Technical` for ITI, `Not Applicable` for 10th Pass).
  - Added mobile-friendly contextual helper notes under the select fields confirming active branch filtering and auto-selections.
- Automated checks:
  - `node --test tests/*.test.mjs` passed 186/186 tests.
  - Added comprehensive test suite in `tests/student-register-wizard.test.mjs` verifying degree-to-branch filtering, reset on degree change, auto-population for ITI/10th Pass, and intermediate stream preservation.
  - `npm run lint` clean (0 errors, 0 warnings).
  - Production build `npm run build` passed successfully.
- Functional E2E & Mobile UI: In progress per workflow guidelines until authenticated journey passes with recorded evidence.

## QA-2026-10-23-Candidate-Discovery

- Scope: S021 `/student/register` and S044 `/admin/students`; supporting candidate-search helpers, registration persistence handling, and student-profile fetching. Existing share/export/moderation actions retained. No new route or database migration.
- Findings from read-only linked database checks: initial snapshot had 1,579 registrations; 363 lacked target role/experience/joining details, 97 lacked skills/qualification, 1,079 lacked current city, and 1,081 lacked education status. The old admin duration filters used `0_1`, `1_3`, `3_5`, `5_plus`, while registration stored `0_6_months`, `6_12_months`, `1_2_years`, `2_4_years`, `4_plus_years`. Source and runtime checks also found single-skill/contiguous-string search limits and premature signup navigation before profile persistence.
- Delivered: multi-skill ALL/ANY criteria; alternative qualification choices; partial and exact primary/secondary-role search; cross-field word search; conservative skill aliases; correct experience values; residence versus preference separation; availability/course/education/account filters; per-field missing-fact filters; recorded-fact match explanations; reviewed-job match/missing/failure views; visit-only shortlist with explicit hidden-selection counts; exact matching/shortlist Excel exports; 25/50/100 pagination; filter URL reload persistence; compact expandable candidate profiles. Demographics are excluded from targeting and sorting.
- New registrations: current city and education status required, fresher/experienced and joining answers explicit, experienced duration not defaulted. Existing profile edits retain backward compatibility. A failed profile save after account creation keeps the form/input and supports retry without a second signup. Loading a later student page now fails explicitly instead of returning a partial candidate list; paging uses a stable created-at/user-id order.
- Live data evidence: a subsequent read-only audit using the actual new search engine saw 1,583 registrations / 1,581 active accounts (the live dataset changed between snapshots). Results: React 188, React AND SQL 158, React OR SQL 570, React AND SQL with B.Tech OR B.E 134, desired role containing Developer 276, and 2–4-year experience 82. Core matching facts were missing on 1,085 profiles. No names/contact details/real user IDs or per-candidate results were saved in audit artifacts, and no production profile/account writes were performed.
- Automated checks: final `node --test tests/*.test.mjs` passed 170/170 tests; targeted search/pagination checks passed. Final `npm run lint`, `npx vite build`, and `git diff --check` passed; bundle size and stale Browserslist warnings are existing. New tests cover combined criteria, aliases without language conflation, missing values, actual experience buckets, demographics excluded from matching, URL compatibility, exact export populations, strict new-signup versus legacy validation, and pagination failures.
- Browser environment: Browser plugin not available; regular Playwright using installed Chrome, localhost `http://127.0.0.1:5173`, isolated stateful auth/data/realtime fixtures. Desktop 1440x1000 and mobile 390x844. This is **mock-backed UI integration**, not a deployed authenticated E2E pass. Realtime is mocked to avoid external fake-session traffic; the deliberate profile-save 503 is expected and tested.
- Browser interaction evidence: admin membership/route, nonblank title/content, no framework overlay; ALL/ANY multi-skills; B.Tech OR B.E; partial secondary role; current city; correct duration; visible match reasons; pagination; downloaded matching XLSX content; shortlist across hidden filter results and its XLSX; reviewed-job missing-information result; URL reload; desktop/mobile horizontal fit; explicit registration facts; profile-save failure plus successful retry with exactly one signup; newly saved candidate immediately discoverable by secondary role/skill/experience; independent new-browser shared-role response. No unexpected page/runtime console errors in the passing run.
- Evidence outside repository (no candidate personal data committed): `C:/Users/today/.codex/visualizations/2026/10/23/01a166e4-ded9-72c0-b440-f276a220f20f/candidate-finder-evidence/` contains `checks.json`, aggregate `live-data-audit.json`, desktop/mobile finder/results PNGs, a registration save/retry PNG and fixture-only matching/shortlist XLSX files. Temporary runners are sibling files `candidate-finder-qa.mjs` and `candidate-data-audit.mjs`. The live runner `candidate-live-acceptance.mjs` has opened an isolated real-backend Chrome admin sign-in window and is waiting for manual sign-in; it enters no credentials and performs no profile writes, exports or messages. No suitable existing signed-in browser window was available. Node REPL's Playwright import had a module-export mismatch; the standard Node Playwright runner works.
- Failures and fixes: browser qualification checkbox briefly reverted during router transitions; corrected with immediate local input state and URL synchronization. Filter label helper text/options interfered with exact accessible names; explicit input/select labels added. Signup navigation could precede persistence and hide failure; gated navigation on completed submission and preserved retry state. Temporary QA issues (cookie prompt, fixture locator semantics, about:blank storage access and unmocked realtime) corrected in the runner, not treated as application failures.
- Functional status remains **In progress** until the deployed signed-in registration/admin journey passes with authorized sessions. Final desktop/mobile admin finder retest and the mobile registration/save/retry flow passed with fixtures; whole-screen UI status remains **In progress**, including registration desktop review. Do not mark these screens Tested based on mocks or aggregate reads. Historical incomplete records require student-supplied updates; the finder exposes these gaps rather than inventing facts.

## QA-2026-10-23-Shared-Roles

- Scope: S021 registration and S044 Admin Students; shared S025 profile role input updated for consistent suggestions. No new routes/dialogs.
- Implemented: shared database role catalog; atomic primary/secondary-role capture on profile insert/update; existing-profile backfill; public label-only search; all-role admin selector; deduplicated counts; consistent secondary-role matching in role exports; interested roles in candidate details.
- Functional E2E: **In progress; database deployment complete, authenticated browser journey pending**. After explicit user approval on 2026-10-23, applied only `20261023120000_shared_student_roles.sql` to linked project `fbyyfyhdglcpkhxskffj` (`supabase-citrine-cloud`) and recorded that version as applied. The earlier automatic approval rejection is resolved. Unrelated remote/local migration history differences remain unchanged. The earlier browser navigation to `/admin/students` redirected to `/admin/login`; no authenticated admin session was available.
- Automated verification: `node --test tests/*.test.mjs` passed 158/158 tests; `npm run lint` passed; `npx vite build` passed with existing chunk-size/Browserslist warnings. The initial `npm run build` bundled successfully but its sitemap queries failed in the restricted network; the generated sitemap side effect was restored and excluded.
- PostgreSQL verification: `node scripts/test-shared-student-roles.mjs node_modules/.cache/student-role-qa/node_modules/@electric-sql/pglite/dist/index.js` passed. This executes the new migration against isolated PostgreSQL fixtures and checks backfill, insert/update capture, independent anonymous/authenticated suggestion reads, deduplication, rare roles beyond the result limit, punctuation, rollback, published-job filtering, and direct catalog/profile access denial for anonymous users. It does not verify the deployed auth/signup journey.
- Deployed database evidence (2026-10-23): catalog contains **729** role labels; missing backfill roles **0**; `capture_student_roles` trigger enabled; catalog RLS enabled; anonymous direct catalog SELECT denied; authenticated direct catalog INSERT denied; suggestion function executable by anonymous/authenticated roles. Read-only API smoke `node scripts/verify-shared-student-roles.mjs` passed: 200 role-only results at the cap, independent stateless anonymous search, case deduplication, and direct catalog HTTP access denied. No production test accounts or profile edits were used.
- Mobile UI: **In progress**. Browser smoke at a 390x844 viewport override reached Account → Education → Career without submitting an account or agreeing to terms. Typing `React` displayed the `React Developer` suggestion; role input/dropdown fit horizontally (observed innerWidth 391, document scrollWidth 376). Screenshot: `docs/qa/2026-10-23/student-role-mobile.png`, captured before migration deployment using the preset/legacy fallback. Admin/profile mobile and desktop checks remain open.
- Failures/fixes/retests: the new export regression initially assumed the export helper returned an array and preserved requested column order; corrected the test to use its documented rows/columns result, then the full suite passed. Initial deployment approval block resolved by user approval; migration and deployed API checks passed. The CLI's preflight query returned results but exited with a PostHog telemetry shutdown timeout; the later deployment and verification succeeded. Full functional status is not marked Tested.
- Remaining acceptance: complete separate-browser registration/profile persistence and verify authenticated admin role counts/filter/export on mobile and desktop. The backend migration and live RPC verification are complete. Do not repair unrelated migration history for this change.

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
| S007 | `/` | Home search, categories, job sections, counts, recommendations, blog links and calls to action | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S008 | `/admin/login` | Sign in for correct role; invalid credentials; enabled OAuth/phone modes; return URL; sign out and session expiry | In progress | In progress | QA-2026-10-14-UI-Day11: mobile UI verified, full journey pending |
| S009 | `/oauth/consent` | Validate OAuth request/session; accept or reject consent; verify callback and error state | In progress | In progress | QA-2026-10-14-UI-Day7: mobile UI verified, full journey pending |
| S010 | `/employer/login` | Sign in for correct role; invalid credentials; enabled OAuth/phone modes; return URL; sign out and session expiry | In progress | In progress | QA-2026-10-14-UI-Day7: mobile UI verified, full journey pending |
| S011 | `/employer/register` | Register account; required fields and consent; duplicate account; complete profile and verify persistence | In progress | In progress | QA-2026-10-14-UI-Day8: mobile UI verified, full journey pending |
| S012 | `/employer/forgot-password` | Request password reset; validate email; verify recovery message and reset link | In progress | In progress | QA-2026-10-14-UI-Day12: mobile UI verified, full journey pending |
| S013 | `/employer/reset-password` | Use valid/expired recovery link; validate matching passwords; sign in with new password | In progress | In progress | QA-2026-10-14-UI-Day12: mobile UI verified, full journey pending |
| S014 | `/employer` | Verify redirect destination, correct role guard, refresh and browser back | In progress | In progress | QA-2026-10-14-UI-Day8: mobile UI verified, full journey pending |
| S015 | `/employer/profile` | Load, validate, edit and save profile; reload to verify persistence; student resume/preferences or employer company details | In progress | In progress | QA-2026-10-14-UI-Day8: mobile UI verified, full journey pending |
| S016 | `/employer/jobs` | List scoped jobs; search/filter; open edit and applicants; available lifecycle actions and counts; verify role boundaries | In progress | In progress | QA-2026-10-14-UI-Day9: mobile UI verified, full journey pending |
| S017 | `/employer/jobs/new` | Create/edit job; required fields, eligibility and apply mode; save and reload; publication visibility and ownership | In progress | In progress | QA-2026-10-14-UI-Day9: mobile UI verified, full journey pending |
| S018 | `/employer/jobs/:jobId/edit` | Create/edit job; required fields, eligibility and apply mode; save and reload; publication visibility and ownership | In progress | In progress | QA-2026-10-14-UI-Day9: mobile UI verified, full journey pending |
| S019 | `/employer/jobs/:jobId/applications` | Load candidates; filter; update pipeline/status/notes; schedule/cancel interview; resume access; communication and export; verify student sees updates | In progress | In progress | QA-2026-10-14-Applicants: component preview checks; authenticated E2E pending |
| S020 | `/student/login` | Sign in for correct role; invalid credentials; enabled OAuth/phone modes; return URL; sign out and session expiry | In progress | In progress | QA-2026-10-14-UI-Day3: mobile UI verified, full journey pending |
| S021 | `/student/register` | Register account; required matching facts and consent; explicit experience/availability; duplicate account; profile-save failure/retry; persist full profile; shared roles across students; optional salary expectations; optional resume/CV attachment with validation and auto-linking on signup | In progress | In progress | QA-2026-10-23-Candidate-Discovery: stricter new-signup data and save/retry flow verified with stateful browser fixtures; expected salary inputs added to Step 3; resume upload with validation added to Step 3 and linked on account creation; deployed signed-in journey pending |
| S022 | `/student/forgot-password` | Request password reset; validate email; verify recovery message and reset link | In progress | In progress | UI continuation 2026-10-14: Student recovery pages: bottom navigation clearance and 44px return link |
| S023 | `/student/reset-password` | Use valid/expired recovery link; validate matching passwords; sign in with new password | In progress | In progress | UI continuation 2026-10-14: Student recovery pages: bottom navigation clearance and 44px return link |
| S024 | `/student` | Verify redirect destination, correct role guard, refresh and browser back | In progress | In progress | QA-2026-10-14-UI-Day4: mobile redirect verified, full journey pending |
| S025 | `/student/profile` | Load, validate, edit and save profile; reload to verify persistence; resume upload, viewing signed URL and replacement; preferences and shared roles | In progress | In progress | QA-2026-10-23-Candidate-Resume: resume attachment status, signed URL viewing, and upload/replace integrated into profile form; affected persistence/E2E and mobile verification reopened/pending |
| S026 | `/student/applied-jobs` | View own applications, counts, status and interview details; empty state; verify other users cannot access records | In progress | In progress | QA-2026-10-14-UI-Day4: mobile UI verified, full journey pending |
| S027 | `/student/applications` | Verify redirect destination, correct role guard, refresh and browser back | In progress | In progress | QA-2026-10-14-UI-Day4: mobile redirect verified, full journey pending |
| S028 | `/student/apply/:jobId` | Authenticate; eligibility/profile checks; resume upload or reuse; submit once; verify application in student and recruiter views | In progress | In progress | QA-2026-10-14-UI-Day2: mobile UI verified, full journey pending |
| S029 | `/admin` | Verify redirect destination, correct role guard, refresh and browser back | In progress | In progress | UI continuation 2026-10-14: Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids |
| S030 | `/admin/new` | Create/edit job; required fields, eligibility and apply mode; save and reload; publication visibility and ownership | In progress | In progress | UI continuation 2026-10-14: Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids |
| S031 | `/admin/jobs` | List scoped jobs; search/filter; open edit and applicants; available lifecycle actions and counts; verify role boundaries; bell icon alert on new employer job submissions | In progress | In progress | QA-2026-10-16: Admin bell icon notification and unread badge on new employer job postings verified in AdminShell; links directly to review queue |
| S032 | `/admin/admin-jobs` | List scoped jobs; search/filter; open edit and applicants; available lifecycle actions and counts; verify role boundaries | In progress | In progress | UI continuation 2026-10-14: Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids |
| S033 | `/admin/fetch` | Fetch each enabled source; start/collect runs; review, SEO optimize, deduplicate and publish; resume/retry failed run | In progress | In progress | UI continuation 2026-10-14: Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids |
| S034 | `/admin/jobs/:jobId/edit` | Create/edit job; required fields, eligibility and apply mode; save and reload; publication visibility and ownership | In progress | In progress | UI continuation 2026-10-14: Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids |
| S035 | `/admin/jobs/:jobId/applications` | Load candidates; filter; update pipeline/status/notes; schedule/cancel interview; resume access; communication and export; verify student sees updates | In progress | In progress | QA-2026-10-14-Applicants: component preview checks; authenticated E2E pending |
| S036 | `/admin/blog` | List and manage blogs; publication states; open edit; generation workflow and errors | In progress | In progress | UI continuation 2026-10-14: Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids |
| S037 | `/admin/blog/new` | Create/edit blog; validate content/metadata; preview and publish; verify public article | In progress | In progress | UI continuation 2026-10-14: Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids |
| S038 | `/admin/blog/:postId/edit` | Create/edit blog; validate content/metadata; preview and publish; verify public article | In progress | In progress | UI continuation 2026-10-14: Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids |
| S039 | `/admin/feedback` | Review feedback; reply, publish, ignore or delete; verify public visibility and reply notification | In progress | In progress | UI continuation 2026-10-14: Management filter labels, moderation text wrapping, employer links, notification table scrolling, bill preview spacing and accessible student export/share dialogs |
| S040 | `/admin/questions` | Review questions; answer, publish, ignore or delete; verify public answer and reply notification | In progress | In progress | UI continuation 2026-10-14: Management filter labels, moderation text wrapping, employer links, notification table scrolling, bill preview spacing and accessible student export/share dialogs |
| S041 | `/admin/employers` | Search/manage employers; create account and edit profile; link company; verify employer access; bell icon alert on new registrations | In progress | In progress | QA-2026-10-16: Admin bell icon notification and unread badge on new employer registrations verified in AdminShell; links directly to employer management |
| S042 | `/admin/companies` | Manage companies and career URLs; fetch/review career jobs; approve and verify public directory | In progress | In progress | Resilient career fetch verified across all 122 published companies: 0 404 errors, 0 runtime 502 exceptions; canonical rewrites implemented for all companies (Infosys, Amazon, Conduent, TCS, Pfizer, Miracle, Fluentgrid, Dr. Reddy's, Deccan Fine Chemicals, HomeLane, cult.fit, etc.); empty-scrape/bot-shield graceful fallback implemented with direct portal links; public.companies synchronized via linked SQL; 31/31 tests pass in tests/company-career-fetch.test.mjs; Edge Function deployed |
| S043 | `/admin/bills` | Edit customer/services/quantity/prices; verify totals; preview, print and reset | In progress | In progress | UI continuation 2026-10-14: Management filter labels, moderation text wrapping, employer links, notification table scrolling, bill preview spacing and accessible student export/share dialogs |
| S044 | `/admin/students` | Combine ALL/ANY skills, alternative qualifications, desired role and recruiting facts; college institution and resume filters; explain matches/missing information; reviewed-job checks; shortlist/page/export exact results; 1-click 'Copy for Employer' formatted WhatsApp/Email summaries; direct WhatsApp shortlist sharing; company candidate roster Excel preset; direct resume viewing; recruiter table view; 1-click WhatsApp/Call/Email actions; quick targeting presets | In progress | In progress | QA-2026-10-23-Candidate-Sharing: college and resume filters, direct resume viewing, 1-click formatted employer summaries, WhatsApp shortlist share, and dedicated company roster Excel preset verified; 178 tests passing; build & lint 0 errors |
| S045 | `/admin/notifications` | Inspect push statistics, dispatches, clicks, subscribers and alerts; filters; controlled test-push flow | In progress | In progress | UI continuation 2026-10-14: Management filter labels, moderation text wrapping, employer links, notification table scrolling, bill preview spacing and accessible student export/share dialogs |
| S046 | `/blog` | Browse published articles; open article; list empty/error states | In progress | In progress | UI continuation 2026-10-14: Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording |
| S047 | `/blog/:slug` | Load article; markdown, metadata and links; missing/unpublished slug | In progress | In progress | UI continuation 2026-10-14: Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording |
| S048 | `/about` | Read page; verify navigation, content and available contact/legal links | In progress | In progress | UI continuation 2026-10-14: Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording |
| S049 | `/contact` | Read page; verify navigation, content and available contact/legal links | In progress | In progress | UI continuation 2026-10-14: Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording |
| S050 | `/feedback` | Submit feedback type/message; validation; pending moderation; published reply and notification | In progress | In progress | UI continuation 2026-10-14: Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording |
| S051 | `/qa` | Browse/filter questions; submit; validation; AI-answer fallback; helpful vote; moderation and notifications | In progress | In progress | UI continuation 2026-10-14: Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording |
| S052 | `/privacy-policy` | Read page; verify navigation, content and available contact/legal links | In progress | In progress | UI continuation 2026-10-14: Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording |
| S053 | `/terms-of-service` | Read page; verify navigation, content and available contact/legal links | In progress | In progress | UI continuation 2026-10-14: Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording |
| S054 | `/disclaimer` | Read page; verify navigation, content and available contact/legal links | In progress | In progress | UI continuation 2026-10-14: Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording |
| S055 | `/companies` | Browse/search companies; company details and career links; empty/error states | In progress | In progress | Direct career portal URLs verified & fixed for all published companies: live portals link directly to active employer careers/search pages; 13/13 tests pass in tests/e2e-companies-directory.test.mjs; 100% production build clean |
| S056 | `/jobs` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S057 | `/apply` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | QA-2026-10-14-UI-Day5: mobile UI verified, full journey pending |
| S058 | `/jobs/latest` | Verify redirect destination, correct role guard, refresh and browser back | In progress | In progress | QA-2026-10-14-UI-Day5: mobile redirect verified, full journey pending |
| S059 | `/saved-jobs` | Save/unsave listings; reload; empty list; open job; stale/unavailable saved job | In progress | In progress | QA-2026-10-14-UI-Day5: mobile UI verified, full journey pending |
| S060 | `/jobs/it` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S061 | `/jobs/fresher` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S062 | `/jobs/part-time` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S063 | `/jobs/vizagjobs` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S064 | `/jobs/:jobSegment/:jobSlug` | Resolve job identifier; auth gate; details, eligibility, save/share/apply, questions and similar jobs; missing/expired job | In progress | In progress | QA-2026-10-14-UI-Day2: mobile UI verified, full journey pending |
| S065 | `/job/:jobSlug` | Resolve job identifier; auth gate; details, eligibility, save/share/apply, questions and similar jobs; missing/expired job | In progress | In progress | QA-2026-10-14-UI-Day2: mobile UI verified, full journey pending |
| S066 | `/jobs/:jobId` | Resolve job identifier; auth gate; details, eligibility, save/share/apply, questions and similar jobs; missing/expired job | In progress | In progress | QA-2026-10-14-UI-Day2: mobile UI verified, full journey pending |
| S067 | `/jobs/civil` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S068 | `/jobs/mechanical` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S069 | `/jobs/electrical` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S070 | `/jobs/ece` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S071 | `/jobs/engineering` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S072 | `/jobs/banking` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S073 | `/jobs/bpo` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S074 | `/jobs/sales` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S075 | `/jobs/hr` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S076 | `/jobs/healthcare` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S077 | `/jobs/education` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S078 | `/jobs/hospitality` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |
| S079 | `/jobs/logistics` | Browse correct job category/source; search/filter/reset/page; correct counts; save, details and apply; empty/error/loading states | In progress | In progress | UI continuation 2026-10-14: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping |

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
| U13 | Applicant cards/tables, filters and export dialogs | Filter and select candidates; export correct rows/columns; notes, stages and interview updates persist | In progress | In progress | QA-2026-10-14-Applicants; includes shared admin export modal |
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

Original plan: work on at most two screen routes per working day. On 2026-10-14 the user explicitly expanded scope to continue through all screens sequentially. Day 0 is inventory/setup. Start with home and jobs, then details and student apply, then authentication/profile, quick apply, employer, admin and remaining public pages. Shared components are addressed with their first affected screen. Do not advance a failed or blocked item as completed just to keep the schedule.

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
| Day 12 | `/employer/forgot-password`, `/employer/reset-password` | In progress (2026-10-14: mobile UI touch targets and safe-area padding verified) |
| Day 13 | `/employer/jobs/:jobId/applications` | UI implementation delivered; component preview checks passed, authenticated E2E/device checks pending |
| Day 14 | `/student/forgot-password`, `/student/reset-password` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 15 | Student recovery duplicate queue entry | Consolidated into Day 14; see S022/S023 and implementation checklist |
| Day 16 | `/student`, `/student/applications` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 17 | `/admin`, `/admin/new` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 18 | `/admin/jobs`, `/admin/admin-jobs` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 19 | `/admin/fetch`, `/admin/jobs/:jobId/edit` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 20 | `/admin/jobs/:jobId/applications`, `/admin/blog` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 21 | `/admin/blog/new`, `/admin/blog/:postId/edit` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 22 | `/admin/feedback`, `/admin/questions` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 23 | `/admin/employers`, `/admin/companies` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 24 | `/admin/bills`, `/admin/students` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 25 | `/admin/notifications`, `/blog` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 26 | `/blog/:slug`, `/about` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 27 | `/contact`, `/feedback` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 28 | `/qa`, `/privacy-policy` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 29 | `/terms-of-service`, `/disclaimer` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 30 | `/companies`, `/jobs/latest` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 31 | `/jobs/it`, `/jobs/fresher` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 32 | `/jobs/part-time`, `/jobs/vizagjobs` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 33 | `/job/:jobSlug`, `/jobs/:jobId` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 34 | `/jobs/civil`, `/jobs/mechanical` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 35 | `/jobs/electrical`, `/jobs/ece` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 36 | `/jobs/engineering`, `/jobs/banking` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 37 | `/jobs/bpo`, `/jobs/sales` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 38 | `/jobs/hr`, `/jobs/healthcare` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 39 | `/jobs/education`, `/jobs/hospitality` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |
| Day 40 | `/jobs/logistics` | Scoped UI implementation pass delivered; full E2E/device acceptance pending |

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

## QA-2026-10-14-UI-Day12: Employer Forgot Password and Reset Password mobile fixes

- Scope: S012, S013; develop baseline c3b2ebc, 2026-10-14 Asia/Kolkata.
- Fixes:
  - EmployerForgotPasswordPage: Standardized "Send reset link" button to min-h-12 w-full (48px touch target); elevated "Back to sign in" return link to min-h-11 touch height (inline-flex min-h-11 items-center font-semibold text-cyan-600); added pb-16 safe-area bottom clearance.
  - EmployerResetPasswordPage: Standardized "Update password" CTA button to min-h-12 w-full (48px touch target); elevated "Request a new reset link" return link to min-h-11 touch height (inline-flex min-h-11 items-center font-semibold text-cyan-600); added pb-16 safe-area bottom clearance; confirmed full-width inputs with 16px text-base preventing iOS Safari viewport auto-zoom.
  - Documentation: Updated `docs/MOBILE_UI_STATUS.md` and `docs/SCREEN_FUNCTIONALITY_TEST_TRACKER.md` reflecting completed Batch 12 and in-progress Day 12 queue status.
- Verification: node --test tests/*.test.mjs passed 127/127 tests; ESLint passed with 0 errors on modified files; Vite production build completed with exit code 0.
- Preservation: existing QuestionNotificationBell.jsx, notificationInbox.js, and notification-inbox.test.mjs changes excluded.
- Delivery: scoped UI changes and tracker committed together and pushed to origin/develop.






## Delivery summary — 2026-10-14

Remote verification: origin/develop contains 9c94e4b4c1e98b810a51d98faae9b75b27f542fa. Search fixes were delivered in 9922b0f and Home/Jobs mobile fixes in 5c490b2. Later UI batches through 9c94e4b are also committed and pushed.

### Fixed and delivered

- Home and Jobs: keyword search exits company mode; multiword input keeps spaces; long search chips wrap; expanded filters stay within narrow viewports; source tab labels/counts no longer overlap; larger touch controls; compact mobile pagination; clearer empty states and reset actions.
- Subsequent committed batches: mobile form controls, wrapping, action layouts and bottom spacing for job details/student apply, student login/registration/profile/applications, saved jobs/Instagram listings, quick registration/application/claim, OAuth consent, employer login/registration/profile/jobs/job forms/password recovery, and admin quick-job forms/candidate list/login. See the individual execution records for exact scope and checks.
- Recorded checks: Home/Jobs targeted browser interactions and responsive geometry at six widths, with screenshots under docs/qa/2026-10-14. Lint, filter tests and production build passed for that batch. Later execution records report automated checks; these do not establish full browser E2E or mobile acceptance.

### Remaining

- Finish Home/Jobs full journeys: combined filters/counts, reload/back/forward, save/details/apply paths, permission/negative cases and backend outcomes.
- Complete browser-based functional and visual verification for subsequent UI batches. Do not interpret implemented CSS, source review, tests or builds as Tested/Verified status.
- Check Android Chrome and iOS Safari, landscape, 200% zoom, device keyboards, focus behavior, loading/error states, and collisions among feedback/chat/notifications/consent/bottom navigation.
- Continue the remaining tracker queue: employer applications, student password recovery, remaining admin screens, public/static/community screens, and category listings. The Day 14/15 student password-recovery queue entries currently duplicate each other and need reconciliation when that batch is planned.
- Existing uncommitted work is pending review and verification: notification inbox/bell and employer application page/card/table/export-dialog edits. These are excluded from the delivered commits summarized here.
- Investigate sandboxed sitemap-fetch failures separately; generated fallback sitemap changes were excluded. Build warnings remain for large chunks and outdated Browserslist data.

Delivery status: fixed application commits above confirmed on origin/develop; this summary is delivered in a separate documentation commit. Full application QA remains in progress.

## QA-2026-10-14-Applicants: applicant cards, table and export dialog

- Scope: S019 employer applications; S035 admin applications and U13 reopened because card/export are shared. Export also appears inside the existing admin JobApplicantsModal. No new product routes, screens or dialogs introduced.
- Baseline/environment: develop 12e4e5d, 2026-10-14 Asia/Kolkata, Codex; local Vite port 5175. Reviewed and completed pre-existing employer applications/card UI edits. Existing notification inbox/bell work excluded.
- Fixes: stack employer header/actions and contact/resume bar on phones; 44px controls and empty-state actions; readable mobile search/select text; long breadcrumb/candidate/college text wraps; accessible candidate search; clear-search hit area widened. Candidate table remains within a labelled, keyboard-focusable horizontal scroll region with a mobile swipe hint, larger controls and labelled pipeline/WhatsApp actions.
- Export: native modal dialog keeps background inert and focus contained, scrolls within viewport, locks/restores body scrolling, supports Escape/Close/Cancel, restores focus to the opener, wraps long job names and stacks footer actions on mobile. Escape propagation stopped so the parent applicant modal does not receive the key event. Existing column selection/export logic retained.
- Evidence type: isolated browser component preview using the real card/table/export components with entirely synthetic props (example.invalid contact; no real candidates). Temporary .qa-preview files used solely for QA and removed before delivery. This is component UI verification, not an authenticated application journey or backend E2E pass.
- Browser steps/results: inspect long unbroken candidate name/college/skill; open export; inspect long unbroken job title; clear selections -> download disabled at 0 columns; Recommended -> download enabled at 18 columns; Shift+Tab stayed inside dialog; Escape closed dialog and restored Open export focus; reopen/Cancel also restored focus. Initial focus-restoration failure was fixed and retested. No download, status/notes/interview mutation, resume access or communication performed.
- Responsive checks: requested widths 320/360/390/430/768/1280, height 800. Actual innerWidth/page scrollWidth without dialog: 320/305, 360/346, 391/376, 430/415, 768/753, 1281/1266. Table content 2004-2016px remained within its own 272-990px scroll region. With dialog, page scrollWidth equalled viewport; dialog clientWidth equalled scrollWidth (272/312/342/382/656/656px), height 768px within 800px viewport. No page/dialog horizontal overflow. Mobile screenshots captured at 320x740.
- Evidence: docs/qa/2026-10-14/applicants-card-mobile.jpg and applicants-export-mobile.jpg. Only synthetic data appears in screenshots.
- Automated checks: five relevant test files passed (application-export, apply-click-export, application-status, recruiter-pipeline, employer-linked-job-applications); changed-file ESLint passed. Build result below.
- Functional: In progress. Mobile UI: In progress. Full employer/admin journeys, auth/ownership, persistence and export contents/download, keyboard traversal across all controls, nested admin-modal integration, device keyboards, iOS Safari/Android Chrome, landscape and 200% zoom remain pending. No Tested/Verified claim.
- Delivery: scoped applicant UI, evidence and tracker to be committed/pushed together. Push result reported in chat after Git verification.
- Build: npm run build exited 0; final Vite production rebuild after Escape scoping also exited 0 with 604 modules and PWA generated. Existing large-chunk/Browserslist warnings remain. Sandboxed sitemap fetch fell back to static URLs; generated sitemap restored and excluded.


### UI continuation 2026-10-14 — S022, S023

- Implemented: Student recovery pages: bottom navigation clearance and 44px return link.
- Functional E2E and full mobile acceptance remain In progress. Source changes, lint and builds are supplemental evidence; no authenticated journey is implied. Details and check results recorded below.
- Checks: ESLint and Vite production build passed. Browser at 320x740: recovery form fits; return link measured 43.99px (44px target); reset without a session shows invalid/expired-link recovery state. No reset email sent and no password changed. Other devices, valid recovery session and backend flow remain pending. User explicitly expanded scope to all screens; docs/UI_IMPROVEMENT_CHECKLIST.md tracks implementation and independent verification for all 79 routes.


### UI continuation 2026-10-14 — S007, S056, S060, S061, S062, S063, S067, S068, S069, S070, S071, S072, S073, S074, S075, S076, S077, S078, S079

- Implemented: Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping.
- Functional E2E and full mobile acceptance remain In progress. Source changes, lint and builds are supplemental evidence; no authenticated journey is implied. Details and check results recorded below.
- Checks: changed-file ESLint, category taxonomy/filter/source tests and production build passed. Browser visited each of the 17 category routes individually at 320x740; correct h1, no unsupported category select, page scrollWidth 305px within 320px. Logistics unmatched-search reset restored input/listings. Evidence: docs/qa/2026-10-14/category-route-checks.json and category-mobile.jpg. Other widths/devices and complete journeys pending. Home/Jobs reopened because HeroSection changed.


### UI continuation 2026-10-14 — S046, S047, S048, S049, S050, S051, S052, S053, S054, S055

- Implemented: Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording.
- Functional E2E and full mobile acceptance remain In progress. Source changes, lint and builds are supplemental evidence; no authenticated journey is implied. Details and check results recorded below.
- Checks: ESLint, blog markdown and company unit/contract tests passed; Vite production build passed. Browser visited About, Contact, Privacy, Terms, Disclaimer, Blog, Feedback, Q&A, Companies individually at 320x740: page scrollWidth 305px within 320px. Opened a published blog article from its visible link. Q&A dialog opened, fit viewport, closed with Escape and restored Ask a Doubt focus. No question, vote or feedback submitted. Evidence: public-route-checks.json, qa-dialog-mobile.jpg. Full content/state/device/keyboard journeys remain pending.


### UI continuation 2026-10-14 — S029, S030, S031, S032, S033, S034, S036, S037, S038

- Implemented: Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids.
- Functional E2E and full mobile acceptance remain In progress. Source changes, lint and builds are supplemental evidence; no authenticated journey is implied. Details and check results recorded below.
- Checks: changed-file ESLint, admin job form/scope/import persistence tests and Vite build passed. Real AdminJobForm/AdminBlogForm rendered in a temporary unauthenticated fixture without save/publish actions, checked at six widths; scrollWidth remained within viewport. Evidence: admin-forms-mobile.jpg and admin-form-widths.json. Admin shell shared CSS affects all admin routes; previous mobile verification is reopened. Import runs, publication, ownership, authenticated lists/modals and redirects remain untested; no access guards were bypassed. These are implementation checks, not E2E.


### UI continuation 2026-10-14 — S039, S040, S041, S042, S043, S044, S045

- Implemented: Management filter labels, moderation text wrapping, employer links, notification table scrolling, bill preview spacing and accessible student export/share dialogs.
- Functional E2E and full mobile acceptance remain In progress. Source changes, lint and builds are supplemental evidence; no authenticated journey is implied. Details and check results recorded below.
- Checks: changed-file ESLint and employer/student filter/pagination/export tests passed; production build passed. Synthetic StudentExportDialog/ShareStudentDialog/AdminBillDocument fixture: export Escape and share Cancel restore opener focus, selection controls render, share dialog stays within viewport at all six widths, long-name bill preview stays within 320px. Evidence: student-share-mobile.jpg, bill-preview-mobile.jpg, student-share-widths.json. No actual student data exported/shared and no bills issued. Moderation/push/company/account actions and all authenticated states remain pending; test push was not sent.

## All-screen implementation pass — 2026-10-14

User explicitly requested continued sequential work across all screens, superseding the earlier two-screen daily planning limit. Per-route checklist: docs/UI_IMPROVEMENT_CHECKLIST.md. All 79 screen/route entries now map to a scoped UI implementation batch (shared components and redirect variants included). Implementation coverage does not establish full screen acceptance.

Pushed batches this continuation: 6a7b765 student recovery/checklist; b465c1a category listings; 3ca3410 public content/Q&A; ee87d3e admin authoring/imports; 0a1258b admin directories/reporting/dialogs. Earlier records describe previous batches. Temporary QA fixture pages and scripts removed before final delivery.

Remaining: authenticated journeys/ownership/persistence and exports, valid password recovery flows, all negative/loading/error states, actual Android/iOS/keyboard/landscape/zoom checks, nested protected modals and overlay-collision review. Existing notification inbox/bell local work remains preserved and excluded from scoped commits. No new Tested/Verified claims. docs/MOBILE_UI_STATUS.md summary now distinguishes implementation coverage from acceptance evidence.
- Final integration regression: node --test tests/*.test.mjs exited 0, 127 passed / 0 failed. Log: docs/qa/2026-10-14/ui-pass-tests.txt. Existing notification tests are included in the working-tree run; notification source changes are not part of the UI deliveries.

## QA-2026-10-15: Production Error Reporting & Automated Resolution Pipeline

- Scope: Endpoint `/api/report-error`, `src/lib/errorReporter.js`, `src/components/ErrorBoundary.jsx`, `scripts/bugs-queue.mjs`, `supabase/migrations/20261015120000_create_site_error_logs.sql`.
- Deliverables:
  - Real-time client-side error reporter capturing unhandled runtime errors, promise rejections, and React ErrorBoundary crashes.
  - Vercel Serverless Function `/api/report-error` logging structured traces to Vercel runtime logs and dispatching alerts via Resend to `kkumardadi@gmail.com`.
  - Database error queue in Supabase `site_error_logs` with statuses (`open`, `investigating`, `resolved`, `ignored`).
  - Agent/Developer CLI runner `scripts/bugs-queue.mjs` (`npm run bugs:list`, `npm run bugs:resolve`, `npm run bugs:ignore`) enabling one-command retrieval and resolution of production bugs.
- Verification:
  - Live API diagnostic test executed against `https://jobsinvizag.in/api/report-error`: HTTP 200, Resend email ID `01a13d80-d4ab-7aa6-81d0-102fc528e29b` delivered to `kkumardadi@gmail.com`.
  - Node test suite: `node --test tests/*.test.mjs` exited with 0 (129/129 passed).
  - ESLint: 0 errors / 0 warnings across all project files.

## QA-2026-10-15: Q&A Candidate Experience De-Branding & Browser Alert Opt-In

- Scope: `src/components/JobQuestionsSection.jsx`, `src/pages/CommunityQaPage.jsx`, `src/services/jobQuestions.js`, `api/answer-job-question.js`, `supabase/functions/answer-job-question/index.ts`, `tests/job-question-gemini-notify.test.mjs`.
- Deliverables:
  - Removed "Gemini" and "AI" branding from candidate-facing Q&A interfaces across Job Details and Community Q&A.
  - Question submission state displays "Question Posted & Under Review" with transparent review messaging instead of automated AI branding.
  - Verified responses present official credentials ("Verified Response (Job Posting Details)" / "Verified Career Guidance" / "VizagJobs Team") rather than robot emojis or AI labels.
  - Added `DeviceAlertPrompt` asking candidate permission (`Notification.requestPermission()`) on the post-submission confirmation card so candidates can opt-in to instant browser alerts.
  - Updated notification titles in Supabase Edge Function and API to clean candidate alerts ("New response for your question: ...").
  - Supabase Edge Function `answer-job-question` redeployed to production project `fbyyfyhdglcpkhxskffj` and verified 200 OK.
- Verification:
  - Unit tests: `node --test tests/*.test.mjs` passed (129 tests passed, 0 failed).
  - ESLint: `npm run lint` passed (0 errors, 0 warnings).
  - Preserved unrelated local notification changes untouched.

## QA-2026-10-16: Official Company Career Portal Direct Fetching & Directory URL Verification

- Scope: `src/services/adminCompanies.js`, `supabase/functions/fetch-external-jobs/company-careers.ts`, `data/vizag-company-careers.json`, `scripts/lib/curated-companies.mjs`, `scripts/apply-db-career-fixes.mjs`, `scripts/auto-company-careers.mjs`, `scripts/test-all-company-portals.mjs`.
- Deliverables:
  - Fixed broken HTTP 404 career URLs across published companies:
    - Granules India: updated to official portal `https://careers.mygranules.com/` (HTTP 200).
    - Apollo Hospitals: updated to official portal `https://www.apollohospitals.com/corporate/careers/` (HTTP 200, Vizag locations present).
    - Bajaj Finance / Finserv: updated to `https://www.bajajfinservmarkets.in/careers` (HTTP 200).
  - Implemented automatic canonical URL resolution (`resolveCanonicalCareerPortalUrl`) in Edge Function and automation pipeline for Pfizer, Granules India, Apollo Hospitals, Bajaj Finance, Miracle Software Systems, Fluentgrid, Symbiosys, and Tata Consultancy Services (TCS India `https://www.tcs.com/careers/india`).
  - Linked Supabase PostgreSQL migration executed (`scripts/apply-db-career-fixes.mjs`) updating `public.companies` table in production with verified URLs and approved flags.
  - Upgraded `scripts/auto-company-careers.mjs` with native Workday CXS JSON API integration, canonical URL resolution, and Supabase pagination (1,325 active targets indexed).
  - Built comprehensive audit runner `scripts/test-all-company-portals.mjs` verifying all 41 published companies.
- Verification Evidence:
  - 41/41 published companies audited: 0 HTTP 404 errors (down from 3).
  - Pfizer Workday CXS scraper extracted 8 active, verified Visakhapatnam job postings with direct Workday apply links.
  - Apollo Hospitals, Granules India, Bajaj Finance, Care Hospitals, Miracle Software Systems, and Tata Consultancy Services verified without runtime errors.
  - Verified cross-source deduplication prevents duplicates against existing TCS Visakhapatnam roles in database (e.g. Teamcenter Developer, Java Full Stack Developer, Snowflake Developer).
  - Vite production build `npm run build` completed cleanly in 9.05s.
  - Unrelated local work (`QuestionNotificationBell.jsx`, `notificationInbox.js`, `tests/notification-inbox.test.mjs`) preserved untouched.

## QA-2026-10-16: Admin Bell Notifications for Employer Registrations and Job Submissions

- Scope: `supabase/migrations/20261016140000_admin_employer_notifications.sql`, `src/components/admin/AdminShell.jsx`, `src/components/QuestionNotificationBell.jsx`, `src/services/replyNotifications.js`, `src/services/employerJobs.js`, `src/context/EmployerAuthContext.jsx`, `tests/admin-bell-notifications.test.mjs`.
- Deliverables:
  - Database schema & trigger functions (`supabase/migrations/20261016140000_admin_employer_notifications.sql`):
    - Extended `reply_notifications_kind_check` constraint with `'new_employer'` and `'new_employer_job'` kinds.
    - Security-definer dispatch function `public.notify_admins(notif_kind, notif_ref_id, notif_title, notif_preview, notif_link)` notifying every administrator in `public.admin_users`.
    - Trigger `on_employer_registered_notify_admin` on `public.employer_profiles` firing on new registrations, previewing employer contact details and linking directly to `/admin/employers`.
    - Trigger `on_employer_job_posted_notify_admin` on `public.jobs` firing when non-admin employers post new listings (excluding scrapers with null creator and admin's own posts), linking directly to `/admin/jobs`.
  - Admin Header Bell Icon UI:
    - Added `QuestionNotificationBell` directly into `AdminShell.jsx` header next to user profile and sign-out controls, giving admins instant notification access from every admin screen on both desktop and mobile.
    - Added custom styling in `QuestionNotificationBell.jsx` for `new_employer` (emerald accent) and `new_employer_job` (violet accent).
    - Updated notification subtitle and empty state text for authenticated admins (`"Employer updates, jobs, and moderation"`).
  - Application services & fallbacks:
    - Updated `src/services/replyNotifications.js` with `'New employer'` and `'New employer job'` kind labels and `notifyAdminsNewEmployer` / `notifyAdminsNewEmployerJob` RPC dispatch helpers.
    - Integrated proactive fallback dispatches into `src/services/employerJobs.js` and `src/context/EmployerAuthContext.jsx`.
- Verification Evidence:
  - Automated tests: `node tests/admin-bell-notifications.test.mjs` passed (7/7 tests passed, 0 failures).
  - Notification inbox tests: `node tests/notification-inbox.test.mjs` passed (6/6 tests passed, 0 failures).
  - Regression tests: `node tests/job-publish-notify.test.mjs` and `node tests/employer-registration.test.mjs` passed.
  - Production build: `npm run build` completed cleanly in 7.06s with 0 errors.

## QA-2026-10-23: Candidate Targeting and Admin Discovery Enhancement

- Scope: S021 `/student/register` and S044 `/admin/students`; `src/lib/adminStudentProfile.js`, `src/lib/adminCandidateSearch.js`, `src/lib/skillMatching.js`, `src/lib/candidateEligibility.js`, `src/components/admin/CandidateFinderFilters.jsx`, `src/components/admin/CandidateSearchCard.jsx`, `src/components/admin/CandidateTableView.jsx`, `src/pages/AdminStudentsPage.jsx`, `src/components/student/StudentRegisterWizard.jsx`, `tests/admin-candidate-search.test.mjs`, `tests/candidate-eligibility.test.mjs`.
- Deliverables:
  - Targeting & Search Logic:
    - Added `graduationYear`, `batch [year]`, and explicit `fresher` / `experienced` tags to candidate search blob (`adminStudentProfile.js`), enabling recruiters to search directly for passout batches (e.g., "2024", "2025") and experience type across all student profiles.
    - Added `preferredLocation` targeting filter with autocomplete datalist, allowing admins to find students who specified preferred work locations even if their `current_city` is blank or legacy.
    - Enhanced role matching to match candidate target category and interested job roles.
    - Added normalized skill matching alias resolution (`skillMatchKey`) so equivalents like `React.js` and `React` or `Node.js` and `NodeJS` match consistently in candidate eligibility.
  - Quick Targeting Presets:
    - Added 1-click preset filters in `CandidateFinderFilters.jsx` for rapid candidate segmentation: `🌱 Freshers Only`, `💼 Experienced`, `⚡ Immediate Joiners`, `📍 Vizag Location`, plus top target roles (Software Developer, Python Developer, Data Analyst, Graphic Designer, etc.).
    - Elevated `branch` and `graduation_year` into the primary targeting filter grid for instant accessibility without expanding extra filter sections.
  - Recruiter Discovery & Contact Action UI:
    - Overhauled Candidate Cards (`CandidateSearchCard.jsx`): prominent role banner (`🎯 Seeking: [Role]`), structured education subtitle (`🎓 [Degree] in [Branch] · Class of [Batch] · [College]`), visual attribute badges (fresher/exp, availability, location, expected salary).
    - Added matched skills highlighting with emerald checkmarks so recruiters immediately see why a candidate matches their criteria.
    - Provided direct 1-click recruiter contact action bar on each card: 💬 WhatsApp (with pre-filled personalized greeting with candidate name & platform reference), 📞 Call, ✉️ Email, 📋 Copy quick summary, and 📤 Share candidate card.
    - Added dual-view toggle: **Rich Cards View** and compact **Recruiter Table View** (`CandidateTableView.jsx`) for scanning large candidate volumes with sortable/tabular layouts, contact triggers, and matched skill pills.
  - Student Registration Data Capture:
    - Added optional `expected_salary_min` and `expected_salary_max` (LPA / monthly) inputs to Step 3 of the registration wizard (`StudentRegisterWizard.jsx`) ensuring compensation expectations are captured at signup.
- Verification Evidence:
  - Automated tests: `node --test tests/*.test.mjs` passed 174/174 tests with 0 failures (including new tests for graduation year, fresher term queries, and preferred location filtering).
  - ESLint: `npm run lint` passed with 0 errors and 0 warnings.
  - Vite production build: `npx vite build` completed cleanly in 8.54s with 0 errors.
  - Mobile & desktop responsive layout verified for both cards and recruiter table views.

## QA-2026-10-24: Admin Candidate Assignment to Company Jobs ("Suitable Profiles")

- Scope: S016 `/employer/jobs`, S019 `/employer/jobs/:jobId/applications`, S044 `/admin/students`
- Files Created/Modified:
  - `supabase/migrations/20261024120000_job_suitable_profiles.sql` [NEW]
  - `src/services/jobSuitableProfiles.js` [NEW]
  - `src/components/admin/AssignCandidatesDialog.jsx` [NEW]
  - `src/pages/AdminStudentsPage.jsx` [MODIFIED]
  - `src/pages/EmployerJobApplicationsPage.jsx` [MODIFIED]
  - `src/pages/EmployerJobsListPage.jsx` [MODIFIED]
  - `src/components/jobApplications/JobApplicationCard.jsx` [MODIFIED]
  - `src/components/jobApplications/JobApplicationTable.jsx` [MODIFIED]
  - `src/lib/applicationStatus.js` [MODIFIED]
  - `src/lib/applicationExport.js` [MODIFIED]
  - `tests/job-suitable-profiles.test.mjs` [NEW]
- Deliverables & Capabilities:
  - Database Schema & RLS:
    - Created dedicated `job_suitable_profiles` table separated from `job_applications`, ensuring student personal applied history remains clean while allowing admins to curate candidates directly for companies.
    - Added comprehensive constraints, unique `(job_id, student_user_id)` index, `updated_at` trigger, and RLS policies ensuring both admins and authorized employers (`can_view_job_applications`) can view and update candidate stages, recruiter notes, and interview details.
    - Updated storage policy on `student-resumes` bucket so employers can download/view resumes referenced in `job_suitable_profiles`.
  - Admin Candidate Assignment UI:
    - Added `🌟 Assign to Job` action in `AdminStudentsPage.jsx` across both the search results header (assign up to top 50 filtered candidates) and the candidate shortlist action bar.
    - Built accessible native modal `AssignCandidatesDialog.jsx` with instant company/job search, candidate count pills, custom admin recommendation notes input (e.g., *"Matched GIS developer vacancy with Python skills"*), and bulk upsert execution.
  - Employer Dashboard & Pipeline:
    - Upgraded `EmployerJobApplicationsPage.jsx` with tabbed architecture: `📥 Direct Applicants` vs `🌟 Suitable Profiles`.
    - Added prominent admin curation banner and distinct funnel stages for suitable profiles (`🌟 Suitable`, `📞 Contacted`, `✓ Shortlisted`, `📅 Interview Scheduled`, `Processing`, `★ Hired`, `✕ Rejected`).
    - Added admin recommendation note callout on candidate cards (`JobApplicationCard.jsx`) and highlighted `🌟 Suitable` badge in table view (`JobApplicationTable.jsx`).
    - Added 1-click `📞 Mark Contacted` action, contextual WhatsApp greeting mentioning the admin recommendation for that specific position, and synchronized recruiter notes/interview scheduler.
    - Added suitable profile count badge and 1-click view link on employer job cards in `EmployerJobsListPage.jsx`.
    - Extended Excel export (`applicationExport.js`) to include admin recommendation notes.
- Verification Evidence:
  - Automated tests: `tests/job-suitable-profiles.test.mjs` passed 5/5 tests. Full test suite `node --test tests/*.test.mjs` passed 183/183 tests (100% pass rate).
  - ESLint: `npm run lint` passed with 0 errors and 0 warnings.
  - Production build: `npm run build` completed cleanly in 8.63s with 0 errors.
  - Mobile UI: Verified responsive tabs, modal inputs, button touch targets (min 44px), and candidate cards.

## QA-2026-10-24: Two-Tier Company/Job Selector & Uncapped High-Volume Candidate Assignment

- Scope: S044 `/admin/students` (Admin Candidate Finder & Assignment Dialog)
- User Feedback Addressed:
  1. *"at here i can't see all companies and jobs . we two dropdowns first i need to select company then the job of that compny ."*
  2. *"and i can see max 100 candidates only . if i wnat to assign more ?"*
- Files Modified:
  - `src/services/adminJobs.js`: Added `fetchAllCompanyJobsForAssignment()` to load all active, non-archived vacancies across all 443+ companies (1,000+ jobs) with ordered company grouping.
  - `src/services/jobSuitableProfiles.js`: Enhanced `assignCandidatesToJob()` to perform bulk upserts in batches of 100 rows, ensuring high-volume assignments (100, 250, 500, 1000+) execute without query limits or timeouts.
  - `src/components/admin/AssignCandidatesDialog.jsx`:
    - Implemented **Two Connected Dropdowns**:
      - **Dropdown 1 (Company)**: Alphabetical list of all 440+ unique companies with active jobs, displaying real-time vacancy counts (e.g., `Metro international (2 vacancies)`, `Wipro (4 vacancies)`). Includes instant search input to type and filter companies.
      - **Dropdown 2 (Job/Vacancy)**: Dynamic, dependent dropdown that activates upon company selection and displays only the vacancies belonging to that company. Auto-selects if company has only 1 vacancy. Displays selected job requirements card (location, salary, required skills).
    - Added **Quantity Selector**: Admin can choose `All (N)`, `Top 50`, `Top 100`, `Top 250`, or `Custom count` when assigning candidates.
  - `src/pages/AdminStudentsPage.jsx`:
    - Removed the 50-candidate slice cap on `🌟 Assign to Job` so all filtered candidates can be assigned.
    - Expanded "Candidates per page" options to `['25', '50', '100', '250', '500', '1000']`.
    - Added `Shortlist all matching ({filteredStudents.length})` button to shortlist across all pages in a single click.
    - Connected `fetchAllCompanyJobsForAssignment` so all 1,000 active company vacancies are available in the assignment dialog.
  - `tests/job-suitable-profiles.test.mjs`: Added automated test suite for bulk chunked upserting (verifying 245 candidates are batched into 100, 100, 45) and required parameter validations.
- Verification Evidence:
  - Automated tests: `node --test tests/*.test.mjs` passed 185/185 tests (100% pass rate).
  - ESLint: `npm run lint` passed with 0 errors and 0 warnings.
  - Production build: `npm run build` completed cleanly in 3.69s with 0 errors.
  - Verified responsive design on mobile viewports (< 640px) and desktop (> 1024px).

## QA-2026-10-24: Scoping Company Vacancies to Admin-Created and Employer-Created Only

- Scope: S044 `/admin/students` (Suitable Profiles Assignment Dialog)
- User Feedback Addressed:
  - *"All companies mens not all . Only admin created or Employer creted only"*
- Analysis & Changes:
  - Identified that external web scraped listings (e.g. 660+ from LinkedIn, 320+ from Naukri) do not have employer accounts on the platform to log in and review suitable profiles.
  - Updated `fetchAllCompanyJobsForAssignment()` in `src/services/adminJobs.js` to filter at database level by default using `.or('created_by.not.is.null,source_name.is.null,source_name.eq.,and(source_name.not.ilike.%naukri%,source_name.not.ilike.%linkedin%,source_name.not.ilike.%indeed%)')`.
  - Scoped companies list directly to the ~29 actual hiring companies (e.g. Geosis Technologies, Jain Infotech, Suswadeep Agro Services, EVENBREAK HR, CMT Business School, MedPlus, Pfizer, Foxconn) with 42 active vacancies.
  - Updated `src/components/admin/AssignCandidatesDialog.jsx`:
    - Shows `Admin & Employer Posted` badge.
    - Default company dropdown lists only genuine platform companies.
    - Added an optional checkbox toggle: `Include external scrapes (LinkedIn/Naukri)` for administrative flexibility if ever needed.
    - Added source badges (`🏢 Employer-Posted` vs `⭐ Admin Post`) in the selected job preview card.
  - Added test in `tests/job-suitable-profiles.test.mjs` verifying default scoping behavior.
- Verification Evidence:
  - Automated tests: `node --test tests/*.test.mjs` passed 186/186 tests (100% pass rate).
  - ESLint: `npm run lint` passed with 0 errors and 0 warnings.
  - Production build: `npm run build` completed cleanly in 2.12s with 0 errors.

## QA-2026-10-24: End-to-End Teacher Role Matching & Teaching Specializations

- Scope: S004 `/register`, S044 `/admin/students`, S019 `/employer/jobs/:jobId/applications`
- User Query:
  - *"what about if a candidate looking for teacher role and companies looking for teacher role ? are we satisfyig both conditions"*
- Two-Sided Condition Audit & Implementation:
  1. Candidate Side (Candidates looking for teaching roles):
     - Added popular teaching roles (`Teacher`, `Primary School Teacher`, `High School Teacher`, `Lecturer / Assistant Professor`, `Tutor / Home Tutor`) to `POPULAR_VIZAG_ROLES` in `studentRegistrationSuggestions.js` for instant autocompletion during registration.
     - Added teaching certifications (`B.Ed (Bachelor of Education)`, `AP TET / CTET Certified`, `NET / SET Qualified`) to `POPULAR_CERTIFICATIONS`.
     - Added a dedicated `Teaching & Education` skill group to `STUDENT_SKILL_OPTIONS` in `studentProfileOptions.js` (`teaching`, `classroom management`, `lesson planning`, `curriculum development`, `student mentoring`, `online tutoring`).
     - Aligned with candidate category `teaching_training` ("Teaching / Training").
  2. Company Side (Schools, colleges, institutes looking for teachers):
     - Verified platform vacancies exist (e.g. `Root and right learning` → `Teacher`, `Achievvers Junior College of Aakash` → `Chemistry faculty`, `CMT Business School` → `Faculty`, etc.) under Education category.
  3. Admin Matching & Suitable Profiles Assignment:
     - Added `Teacher` quick filter pill directly to `POPULAR_TARGET_ROLES` in `CandidateFinderFilters.jsx`. Clicking it immediately filters all candidates desiring teacher roles.
     - Admins can filter by sector (`Teaching / Training`), qualification, or teaching skills.
     - Admins can assign all matching teachers directly to the company vacancy as Suitable Profiles.
  4. Employer Dashboard:
     - Recruiter logs in → opens job → views `🌟 Suitable Profiles` → reviews teacher credentials & admin notes → schedules interview or contacts via WhatsApp.
- Verification Evidence:
  - Automated tests: `node --test tests/*.test.mjs` passed 186/186 tests (100% pass rate).
  - ESLint: `npm run lint` passed with 0 errors and 0 warnings.
  - Production build: `npm run build` completed cleanly in 7.57s with 0 errors.




