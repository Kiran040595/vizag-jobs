# Wipro and Concentrix verified directory activation — 2026-11-03

Scope: production company-directory approval and public `/companies` verification.
No jobs were published and no applications were submitted.

| Company | Exact verified careers URL | Current official-feed evidence |
| --- | --- | --- |
| Wipro | https://careers.wipro.com/search/?q=&locationsearch=Visakhapatnam | Official Wipro recruiting API returned 2 active records with exact Visakhapatnam city and India country. Both official detail pages loaded with full descriptions (3,108 and 4,672 characters) and direct application URLs: 207016 and 212142. |
| Concentrix | https://jobs.concentrix.com/job-search/?country=India&city=Visakhapatnam | Employer-owned search returned 1 open record with exact Visakhapatnam city and India country, Concentrix legal employer, enabled listing/application flags, a 2,039-character description and direct Workday application URL: R1765090. |

The two production `companies` rows were updated through the existing scoped
verification migrations. Post-update database and anonymous REST reads confirmed
that `careers_url` exactly equals `verified_careers_url`, and that both
`is_directory_approved` and `is_active_for_scrape` are true.

The first rendered production check exposed an independent deployment blocker:
the public query requested the optional `linkedin_url` column, which is absent in
production, so the entire directory rendered zero companies. The scoped directory
fix removes that optional-column dependency and keeps verified-only filtering at
the database, cache, service and render boundaries. Functional and mobile UI
verification was reopened until the corrected production bundle was deployed.

Automated verification completed before delivery: the focused company-directory
suite passed 14/14, both native extractor tests passed, targeted ESLint passed,
and the Vite production build passed. The broader career-pipeline suite has an
unrelated existing failure at `tests/company-career-fetch.test.mjs:712`: its
mocked legacy publication expects the on-platform "direct" classifier to return
true for a company-career import, but the current classifier correctly returns
false after those source types were separated.

## Post-deployment rendered retest

Commit `44d02b8` deployed successfully. A cache-busted production load returned
19 verified companies. Desktop accessibility inspection confirmed the Wipro and
Concentrix cards, visible `Verified careers` labels, exact company-job links and
the exact official career URLs.

At a 390×844 viewport, searching for `Wipro` and `Concentrix` independently
returned exactly one card in each case. The verified label and both primary links
remained available; the document/body scroll widths were 376px within a 391px
reported inner width, so no horizontal overflow was present. This passes mobile
UI verification for the scoped cards and badges. The overall S055 functional E2E
status remains In progress because this retest inspected the exact outbound hrefs
but did not navigate away from VizagJobs into both third-party career portals.
