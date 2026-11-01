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

## Other official portals investigated in this batch

| Company | Finding / next verification needed |
| --- | --- |
| Miracle Software Systems | Jobs loaded through employer JavaScript/API; no verified city-filtered public URL yet |
| Innocito | Current careers page mixes Hyderabad and Vizag; a persistent city-filtered URL is not yet verified |
| Patra India | Official jobs site uses iCIMS/Jibe; city filter needs verification |
| Mouri Tech | Corporate careers page links to India jobs; city-filtered destination needs verification |
| XTGlobal | Corporate site links to xtglobal.zohorecruit.in; city-filtered destination needs verification |
| Sails Software | Corporate site links to careers.sailssoftware.com/sailssoftware/; city filter needs verification |
| Biocon | Official locationsearch returned no rows; no live Vizag vacancy verified |
| Adani | SuccessFactors-style search URL returns 404; actual employer ATS city filter remains unverified |
| KONE | Official Workday Careers search for Visakhapatnam returns zero jobs; no current Vizag vacancy verified |
| Miracle Software Systems | Official build-your-career-vizag page accepts Vizag-only resumes, but is not a vacancy feed; kept private pending a working filtered job search |

Unverified entries remain private in admin. No outreach, applications or job
publication was performed during these read-only source checks.
