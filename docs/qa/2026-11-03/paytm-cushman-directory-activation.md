# Paytm and Cushman & Wakefield verified directory activation — 2026-11-03

Scope: production company-directory approval and public `/companies` verification.
No applications were submitted and this approval run did not publish jobs.

| Company | Exact verified careers URL | Current official-feed evidence |
| --- | --- | --- |
| Paytm | https://jobs.lever.co/paytm?by=location&location=Vizag%2C+Andhra+Pradesh | Official Paytm Lever API returned 1 exact-Vizag role: Area Collection Manager - Manager - Lending Collections (Frontend), posting `7c317d05-b1ff-443f-975a-5b96e2728ac5`, with a 3,099-character description and direct employer application URL. |
| Cushman & Wakefield | https://cw.wd1.myworkdayjobs.com/External?q=Vizag | Official Workday CXS API returned 4 active Vizag roles: R321416, R341772, R341771 and R321413. Each passed the active-application, requisition-ID, Vizag-evidence, description and direct-link checks; descriptions were 2,467–3,972 characters. |

The existing scoped verification migrations were executed against production.
Database and anonymous REST reads confirmed that each `careers_url` exactly
matches `verified_careers_url`, and that `is_directory_approved` and
`is_active_for_scrape` are true. The anonymous approved-company count increased
from 19 to 21.

Automated verification passed: company-directory tests 14/14 and the complete
company-career fetch suite 48/48. The already-open browser tab retained its
valid 10-minute directory cache with the previous 19 records, so immediate
rendered badge verification was deferred until that cache expires; this was not
misreported as a rendered UI pass.
