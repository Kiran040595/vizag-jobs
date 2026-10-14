# UI improvement checklist

Scope expanded by the user on 2026-10-14: continue across all screens in sequence; the former two-screen daily planning limit does not constrain this request.

A checked implementation item means the scoped UI changes are committed. It does not mean full functional E2E or mobile device verification passed. Evidence and separate verification statuses remain in SCREEN_FUNCTIONALITY_TEST_TRACKER.md.

Per screen: inspect layout and states → fix responsive/accessibility issues → run relevant checks → record evidence/limitations → commit and push.

| ID | Route | UI implementation | Full E2E | Full mobile acceptance | Notes |
|---|---|---|---|---|---|
| S001 | `/quick-register` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S002 | `/apply/:slug` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S003 | `/quick-applications/claim` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S004 | `/admin/quick-jobs/new` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S005 | `/admin/quick-jobs/:jobId/edit` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S006 | `/admin/candidates` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S007 | `/` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S008 | `/admin/login` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S009 | `/oauth/consent` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S010 | `/employer/login` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S011 | `/employer/register` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S012 | `/employer/forgot-password` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S013 | `/employer/reset-password` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S014 | `/employer` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S015 | `/employer/profile` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S016 | `/employer/jobs` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S017 | `/employer/jobs/new` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S018 | `/employer/jobs/:jobId/edit` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S019 | `/employer/jobs/:jobId/applications` | [x] | [ ] | [ ] | Applicant UI batch 4e087f0; synthetic component checks only |
| S020 | `/student/login` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S021 | `/student/register` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S022 | `/student/forgot-password` | [x] | [ ] | [ ] | Student recovery pages: bottom navigation clearance and 44px return link; full verification pending |
| S023 | `/student/reset-password` | [x] | [ ] | [ ] | Student recovery pages: bottom navigation clearance and 44px return link; full verification pending |
| S024 | `/student` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S025 | `/student/profile` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S026 | `/student/applied-jobs` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S027 | `/student/applications` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S028 | `/student/apply/:jobId` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S029 | `/admin` | [ ] | [ ] | [ ] | Queued |
| S030 | `/admin/new` | [ ] | [ ] | [ ] | Queued |
| S031 | `/admin/jobs` | [ ] | [ ] | [ ] | Queued |
| S032 | `/admin/admin-jobs` | [ ] | [ ] | [ ] | Queued |
| S033 | `/admin/fetch` | [ ] | [ ] | [ ] | Queued |
| S034 | `/admin/jobs/:jobId/edit` | [ ] | [ ] | [ ] | Queued |
| S035 | `/admin/jobs/:jobId/applications` | [x] | [ ] | [ ] | Applicant UI batch 4e087f0; synthetic component checks only |
| S036 | `/admin/blog` | [ ] | [ ] | [ ] | Queued |
| S037 | `/admin/blog/new` | [ ] | [ ] | [ ] | Queued |
| S038 | `/admin/blog/:postId/edit` | [ ] | [ ] | [ ] | Queued |
| S039 | `/admin/feedback` | [ ] | [ ] | [ ] | Queued |
| S040 | `/admin/questions` | [ ] | [ ] | [ ] | Queued |
| S041 | `/admin/employers` | [ ] | [ ] | [ ] | Queued |
| S042 | `/admin/companies` | [ ] | [ ] | [ ] | Queued |
| S043 | `/admin/bills` | [ ] | [ ] | [ ] | Queued |
| S044 | `/admin/students` | [ ] | [ ] | [ ] | Queued |
| S045 | `/admin/notifications` | [ ] | [ ] | [ ] | Queued |
| S046 | `/blog` | [ ] | [ ] | [ ] | Queued |
| S047 | `/blog/:slug` | [ ] | [ ] | [ ] | Queued |
| S048 | `/about` | [ ] | [ ] | [ ] | Queued |
| S049 | `/contact` | [ ] | [ ] | [ ] | Queued |
| S050 | `/feedback` | [ ] | [ ] | [ ] | Queued |
| S051 | `/qa` | [ ] | [ ] | [ ] | Queued |
| S052 | `/privacy-policy` | [ ] | [ ] | [ ] | Queued |
| S053 | `/terms-of-service` | [ ] | [ ] | [ ] | Queued |
| S054 | `/disclaimer` | [ ] | [ ] | [ ] | Queued |
| S055 | `/companies` | [ ] | [ ] | [ ] | Queued |
| S056 | `/jobs` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S057 | `/apply` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S058 | `/jobs/latest` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S059 | `/saved-jobs` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S060 | `/jobs/it` | [ ] | [ ] | [ ] | Queued |
| S061 | `/jobs/fresher` | [ ] | [ ] | [ ] | Queued |
| S062 | `/jobs/part-time` | [ ] | [ ] | [ ] | Queued |
| S063 | `/jobs/vizagjobs` | [ ] | [ ] | [ ] | Queued |
| S064 | `/jobs/:jobSegment/:jobSlug` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S065 | `/job/:jobSlug` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S066 | `/jobs/:jobId` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S067 | `/jobs/civil` | [ ] | [ ] | [ ] | Queued |
| S068 | `/jobs/mechanical` | [ ] | [ ] | [ ] | Queued |
| S069 | `/jobs/electrical` | [ ] | [ ] | [ ] | Queued |
| S070 | `/jobs/ece` | [ ] | [ ] | [ ] | Queued |
| S071 | `/jobs/engineering` | [ ] | [ ] | [ ] | Queued |
| S072 | `/jobs/banking` | [ ] | [ ] | [ ] | Queued |
| S073 | `/jobs/bpo` | [ ] | [ ] | [ ] | Queued |
| S074 | `/jobs/sales` | [ ] | [ ] | [ ] | Queued |
| S075 | `/jobs/hr` | [ ] | [ ] | [ ] | Queued |
| S076 | `/jobs/healthcare` | [ ] | [ ] | [ ] | Queued |
| S077 | `/jobs/education` | [ ] | [ ] | [ ] | Queued |
| S078 | `/jobs/hospitality` | [ ] | [ ] | [ ] | Queued |
| S079 | `/jobs/logistics` | [ ] | [ ] | [ ] | Queued |
