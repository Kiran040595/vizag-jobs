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
| S007 | `/` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
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
| S029 | `/admin` | [x] | [ ] | [ ] | Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids; full verification pending |
| S030 | `/admin/new` | [x] | [ ] | [ ] | Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids; full verification pending |
| S031 | `/admin/jobs` | [x] | [ ] | [ ] | Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids; full verification pending |
| S032 | `/admin/admin-jobs` | [x] | [ ] | [ ] | Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids; full verification pending |
| S033 | `/admin/fetch` | [x] | [ ] | [ ] | Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids; full verification pending |
| S034 | `/admin/jobs/:jobId/edit` | [x] | [ ] | [ ] | Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids; full verification pending |
| S035 | `/admin/jobs/:jobId/applications` | [x] | [ ] | [ ] | Applicant UI batch 4e087f0; synthetic component checks only |
| S036 | `/admin/blog` | [x] | [ ] | [ ] | Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids; full verification pending |
| S037 | `/admin/blog/new` | [x] | [ ] | [ ] | Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids; full verification pending |
| S038 | `/admin/blog/:postId/edit` | [x] | [ ] | [ ] | Admin control sizing/focus baseline; stacked job/blog form actions; SQL toggle layout; labelled job filters; bounded import report and detail grids; full verification pending |
| S039 | `/admin/feedback` | [x] | [ ] | [ ] | Management filter labels, moderation text wrapping, employer links, notification table scrolling, bill preview spacing and accessible student export/share dialogs; full verification pending |
| S040 | `/admin/questions` | [x] | [ ] | [ ] | Management filter labels, moderation text wrapping, employer links, notification table scrolling, bill preview spacing and accessible student export/share dialogs; full verification pending |
| S041 | `/admin/employers` | [x] | [ ] | [ ] | Management filter labels, moderation text wrapping, employer links, notification table scrolling, bill preview spacing and accessible student export/share dialogs; full verification pending |
| S042 | `/admin/companies` | [x] | [ ] | [ ] | Management filter labels, moderation text wrapping, employer links, notification table scrolling, bill preview spacing and accessible student export/share dialogs; full verification pending |
| S043 | `/admin/bills` | [x] | [ ] | [ ] | Management filter labels, moderation text wrapping, employer links, notification table scrolling, bill preview spacing and accessible student export/share dialogs; full verification pending |
| S044 | `/admin/students` | [x] | [ ] | [ ] | Management filter labels, moderation text wrapping, employer links, notification table scrolling, bill preview spacing and accessible student export/share dialogs; full verification pending |
| S045 | `/admin/notifications` | [x] | [ ] | [ ] | Management filter labels, moderation text wrapping, employer links, notification table scrolling, bill preview spacing and accessible student export/share dialogs; full verification pending |
| S046 | `/blog` | [x] | [ ] | [ ] | Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording; full verification pending |
| S047 | `/blog/:slug` | [x] | [ ] | [ ] | Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording; full verification pending |
| S048 | `/about` | [x] | [ ] | [ ] | Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording; full verification pending |
| S049 | `/contact` | [x] | [ ] | [ ] | Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording; full verification pending |
| S050 | `/feedback` | [x] | [ ] | [ ] | Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording; full verification pending |
| S051 | `/qa` | [x] | [ ] | [ ] | Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording; full verification pending |
| S052 | `/privacy-policy` | [x] | [ ] | [ ] | Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording; full verification pending |
| S053 | `/terms-of-service` | [x] | [ ] | [ ] | Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording; full verification pending |
| S054 | `/disclaimer` | [x] | [ ] | [ ] | Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording; full verification pending |
| S055 | `/companies` | [x] | [ ] | [ ] | Public content spacing and long-text wrapping; accessible Q&A modal; company actions and result wording; full verification pending |
| S056 | `/jobs` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S057 | `/apply` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S058 | `/jobs/latest` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S059 | `/saved-jobs` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S060 | `/jobs/it` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S061 | `/jobs/fresher` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S062 | `/jobs/part-time` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S063 | `/jobs/vizagjobs` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S064 | `/jobs/:jobSegment/:jobSlug` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S065 | `/job/:jobSlug` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S066 | `/jobs/:jobId` | [x] | [ ] | [ ] | Prior UI batch implemented; verification incomplete |
| S067 | `/jobs/civil` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S068 | `/jobs/mechanical` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S069 | `/jobs/electrical` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S070 | `/jobs/ece` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S071 | `/jobs/engineering` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S072 | `/jobs/banking` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S073 | `/jobs/bpo` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S074 | `/jobs/sales` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S075 | `/jobs/hr` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S076 | `/jobs/healthcare` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S077 | `/jobs/education` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S078 | `/jobs/hospitality` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
| S079 | `/jobs/logistics` | [x] | [ ] | [ ] | Category listing hero shows supported controls only; fixed city is read-only; loading and empty-search reset actions; article wrapping; full verification pending |
