# Official company career URL verification — 2026-11-01

These checks verify public search results and actual posting data. They do not
prove the authenticated browser fetch → SEO → publish journey.

| Company | Verified public URL | Live direct-fetch evidence |
| --- | --- | --- |
| Brandix | https://careers.brandix.com/search/?q=&locationsearch=Visakhapatnam | 12 result rows; every location Visakhapatnam; all 12 detail pages fetched, descriptions 3,992–5,872 characters |
| GMR Group | https://careers.gmrgroup.in/search/?q=&locationsearch=Visakhapatnam | 1 result, Manager Design; Visakhapatnam; official posting 1448905733 fetched with description |
| WNS | https://careers.smartrecruiters.com/WNSGlobalServices144?search=Visakhapatnam | 3 visible results; public employer posting API verifies company identifier and city for each; descriptions 1,329–2,277 characters |
| Fluentgrid | https://fluentgrid.com/careers/?job__location_spec=visakhapatnam | Location option Visakhapatnam selected; 8 linked postings, each JobPosting schema includes Visakhapatnam; 3 also list Vijayawada |

Fluentgrid vacancies are available in Vizag, but some offer a choice of Vizag or
Vijayawada. They are not exclusively single-city roles; the public location is
preserved rather than rewritten.

Posting IDs from the live check:

- Brandix: 60569344, 60604344, 60788644, 60894144, 60926844, 60971344,
  61010344, 60236244, 61089544, 60242644, 60216244, 60927444.
- GMR: 1448905733. This search returned one role; it is not a claim that every
  spelling/airport locality alias has been enumerated.
- WNS: 744000151296819, 744000105344195, 744000132561468.
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
| Accor | Phenom-style /global/en/search-results URL returns 404; employer also publishes on SmartRecruiters |
| Amazon | Existing search is a rendered shell; vacancy data and effective location restriction need verification |

Unverified entries remain private in admin. No outreach, applications or job
publication was performed during these read-only source checks.
