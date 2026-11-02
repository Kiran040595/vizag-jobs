# Official company career URL verification — 2026-11-01

These checks verify public search results and actual posting data. They do not
prove the authenticated browser fetch → SEO → publish journey.

| Company | Verified public URL | Live direct-fetch evidence |
| --- | --- | --- |
| Brandix | https://careers.brandix.com/search/?q=&locationsearch=Visakhapatnam | 12 result rows; every location Visakhapatnam; all 12 detail pages fetched, descriptions 3,992–5,872 characters |
| GMR Group | https://careers.gmrgroup.in/search/?q=&locationsearch=Visakhapatnam | 1 result, Manager Design; Visakhapatnam; official posting 1448905733 fetched with description |
| WNS | https://careers.smartrecruiters.com/WNSGlobalServices144?search=Visakhapatnam | 3 visible results; public employer posting API verifies company identifier and city for each; descriptions 1,329–2,277 characters |
| Fluentgrid | https://fluentgrid.com/careers/?job__location_spec=visakhapatnam | Location option Visakhapatnam selected; 8 linked postings, each JobPosting schema includes Visakhapatnam; 3 also list Vijayawada |
| Asian Paints | https://careers.asianpaints.com/search/?q=&locationsearch=Visakhapatnam | 5 result rows, every location Visakhapatnam; all 5 detail pages fetched with descriptions |
| IDFC FIRST Bank (private) | https://careers.idfcfirst.bank.in/in/en/search-results?keywords=Visakhapatnam | Embedded response totalHits=2; both cities Visakhapatnam, but detail expiry dates are past. Native extractor rejects both, active count 0; directory approval removed |
| JLL | https://jll.wd1.myworkdayjobs.com/JLLCareers?locations=38ccc50fa540014356996861e2cc9f0e | Workday's City facet identifies Visakhapatnam, AP. Filtered API returns 2 jobs. Shared Workday extractor fetched both descriptions and direct application links |
| Marriott | https://careers.marriott.com/jobs?filter%5Bcity%5D%5B0%5D=Visakhapatnam | Search shows 5 jobs. All five posting schemas identify Visakhapatnam; descriptions and direct job URLs extracted successfully |
| Accor | https://careers.accor.com/global/en/jobs?options=992&page=1 | Official option 992 is labelled Visakhapatnam. The filtered page returns 8 jobs; every posting schema identifies Novotel Visakhapatnam Varun Beach and supplies a direct application URL |
| Amazon | https://www.amazon.jobs/en/search?city=Visakhapatnam&country=IND&county=Visakhapatnam&latitude=17.7199&loc_query=Visakhapatnam%2C+Andhra+Pradesh%2C+India&longitude=83.26281&radius=24km&region=Andhra+Pradesh | Official city/radius search returns 5 current postings. Native JSON extraction keeps a posting only when its full location array explicitly includes Visakhapatnam, including multi-location virtual roles |
| Vodafone Idea Limited | https://careers.vodafoneidea.com/search/?q=&locationsearch=Visakhapatnam | Official SuccessFactors location search currently returns 1 active row explicitly in Visakhapatnam, with an individual official job page and full description |
| H&M | https://careers.smartrecruiters.com/HMGroup?search=Vishakhapatnam | Official SmartRecruiters API currently returns 2 active H&M Group postings explicitly in Vishakhapatnam. Native extraction validates the HMGroup employer identifier and posting city before retaining descriptions/direct links |
| Celestinfo Software Solutions | https://www.celestinfo.com/careers.html | Company-owned page exposes individual current applications; native extraction follows each company-owned detail page, validates Celestinfo JobPosting employer schema, and keeps only roles whose posting location explicitly includes Visakhapatnam |
| XTGlobal | https://xtglobal.zohorecruit.in/jobs/Careers | Official Zoho Recruit portal embeds 61 current roles explicitly mentioning Visakhapatnam/Vizag across hybrid and direct office postings; native extractor parses structured records and direct application links |
| Sails Software | https://careers.sailssoftware.com/sailssoftware/ | Official Zwayam recruitment portal and API; native extraction validates active application status, extracts verified Visakhapatnam role (Junior AI Software Engineer) with full description, salary range, and direct application link while rejecting closed positions |
| Miracle Software Systems | https://careers.miraclesoft.com/open-positions/ | Official current-jobs listing exposes individual posting IDs and full descriptions. Native extraction keeps 2 current Miracle Heights roles after the employer's official Vizag page identifies that campus as its Vizag APAC headquarters; the current Miracle City role is rejected because that campus is in Vizianagaram |
| Innocito | https://innocito.com/careers | Employer-owned page contains server-rendered structured records for 3 current Vizag roles, including stable job numbers, experience, required skills and full descriptions. Native extraction rejects the 4 Hyderabad records and retains the official shared email/application page |
| Paytm | https://jobs.lever.co/paytm?by=location&location=Vizag%2C+Andhra+Pradesh | Official Paytm Lever board filtered to Vizag. Native Lever API extraction currently returns 1 Paytm role with exact Vizag location, a 3,101-character description and an individual employer application page; separate Paytm Payments Services listings are not merged into this company record |
| Radisson Hotel Group | https://careers.smartrecruiters.com/RHG?search=Visakhapatnam | Official Radisson Hotel Group SmartRecruiters search. Native API extraction validates the RHG employer identifier and exact Visakhapatnam city; live verification returned 1 role with a 4,831-character cleaned description and direct application page |
| Wipro | https://careers.wipro.com/search/?q=&locationsearch=Visakhapatnam | Official SuccessFactors search API returned 2 active records with exact Visakhapatnam city and India country fields. Native extraction validates current end dates, canonical IDs/detail paths, and scoped employer descriptions |
| Concentrix | https://jobs.concentrix.com/job-search/?country=India&city=Visakhapatnam | Employer-owned search embeds current Workday recruitment data. Native extraction validates exact city/country, open status, Concentrix legal employer, listing/application flags, requisition ID and direct Workday application URL; live verification returned 1 Vizag role with a 2,039-character cleaned description |

Fluentgrid vacancies are available in Vizag, but some offer a choice of Vizag or
Vijayawada. They are not exclusively single-city roles; the public location is
preserved rather than rewritten.

Posting IDs from the live check:

- Brandix: 60569344, 60604344, 60788644, 60894144, 60926844, 60971344,
  61010344, 60236244, 61089544, 60242644, 60216244, 60927444.
- GMR: 1448905733. This search returned one role; it is not a claim that every
  spelling/airport locality alias has been enumerated.
- WNS: 744000151296819, 744000105344195, 744000132561468.
- Asian Paints: 1319377300, 1443487000, 1444875400, 1445245000, 1442595800.
- IDFC FIRST Bank: P-228223 (Area Head - Affordable Mortgage Loans), P-229408 (Sales Manager - EIL).
- JLL: REQ543568 (Professional, PDS Projects), REQ513383 (Design Coordination Assistant).
- Marriott: P1-7199228-0, P1-7199249-0, P1-7090732-0, P1-7199285-0, P1-7169509-0.
- Accor: 106835, 114610, 114343, 110930, 110932, 109729, 109559, 108883.
- Amazon: 10394495, 10555915, 10514854, 10528078, 10438529.
- Fluentgrid: database-engineer-postgresql, functional-domain-expert,
  java-integration-expert, system-engineer, security-engineer,
  infrastructure-lead, it-security-lead,
  project-manager-electricity-utility-billing-system-implementation.
- Wipro: 207016 (Administrator L0 (Contract)), 212142 (Production Agent L1).
- Concentrix: R1765090 (Asst Manager, Operations).

## Other official portals investigated in this batch

| Company | Finding / next verification needed |
| --- | --- |
| Miracle Software Systems | Jobs loaded through employer JavaScript/API; no verified city-filtered public URL yet |
| Patra India | Official Jibe API (`/api/jobs?location=Visakhapatnam`) returns 200 but ignores city parameter and lists US/Canada roles; no active Vizag openings verified |
| Mouri Tech | India careers page uses Ceipal ATS widget with API key, but Ceipal blocks external server requests (`400 This method is not allowed from outside of the Career Portal`); direct feed remains unverified |
| Symbiosys Technologies | Careers page is a general resume intake/mailto portal rather than an individual job vacancy feed |
| Biocon | Official locationsearch returned no rows; no live Vizag vacancy verified |
| Adani | SuccessFactors-style search URL returns 404; actual employer ATS city filter remains unverified |
| KONE | Official Workday Careers search for Visakhapatnam returns zero jobs; no current Vizag vacancy verified |
| Miracle Software Systems | Official build-your-career-vizag page accepts Vizag-only resumes, but is not a vacancy feed; kept private pending a working filtered job search |
| Dr. Reddy's Laboratories | Official option 3678 (`/jobs?options=3678&page=1`) is a real Visakhapatnam feed with current postings, but Cloudflare returns 403 to server-side fetching. Kept private until a reliable official API or approved rendering path is available |
| Cognizant | Official locations page confirms a Visakhapatnam office and links to a coordinate search, but that search currently ignores its location parameters and returns about 2,099 global jobs; direct backend access is Cloudflare-blocked |
| Stantec | Official India index contains 3 Visakhapatnam roles, but the stable page mixes 54 India-wide jobs and the city-search backend fails to return a durable filtered page. Kept private pending a working city endpoint |
| GITAM | Official careers page lists academic and non-academic openings across campuses; no durable Visakhapatnam-only vacancy filter was found |
| Pema Wellness | Official site identifies its Visakhapatnam location and broad career categories, but does not publish a current vacancy feed with individual application links |
| Hetero | Official careers content accepts general resumes by email and links to broad opportunities, but no current Visakhapatnam-only vacancy feed was found |
| Excel Global Solutions | Official SmartRecruiters API still exposes 11 Visakhapatnam records, but their release dates range from 2015 to 2017. Kept private because the feed appears stale rather than a current vacancy source |

Unverified entries remain private in admin. No outreach, applications or job
publication was performed during these read-only source checks.
