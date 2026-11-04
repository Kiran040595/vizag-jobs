import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeUrlForCompare,
  cleanCompanyForDedupe,
  cleanTitleForDedupe,
  normalizeCompanyTitleKey,
  isVizagEligibleJobLocation,
  resolveCompanyJobApplyLink,
  buildCompanyExistingJobIndex,
  shouldSkipCompanyCareerJob,
  fetchAndClassifyCompanyJobs,
  optimizeSingleCompanyJob,
  publishSingleCompanyJob,
  runSingleCompanyCareerPipeline,
} from '../src/lib/companyCareerFetchAutomation.js';
import { isDirectPosting } from '../src/lib/jobDirectPosting.js';
import { resolveCanonicalCareerPortalUrl, parseConduentSearchJobs, parseSuccessFactorsVizagJobs, parseInnocitoVizagJobs, scrapeVerifiedVizagPortal, VERIFIED_VIZAG_PORTALS } from '../supabase/functions/fetch-external-jobs/company-careers.ts';

test('Growww Tech reads current exact-city job schema from employer pages', async () => {
  const originalFetch = globalThis.fetch;
  const detail = (title, city = 'Visakhapatnam', validThrough = '2027-03-21') => `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title, hiringOrganization: { name: 'Growww Tech' }, jobLocation: { address: { addressLocality: city } }, validThrough, description: '<p>Own the customer pipeline, support the team, and deliver reliable outcomes for clients every working day.</p>' })}</script>`;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/careers')) return new Response(`<script type="application/ld+json">${JSON.stringify({ '@type': 'ItemList', itemListElement: [{ url: 'https://growwwtech.com/careers/sales-team-lead' }, { url: 'https://growwwtech.com/careers/remote-role' }, { url: 'https://growwwtech.com/careers/expired-role' }] })}</script>`);
    if (url.endsWith('/sales-team-lead')) return new Response(detail('Sales Team Lead'));
    if (url.endsWith('/remote-role')) return new Response(detail('Remote Role', 'Hyderabad'));
    return new Response(detail('Expired Role', 'Visakhapatnam', '2026-01-01'));
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS['growww tech'], 'Growww Tech');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'Sales Team Lead');
    assert.equal(result.structuredJobs[0].apply_link, 'https://growwwtech.com/careers/sales-team-lead');
  } finally { globalThis.fetch = originalFetch; }
});

test('DMart reads active Visakhapatnam roles from its official SuccessFactors pages', async () => {
  const originalFetch = globalThis.fetch;
  const link = '/ASL/job/GRN-OFFICERS-Visa/1369732766/';
  globalThis.fetch = async (input) => String(input).includes('/search/')
    ? new Response(`<a class="jobTitle-link" href="${link}">GRN OFFICERS</a><div id="job-1369732766-desktop-section-location-value">Visakhapatnam, Andhra Pradesh</div>`)
    : new Response(`<meta itemprop="validThrough" content="Wed Dec 30 23:59:00 UTC 2026"><meta itemprop="hiringOrganization" content="avenuesupe"><h1 id="job-title" itemprop="title">GRN OFFICERS</h1><span class="jobGeoLocation">Visakhapatnam, Andhra Pradesh</span><span itemprop="description" class="jobdescription"><p>Coordinate store inventory receipts and reconcile records with the team. Review purchase documents and support daily store operations accurately.</p></span>`);
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS['dmart - avenue supermarts ltd'], 'DMart - Avenue Supermarts Ltd');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'GRN OFFICERS');
    assert.equal(result.structuredJobs[0].apply_link, `https://careers.dmartindia.com${link}`);
  } finally { globalThis.fetch = originalFetch; }
});

test('Expired Phenom postings are rejected even when present in search results', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('search-results')) return new Response(`{"eagerLoadRefineSearch":${JSON.stringify({ data: { jobs: [1, 2].map((id) => ({ jobId: `P-${id}`, title: `Role ${id}`, city: 'Visakhapatnam' })) } })}}`);
    const expired = String(url).includes('/P-1/');
    return new Response(`{"jobDetail":${JSON.stringify({ data: { job: { title: 'Current role', location: 'Visakhapatnam', expiryDate: expired ? '2000-01-01' : '2999-01-01', description: '<p>Detailed responsibilities for the current Vizag vacancy, with qualifications and relevant skills for candidates.</p>' } } })}}`);
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS['idfc first bank'], 'IDFC FIRST Bank');
    assert.equal(result.count, 1);
    assert.match(result.structuredJobs[0].apply_link, /\/P-2\//);
    assert.match(result.structuredJobs[0].description, /Detailed responsibilities/);
  } finally { globalThis.fetch = originalFetch; }
});

test('SuccessFactors reads result rows once and rejects non-Vizag or external links', () => {
  const row = (href, location) => `<tr class="data-row"><td><a href="${href}" class="jobTitle-link">Engineer</a><a href="${href}" class="jobTitle-link">Engineer</a><span class="jobLocation">${location}</span></td></tr>`;
  const html = row('/job/Vizag/123/', 'Visakhapatnam, India') + row('/job/Pune/456/', 'Pune, India') + row('https://unrelated.example/job/1', 'Visakhapatnam');
  const jobs = parseSuccessFactorsVizagJobs(html, VERIFIED_VIZAG_PORTALS.brandix, 'Brandix');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].apply_link, 'https://careers.brandix.com/job/Vizag/123/');
});

test('Wipro official recruiting API retains active exact-city jobs with scoped descriptions', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const value = String(url);
    if (value.endsWith('/services/recruiting/v1/jobs')) {
      assert.equal(options?.method, 'POST');
      return Response.json({ jobSearchResult: [
        { response: { id: '207016', unifiedStandardTitle: 'Administrator L0', unifiedUrlTitle: 'ADMINISTRATOR-L0', unifiedStandardEnd: '2999-12-03', sfstd_jobLocation_obj: ['Visakhapatnam'], jobLocationCountry: ['India'], custRMKMappingPicklist: ['Cloud'] } },
        { response: { id: '207017', unifiedStandardTitle: 'Other City Role', unifiedUrlTitle: 'OTHER-CITY-ROLE', unifiedStandardEnd: '2999-12-03', sfstd_jobLocation_obj: ['Hyderabad'], jobLocationCountry: ['India'] } },
        { response: { id: '207018', unifiedStandardTitle: 'Expired Role', unifiedUrlTitle: 'EXPIRED-ROLE', unifiedStandardEnd: '2000-01-01', sfstd_jobLocation_obj: ['Visakhapatnam'], jobLocationCountry: ['India'] } },
      ] });
    }
    assert.equal(value, 'https://careers.wipro.com/job/ADMINISTRATOR-L0/207016-en_US/');
    return new Response('<span itemprop="description" class="rtltextaligneligible"><div><p>Detailed official Wipro responsibilities, required technical skills, service delivery expectations, and candidate qualifications.</p></div></span></div><span>Visakhapatnam</span>');
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS.wipro, 'Wipro');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'Administrator L0');
    assert.equal(result.structuredJobs[0].category, 'Cloud');
    assert.equal(result.structuredJobs[0].apply_link, 'https://careers.wipro.com/job/ADMINISTRATOR-L0/207016-en_US/');
    assert.match(result.structuredJobs[0].description, /Detailed official Wipro responsibilities/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Concentrix employer job data retains only open exact-city Workday applications', async () => {
  const originalFetch = globalThis.fetch;
  const posting = (overrides = {}) => ({
    ats_external_id: 'R1765090', job_title: 'Asst Manager, Operations', city: 'Visakhapatnam', country: 'India',
    job_category: 'Contact Center', job_type: 'full_time', allow_applications: '1', publish_on_job_listing: '1',
    long_description: '<p>Lead contact-center operations, coach teams, manage performance targets, and deliver strong customer outcomes.</p>',
    apply_url: 'https://cnx.wd1.myworkdayjobs.com/external_global/job/IND-Visakhapatnam/Asst-Manager--Operations_R1765090/apply',
    workday_job_requisition_data: { status: { id: 'OPEN' }, company: { descriptor: 'Concentrix Daksh Services India Private Limited' } },
    ...overrides,
  });
  globalThis.fetch = async (url) => {
    assert.equal(String(url), VERIFIED_VIZAG_PORTALS.concentrix);
    const payload = { data: [
      posting(),
      posting({ ats_external_id: 'R1765091', city: 'Hyderabad', apply_url: 'https://cnx.wd1.myworkdayjobs.com/external_global/job/IND-Hyderabad/Other_R1765091/apply' }),
      posting({ ats_external_id: 'R1765092', workday_job_requisition_data: { status: { id: 'CLOSED' }, company: { descriptor: 'Concentrix Daksh Services India Private Limited' } }, apply_url: 'https://cnx.wd1.myworkdayjobs.com/external_global/job/IND-Visakhapatnam/Closed_R1765092/apply' }),
    ] };
    return new Response(`<script type="application/json" id="jobsData">${JSON.stringify(payload)}</script>`);
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS.concentrix, 'Concentrix');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'Asst Manager, Operations');
    assert.equal(result.structuredJobs[0].category, 'Contact Center');
    assert.match(result.structuredJobs[0].apply_link, /R1765090\/apply$/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Cushman & Wakefield official Workday portal retains active Vizag roles and rejects closed or non-Vizag roles', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const value = String(url);
    if (value.endsWith('/wday/cxs/cw/External/jobs')) {
      assert.equal(options?.method, 'POST');
      return Response.json({
        total: 3,
        jobPostings: [
          {
            title: 'Planning Manager - (Data Center) - Vizag',
            externalPath: '/job/Hyderabad-India/Planning-Manager----Data-Center----Vizag_R341772',
            locationsText: 'Hyderabad, India',
            bulletFields: ['R341772'],
          },
          {
            title: 'Project Lead - Pune',
            externalPath: '/job/Pune-India/Project-Lead_R341773',
            locationsText: 'Pune, India',
            bulletFields: ['R341773'],
          },
          {
            title: 'Closed Manager - Vizag',
            externalPath: '/job/Hyderabad-India/Closed-Manager_R341774',
            locationsText: 'Hyderabad, India',
            bulletFields: ['R341774'],
          },
        ],
      });
    }
    if (value.includes('R341772')) {
      return Response.json({
        jobPostingInfo: {
          id: 'R341772',
          title: 'Planning Manager - (Data Center) - Vizag',
          jobReqId: 'R341772',
          location: 'Hyderabad, India',
          canApply: true,
          timeType: 'Full-Time',
          externalUrl: 'https://cw.wd1.myworkdayjobs.com/External/job/Hyderabad-India/Planning-Manager----Data-Center----Vizag_R341772',
          jobDescription: '<p>Oversee project schedules, engineering coordination, site delivery milestones, and commissioning readiness for our Vizag data center development.</p>',
        },
      });
    }
    if (value.includes('R341773')) {
      return Response.json({
        jobPostingInfo: {
          id: 'R341773',
          title: 'Project Lead - Pune',
          jobReqId: 'R341773',
          location: 'Pune, India',
          canApply: true,
          timeType: 'Full-Time',
          externalUrl: 'https://cw.wd1.myworkdayjobs.com/External/job/Pune-India/Project-Lead_R341773',
          jobDescription: '<p>Deliver civil engineering works and project management strictly for the Pune site.</p>',
        },
      });
    }
    if (value.includes('R341774')) {
      return Response.json({
        jobPostingInfo: {
          id: 'R341774',
          title: 'Closed Manager - Vizag',
          jobReqId: 'R341774',
          location: 'Hyderabad, India',
          canApply: false,
          timeType: 'Full-Time',
          externalUrl: 'https://cw.wd1.myworkdayjobs.com/External/job/Hyderabad-India/Closed-Manager_R341774',
          jobDescription: '<p>This closed requisition is no longer taking candidate applications for Vizag.</p>',
        },
      });
    }
    throw new Error(`Unexpected URL in test: ${value}`);
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS['cushman & wakefield'], 'Cushman & Wakefield');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'Planning Manager - (Data Center) - Vizag');
    assert.equal(result.structuredJobs[0].company, 'Cushman & Wakefield');
    assert.equal(result.structuredJobs[0].location, 'Visakhapatnam, Andhra Pradesh, India');
    assert.equal(result.structuredJobs[0].apply_link, 'https://cw.wd1.myworkdayjobs.com/External/job/Hyderabad-India/Planning-Manager----Data-Center----Vizag_R341772');
    assert.match(result.structuredJobs[0].description, /Vizag data center development/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Credit Saison India official Workday portal retains active Vizag roles and rejects closed or non-Vizag roles', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const value = String(url);
    if (value.endsWith('/wday/cxs/saison/Credit_Saison_India/jobs')) {
      assert.equal(options?.method, 'POST');
      return Response.json({
        total: 3,
        jobPostings: [
          {
            title: 'Relationship Manager - Secured Direct South ( AP ,TS & TN )',
            externalPath: '/job/Hyderabad/Relationship-Manager---Secured-Direct_REQ-001807',
            locationsText: '30 Locations',
            bulletFields: ['REQ-001807'],
          },
          {
            title: 'Branch Manager - Delhi',
            externalPath: '/job/Delhi/Branch-Manager_REQ-001808',
            locationsText: 'Delhi, India',
            bulletFields: ['REQ-001808'],
          },
          {
            title: 'Closed Manager - Visakhapatnam',
            externalPath: '/job/Hyderabad/Closed-Manager_REQ-001809',
            locationsText: 'Visakhapatnam',
            bulletFields: ['REQ-001809'],
          },
        ],
      });
    }
    if (value.includes('REQ-001807')) {
      return Response.json({
        jobPostingInfo: {
          id: 'REQ-001807',
          title: 'Relationship Manager - Secured Direct South ( AP ,TS & TN )',
          jobReqId: 'REQ-001807',
          location: 'Hyderabad',
          additionalLocations: ['Vijayawada', 'Visakhapatnam', 'Ankapalli'],
          canApply: true,
          timeType: 'Full-Time',
          externalUrl: 'https://saison.wd102.myworkdayjobs.com/Credit_Saison_India/job/Hyderabad/Relationship-Manager---Secured-Direct_REQ-001807',
          jobDescription: '<p>Manage secured loan portfolio, lead customer acquisition, and expand direct retail lending across Visakhapatnam and coastal AP branches.</p>',
        },
      });
    }
    if (value.includes('REQ-001808')) {
      return Response.json({
        jobPostingInfo: {
          id: 'REQ-001808',
          title: 'Branch Manager - Delhi',
          jobReqId: 'REQ-001808',
          location: 'Delhi, India',
          canApply: true,
          timeType: 'Full-Time',
          externalUrl: 'https://saison.wd102.myworkdayjobs.com/Credit_Saison_India/job/Delhi/Branch-Manager_REQ-001808',
          jobDescription: '<p>Manage Delhi branch lending targets and customer service operations.</p>',
        },
      });
    }
    if (value.includes('REQ-001809')) {
      return Response.json({
        jobPostingInfo: {
          id: 'REQ-001809',
          title: 'Closed Manager - Visakhapatnam',
          jobReqId: 'REQ-001809',
          location: 'Visakhapatnam',
          canApply: false,
          timeType: 'Full-Time',
          externalUrl: 'https://saison.wd102.myworkdayjobs.com/Credit_Saison_India/job/Hyderabad/Closed-Manager_REQ-001809',
          jobDescription: '<p>This closed requisition is no longer taking candidate applications for Vizag.</p>',
        },
      });
    }
    throw new Error(`Unexpected URL in test: ${value}`);
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS['credit saison india'], 'Credit Saison India');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'Relationship Manager - Secured Direct South ( AP ,TS & TN )');
    assert.equal(result.structuredJobs[0].company, 'Credit Saison India');
    assert.equal(result.structuredJobs[0].location, 'Visakhapatnam, Andhra Pradesh, India');
    assert.equal(result.structuredJobs[0].category, 'Banking & Finance');
    assert.equal(result.structuredJobs[0].apply_link, 'https://saison.wd102.myworkdayjobs.com/Credit_Saison_India/job/Hyderabad/Relationship-Manager---Secured-Direct_REQ-001807');
    assert.match(result.structuredJobs[0].description, /Visakhapatnam and coastal AP branches/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Varex official Workday facet retains open Visakhapatnam roles only', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const value = String(url);
    assert.match(value, /vareximaging\.wd103\.myworkdayjobs\.com\/wday\/cxs\/vareximaging\/External_Career_Site/);
    if (value.endsWith('/jobs')) {
      assert.deepEqual(JSON.parse(options.body).appliedFacets.locations, ['6dd16ee3ba301001dd775f79921c0000']);
      return Response.json({ jobPostings: [
        { title: 'Accountant', externalPath: '/job/Visakhapatnam/Accountant_R0006108', locationsText: 'Visakhapatnam' },
        { title: 'Closed Role', externalPath: '/job/Visakhapatnam/Closed-Role_R0006109', locationsText: 'Visakhapatnam' },
        { title: 'Other City', externalPath: '/job/Pune/Other-City_R0006110', locationsText: 'Pune' },
      ] });
    }
    const closed = value.includes('Closed-Role');
    const path = closed ? '/job/Visakhapatnam/Closed-Role_R0006109' : '/job/Visakhapatnam/Accountant_R0006108';
    return Response.json({ jobPostingInfo: {
      title: closed ? 'Closed Role' : 'Accountant', jobReqId: closed ? 'R0006109' : 'R0006108',
      location: 'Visakhapatnam', country: { descriptor: 'India' }, posted: true, canApply: !closed,
      timeType: 'Full time',
      jobDescription: '<p>Manage accounting operations, reconcile records, document compliance procedures, and collaborate with manufacturing teams in Visakhapatnam.</p>',
      externalUrl: `https://vareximaging.wd103.myworkdayjobs.com/External_Career_Site${path}`,
    } });
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS['varex imaging manufacturing india pvt. ltd.'], 'Varex Imaging Manufacturing India Pvt. Ltd.');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'Accountant');
    assert.equal(result.structuredJobs[0].apply_link, 'https://vareximaging.wd103.myworkdayjobs.com/External_Career_Site/job/Visakhapatnam/Accountant_R0006108');
  } finally { globalThis.fetch = originalFetch; }
});

test('Verified city-filtered URLs survive canonicalization', () => {
  for (const [name, url] of Object.entries(VERIFIED_VIZAG_PORTALS)) {
    assert.equal(resolveCanonicalCareerPortalUrl(url, name), url);
  }
});

test('Schema-based verified portals retain only current Vizag postings', async () => {
  const originalFetch = globalThis.fetch;
  const links = ['/global/en/job/current-in-vizag-jid-1', '/global/en/job/expired-in-vizag-jid-2', '/global/en/job/current-in-pune-jid-3'];
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value === VERIFIED_VIZAG_PORTALS.accor) {
      return new Response(links.map((link) => `<a href="${link}">Role</a>`).join(''));
    }
    const expired = value.includes('jid-2');
    const pune = value.includes('jid-3');
    return new Response(`<script type="application/ld+json">${JSON.stringify({
      '@type': 'JobPosting',
      title: expired ? 'Expired role' : pune ? 'Pune role' : 'Current Vizag role',
      description: '<p>A detailed official vacancy description with responsibilities and qualifications.</p>',
      validThrough: expired ? '2000-01-01' : '2999-01-01',
      jobLocation: { address: { addressLocality: pune ? 'Pune' : 'Visakhapatnam' } },
    })}</script>`);
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS.accor, 'Accor');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'Current Vizag role');
    assert.equal(result.structuredJobs[0].location, 'Visakhapatnam');
  } finally { globalThis.fetch = originalFetch; }
});

test('XTGlobal embedded Zoho Recruit jobs extract Vizag roles with direct links', async () => {
  const originalFetch = globalThis.fetch;
  const mockHtml = `<input type="hidden" value="[{&#34;Remote_Job&#34;:false,&#34;Posting_Title&#34;:&#34;Software Test Lead&#34;,&#34;Is_Locked&#34;:false,&#34;City&#34;:&#34;Hyderabad / Vizag&#34;,&#34;Job_Description&#34;:&#34;Software Test Lead in Visakhapatnam office with experience in testing. Full responsibilities and qualifications.&#34;,&#34;id&#34;:&#34;172414000004465027&#34;,&#34;Publish&#34;:true},{&#34;Remote_Job&#34;:false,&#34;Posting_Title&#34;:&#34;Dallas Developer&#34;,&#34;Is_Locked&#34;:false,&#34;City&#34;:&#34;Dallas&#34;,&#34;Job_Description&#34;:&#34;Dallas Texas role only with no India connection.&#34;,&#34;id&#34;:&#34;172414000009999999&#34;,&#34;Publish&#34;:true}]">`;
  globalThis.fetch = async (url) => {
    if (String(url) === VERIFIED_VIZAG_PORTALS.xtglobal) {
      return new Response(mockHtml, { status: 200 });
    }
    return new Response('', { status: 404 });
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS.xtglobal, 'XTGlobal');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'Software Test Lead');
    assert.equal(result.structuredJobs[0].apply_link, 'https://xtglobal.zohorecruit.in/jobs/Careers/172414000004465027');
    assert.match(result.structuredJobs[0].description, /Software Test Lead in Visakhapatnam/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Sails Software official Zwayam API extracts active Vizag jobs and rejects closed roles', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const urlStr = String(url);
    if (urlStr.includes('jobs/search')) {
      return new Response(JSON.stringify({
        data: {
          data: [
            { _source: { jobTitle: 'Junior AI Software Engineer', location: 'Visakhapatnam, Andhra Pradesh, India', jobUrl: 'junior-ai-software-engineer-vizag' } },
            { _source: { jobTitle: 'Closed Engineer', location: 'Visakhapatnam, Andhra Pradesh, India', jobUrl: 'closed-engineer-vizag' } },
            { _source: { jobTitle: 'US Platform Engineer', location: 'St. Louis, Missouri, United States', jobUrl: 'us-platform-engineer' } },
          ],
        },
      }), { status: 200 });
    }
    if (urlStr.includes('jobs/careersite')) {
      const body = JSON.parse(options?.body || '{}');
      if (body.jobUrl === 'junior-ai-software-engineer-vizag') {
        return new Response(JSON.stringify({
          jobTitle: 'Junior AI Software Engineer',
          location: 'Visakhapatnam, Andhra Pradesh, India',
          longDescription: '<p>Junior AI Software Engineer role in Visakhapatnam with key requirements and responsibilities.</p>',
          minJobSalary: 500000,
          maxJobSalary: 1000000,
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ message: 'This job is no longer accepting applications.' }), { status: 404 });
    }
    return new Response('', { status: 404 });
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS['sails software'], 'Sails Software');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'Junior AI Software Engineer');
    assert.equal(result.structuredJobs[0].location, 'Visakhapatnam, Andhra Pradesh, India');
    assert.equal(result.structuredJobs[0].apply_link, 'https://careers.sailssoftware.com/sailssoftware/jobview/junior-ai-software-engineer-vizag');
    assert.match(result.structuredJobs[0].description, /Junior AI Software Engineer role in Visakhapatnam/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Miracle official listing extracts Miracle Heights jobs and rejects its non-Vizag campus', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value === VERIFIED_VIZAG_PORTALS['miracle software systems']) {
      return new Response([
        '<a href="open-positions/open-positions-sub?jobId=MSSJ1001">Vizag role</a>',
        '<a href="open-positions/open-positions-sub?jobId=MSSJ1002">Other campus role</a>',
      ].join(''));
    }
    const vizag = value.includes('MSSJ1001');
    return new Response(`<script type="application/ld+json">${JSON.stringify({
      '@type': 'JobTitle',
      ID: vizag ? 'MSSJ1001' : 'MSSJ1002',
      title: vizag ? 'GCP Data Engineer' : 'Technical Program Manager',
      experience: '8-12 years',
      location: vizag ? 'India-Miracle Heights' : 'India-Miracle City',
      description: '<p>Detailed official responsibilities, qualifications, technical skills, and delivery expectations for this current vacancy.</p>',
    })}</script>`);
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS['miracle software systems'], 'Miracle Software Systems');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'GCP Data Engineer');
    assert.equal(result.structuredJobs[0].location, 'Miracle Heights, Visakhapatnam, Andhra Pradesh, India');
    assert.equal(result.structuredJobs[0].apply_link, 'https://careers.miraclesoft.com/open-positions/open-positions-sub?jobId=MSSJ1001');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Innocito server-rendered records retain Vizag jobs and reject Hyderabad jobs', () => {
  const payload = `route data ${JSON.stringify({ jobs: [
    { title: 'Sr Python Developer', location: 'Vizag', type: 'Full Time', experience: '3-8 years', requiredSkill: 'Python, Django/Flask', jobNumber: 'ATCI-5104579-S1889366', description: 'Build scalable Python APIs and backend applications with cloud platforms, databases, performance optimization, and cross-functional delivery.' },
    { title: 'Java Fullstack Developer', location: 'Hyderabad', type: 'Full Time', experience: '1-8 years', requiredSkill: 'Java', jobNumber: 'ATCI-5104579-S1889364', description: 'Build scalable Java applications with Spring Boot, APIs, databases, and modern deployment practices for enterprise customers.' },
  ] })}`;
  const html = `<script>self.__next_f.push([1,${JSON.stringify(payload)}])</script>`;
  const jobs = parseInnocitoVizagJobs(html, VERIFIED_VIZAG_PORTALS.innocito, 'Innocito');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Sr Python Developer');
  assert.equal(jobs[0].location, 'Visakhapatnam, Andhra Pradesh, India');
  assert.equal(jobs[0].apply_link, 'https://innocito.com/careers');
  assert.deepEqual(jobs[0].skills, ['Python, Django/Flask']);
});

test('Paytm official Lever feed retains only its Vizag posting with a direct link', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), 'https://api.lever.co/v0/postings/paytm?mode=json');
    const posting = (id, location) => ({
      id,
      text: location.startsWith('Vizag') ? 'Area Collection Manager' : 'Other City Manager',
      categories: { location, commitment: 'Full-time Employment', team: 'Collections' },
      workplaceType: 'onsite',
      hostedUrl: `https://jobs.lever.co/paytm/${id}`,
      descriptionPlain: 'Detailed official responsibilities, required experience, collection strategy, leadership expectations, and candidate qualifications for this current role.',
    });
    return Response.json([
      posting('7c317d05-b1ff-443f-975a-5b96e2728ac5', 'Vizag, Andhra Pradesh'),
      posting('1c317d05-b1ff-443f-975a-5b96e2728ac6', 'Hyderabad, Telangana'),
    ]);
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS.paytm, 'Paytm');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'Area Collection Manager');
    assert.equal(result.structuredJobs[0].location, 'Visakhapatnam, Andhra Pradesh, India');
    assert.equal(result.structuredJobs[0].apply_link, 'https://jobs.lever.co/paytm/7c317d05-b1ff-443f-975a-5b96e2728ac5');
  } finally { globalThis.fetch = originalFetch; }
});

test('Radisson official SmartRecruiters feed validates employer and exact city', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.includes('/postings?q=')) {
      return Response.json({ content: [
        { id: '744000146178529', name: 'Sales Manager', location: { city: 'Visakhapatnam' } },
        { id: '744000146178530', name: 'Other City Manager', location: { city: 'Hyderabad' } },
      ] });
    }
    return Response.json({
      id: '744000146178529', name: 'Sales Manager',
      company: { identifier: 'RHG' },
      location: { city: 'Visakhapatnam', fullLocation: 'Visakhapatnam, AP, India' },
      postingUrl: 'https://jobs.smartrecruiters.com/RHG/744000146178529-sales-manager',
      jobAd: { sections: { jobDescription: { text: '<p>Lead hotel sales strategy, client relationships, revenue growth, market planning, and commercial team performance in Visakhapatnam.</p>' } } },
    });
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS['radisson hotel group'], 'Radisson Hotel Group');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'Sales Manager');
    assert.equal(result.structuredJobs[0].location, 'Visakhapatnam, AP, India');
    assert.equal(result.structuredJobs[0].apply_link, 'https://jobs.smartrecruiters.com/RHG/744000146178529-sales-manager');
  } finally { globalThis.fetch = originalFetch; }
});

test('Dr Reddy official SmartRecruiters feed keeps only employer-owned Vizag postings', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.includes('/postings?q=')) return Response.json({ content: [
      { id: '744000159366529', location: { city: 'Visakhapatnam', country: 'in' } },
      { id: '744000159366530', location: { city: 'Hyderabad', country: 'in' } },
      { id: '744000159366531', location: { city: 'Visakhapatnam', country: 'in' } },
    ] });
    if (value.endsWith('/744000159366531')) return Response.json({
      id: '744000159366531', name: 'Foreign Employer Role',
      company: { identifier: 'OtherCompany' }, location: { city: 'Visakhapatnam', country: 'in' },
    });
    return Response.json({
      id: '744000159366529', name: 'Team Leader - QA',
      company: { identifier: 'DrReddysLaboratoriesLimited' },
      location: { city: 'Visakhapatnam', country: 'in' },
      postingUrl: 'https://jobs.smartrecruiters.com/DrReddysLaboratoriesLimited/744000159366529-team-leader-qa',
      jobAd: { sections: { jobDescription: { text: '<p>Lead quality assurance operations, continuous improvement, compliance reviews, and cross-functional teams at the Visakhapatnam facility.</p>' } } },
    });
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS["dr. reddy's laboratories"], "Dr. Reddy's Laboratories");
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'Team Leader - QA');
    assert.equal(result.structuredJobs[0].location, 'Visakhapatnam, Andhra Pradesh, India');
    assert.equal(result.structuredJobs[0].apply_link, 'https://jobs.smartrecruiters.com/DrReddysLaboratoriesLimited/744000159366529-team-leader-qa');
  } finally { globalThis.fetch = originalFetch; }
});

test('MEDFAR SmartRecruiters feed validates exact city, employer and description', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const value = String(url);
    assert.match(value, /api\.smartrecruiters\.com\/v1\/companies\/Medfar\/postings/);
    if (value.includes('/postings?q=')) return Response.json({ content: [
      { id: '744000157989454', location: { city: 'Visakhapatnam', country: 'in' } },
      { id: '744000157988585', location: { city: 'Visakhapatnam', country: 'in' } },
      { id: '744000157989455', location: { city: 'Montreal', country: 'ca' } },
      { id: '744000157989456', location: { city: 'Visakhapatnam', country: 'in' } },
    ] });
    const id = value.split('/').pop();
    return Response.json({
      id, name: id === '744000157989454' ? 'Assistant Manager-Coding and Process Excellence' : 'Software Engineer',
      company: { identifier: id === '744000157989456' ? 'OtherCompany' : 'Medfar' },
      location: { city: 'Visakhapatnam', country: 'in' },
      postingUrl: `https://jobs.smartrecruiters.com/Medfar/${id}-sample-role`,
      jobAd: { sections: { jobDescription: { text: '<p>Build and improve clinical software, coordinate with healthcare teams, solve customer problems, and document robust delivery practices in Visakhapatnam.</p>' } } },
    });
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS.medfar, 'MEDFAR');
    assert.equal(result.count, 2);
    assert.equal(result.structuredJobs[0].location, 'Visakhapatnam, Andhra Pradesh, India');
    assert.equal(result.structuredJobs[0].apply_link, 'https://jobs.smartrecruiters.com/Medfar/744000157989454-sample-role');
  } finally { globalThis.fetch = originalFetch; }
});

test('Rotork official SmartRecruiters feed keeps its active Visakhapatnam role', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const value = String(url);
    assert.match(value, /api\.smartrecruiters\.com\/v1\/companies\/Rotork1\/postings/);
    if (value.includes('/postings?q=')) return Response.json({ content: [
      { id: '744000149534300', location: { city: 'Visakhapatnam', country: 'in' } },
      { id: '744000149534301', location: { city: 'Pune', country: 'in' } },
    ] });
    return Response.json({
      id: '744000149534300', name: 'Service Sales Engineer', company: { identifier: 'Rotork1' },
      location: { city: 'Visakhapatnam', country: 'in' },
      postingUrl: 'https://jobs.smartrecruiters.com/Rotork1/744000149534300-service-sales-engineer',
      jobAd: { sections: { jobDescription: { text: '<p>Develop service sales opportunities across Andhra Pradesh, build customer relationships, manage forecasts, and coordinate engineering support from Visakhapatnam.</p>' } } },
    });
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS.rotork, 'Rotork');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'Service Sales Engineer');
    assert.equal(result.structuredJobs[0].apply_link, 'https://jobs.smartrecruiters.com/Rotork1/744000149534300-service-sales-engineer');
  } finally { globalThis.fetch = originalFetch; }
});

test('Amazon city feed requires Visakhapatnam in a posting location', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /search\.json/);
    const job = (title, city, id) => ({
      title, job_path: `/en/jobs/${id}/role`,
      description: '<p>Detailed responsibilities, required experience, technical skills, and qualifications for this official Amazon vacancy.</p>',
      locations: [JSON.stringify({ city, normalizedLocation: `${city}, India` })],
    });
    return Response.json({ jobs: [job('Vizag role', 'Visakhapatnam', 1), job('Other role', 'Hyderabad', 2)] });
  };
  try {
    const result = await scrapeVerifiedVizagPortal(VERIFIED_VIZAG_PORTALS.amazon, 'Amazon');
    assert.equal(result.count, 1);
    assert.equal(result.structuredJobs[0].title, 'Vizag role');
    assert.equal(result.structuredJobs[0].apply_link, 'https://www.amazon.jobs/en/jobs/1/role');
  } finally { globalThis.fetch = originalFetch; }
});

test('Conduent embedded results exclude other cities and retain job apply links', () => {
  const rows = [
    { title: 'Associate', city: 'Visakhapatnam', location: 'Visakhapatnam, India', jobId: '123', descriptionTeaser: 'Customer support with "quoted" text and {braces}.' },
    { title: 'Associate', city: 'Bangalore', jobId: '124' },
  ];
  const result = parseConduentSearchJobs(`script = {"eagerLoadRefineSearch":${JSON.stringify({ data: { jobs: rows } })},"other":{}};`);
  assert.equal(result.length, 1);
  assert.equal(result[0].apply_link, 'https://careers.conduent.com/us/en/job/123/Associate');
  assert.equal(result[0].description, rows[0].descriptionTeaser);
  assert.deepEqual(parseConduentSearchJobs('invalid HTML'), []);
});

test('Company career publication requires explicit Vizag evidence', async () => {
  for (const location of ['', 'India', 'Andhra Pradesh', 'Remote', 'Chennai', 'London']) {
    let writes = 0;
    await assert.rejects(publishSingleCompanyJob({
      company: { name: 'Example', careersUrl: 'https://example.com/careers' },
      job: { title: 'Developer', company: 'Example', location, apply_link: 'https://example.com/job/1' },
      services: { createAdminJob: async () => { writes += 1; } },
    }), /Cannot publish company job/);
    assert.equal(writes, 0);
  }
});

test('Company Career Fetch: URL & Title Key Normalization', async (t) => {
  await t.test('normalizes URLs by trimming and stripping trailing slashes', () => {
    assert.equal(
      normalizeUrlForCompare('https://www.fluentgrid.com/careers///'),
      'https://www.fluentgrid.com/careers'
    );
    assert.equal(normalizeUrlForCompare(''), '');
  });

  await t.test('builds normalized company::title keys', () => {
    assert.equal(
      normalizeCompanyTitleKey('Fluentgrid Limited', 'Senior Java Developer (Vizag)'),
      'fluentgrid limited::senior java developer vizag'
    );
    assert.equal(normalizeCompanyTitleKey('', 'Java Developer'), '');
  });

  await t.test('resolves apply_link with fallback to careersUrl', () => {
    assert.equal(
      resolveCompanyJobApplyLink({ apply_link: 'null' }, 'https://wns.com/careers'),
      'https://wns.com/careers'
    );
    assert.equal(
      resolveCompanyJobApplyLink(
        { apply_link: 'https://wns.com/careers/job-123' },
        'https://wns.com/careers'
      ),
      'https://wns.com/careers/job-123'
    );
  });
});

test('Company Career Fetch: Smart Deduplication for Shared Hub Careers URL', async (t) => {
  const careersUrl = 'https://www.fluentgrid.com/careers/';
  const existingIndex = buildCompanyExistingJobIndex([
    {
      slug: 'existing-role-fluentgrid',
      company: 'Fluentgrid',
      title: 'Existing Role',
      apply_link: 'https://www.fluentgrid.com/careers',
    },
    {
      slug: 'distinct-link-role-fluentgrid',
      company: 'Fluentgrid',
      title: 'Distinct Link Role',
      apply_link: 'https://www.fluentgrid.com/careers/job-999',
    },
  ]);

  await t.test('allows a new role even if its apply_link is the shared company careersUrl', () => {
    const res = shouldSkipCompanyCareerJob(
      {
        title: 'New Angular Developer',
        company: 'Fluentgrid',
        location: 'Visakhapatnam',
        apply_link: 'https://www.fluentgrid.com/careers',
      },
      careersUrl,
      existingIndex
    );
    assert.equal(res.skip, false);
  });

  await t.test('skips a role when the same company + title is already published', () => {
    const res = shouldSkipCompanyCareerJob(
      {
        title: 'Existing Role',
        company: 'Fluentgrid',
        location: 'Visakhapatnam',
        apply_link: 'https://www.fluentgrid.com/careers',
      },
      careersUrl,
      existingIndex
    );
    assert.equal(res.skip, true);
    assert.match(res.reason, /role already published/i);
  });

  await t.test('skips a role when a distinct per-job apply_link is already in database', () => {
    const res = shouldSkipCompanyCareerJob(
      {
        title: 'Renamed Role Same Link',
        company: 'Fluentgrid',
        location: 'Visakhapatnam',
        apply_link: 'https://www.fluentgrid.com/careers/job-999/',
      },
      careersUrl,
      existingIndex
    );
    assert.equal(res.skip, true);
    assert.match(res.reason, /apply link already in database/i);
  });
});

test('Company Career Fetch: End-to-End Single-Company Pipeline Orchestration', async (t) => {
  await t.test('fetches Vizag roles, refines with Gemini SEO, skips duplicates, and publishes', async () => {
    const progressEvents = [];
    const seoCalls = [];
    const publishCalls = [];

    const mockServices = {
      fetchCompanyCareerJobs: async (_token, comp) => {
        assert.equal(comp.name, 'Miracle Software Systems');
        assert.equal(comp.careersUrl, 'https://www.miraclesoft.com/careers');
        return {
          ok: true,
          company: comp.name,
          careers_url: comp.careersUrl,
          scrape_source: 'firecrawl',
          scraped_chars: 14200,
          count: 3,
          jobs: [
            {
              title: 'Full Stack Engineer',
              company: 'Miracle Software Systems',
              location: 'Visakhapatnam',
              category: 'IT & Software',
              job_type: 'Full-time',
              apply_link: 'https://www.miraclesoft.com/careers',
              description: 'Build enterprise cloud apps in Visakhapatnam campus.',
            },
            {
              title: 'DevOps Specialist',
              company: 'Miracle Software Systems',
              location: 'Visakhapatnam',
              category: 'IT & Software',
              job_type: 'Full-time',
              apply_link: 'https://www.miraclesoft.com/careers',
              description: 'Manage Kubernetes clusters in Bhogapuram/Munjeru campus.',
            },
            {
              title: 'Already Published Role',
              company: 'Miracle Software Systems',
              location: 'Visakhapatnam',
              category: 'IT & Software',
              job_type: 'Full-time',
              apply_link: 'https://www.miraclesoft.com/careers',
              description: 'Already exists in DB.',
            },
          ],
        };
      },
      seoOptimizeExternalJob: async (_token, job) => {
        seoCalls.push(job.title);
        const slugBase = job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return {
          ok: true,
          gemini_model: 'gemini-2.5-flash',
          runtime_ms: 850,
          seo_profile: 'jobPosting_v1',
          job: {
            ...job,
            slug: `${slugBase}-miracle-vizag`,
            short_description: `SEO refined summary for ${job.title} in Visakhapatnam.`,
            description: `Detailed SEO refined job description for ${job.title} at Miracle Software Systems in Visakhapatnam.`,
            responsibilities: ['Develop scalable services', 'Collaborate with Vizag engineering team'],
            eligibility: ['B.Tech / M.C.A', 'Strong problem solving skills'],
            skills: ['JavaScript', 'Cloud', 'CI/CD'],
          },
        };
      },
      createAdminJob: async (job, status) => {
        publishCalls.push({ title: job.title, status, slug: job.slug });
        return {
          ...job,
          id: `job-${publishCalls.length}`,
          status,
        };
      },
    };

    const existingJobs = [
      {
        id: 'existing-1',
        slug: 'already-published-role-miracle',
        company: 'Miracle Software Systems',
        title: 'Already Published Role',
        apply_link: 'https://www.miraclesoft.com/careers',
      },
    ];

    const { report, publishedJobs } = await runSingleCompanyCareerPipeline({
      company: {
        name: 'Miracle Software Systems',
        careersUrl: 'https://www.miraclesoft.com/careers',
        category: 'IT & Software',
        location: 'Visakhapatnam',
      },
      accessToken: 'mock.jwt.token',
      existingJobs,
      seoGapMs: 0,
      onProgress: (ev) => progressEvents.push(ev.phase),
      services: mockServices,
    });

    assert.equal(report.stats.fetched, 3);
    assert.equal(report.stats.queued, 2);
    assert.equal(report.stats.seoOk, 2);
    assert.equal(report.stats.published, 2);
    assert.equal(report.stats.skipped, 1);
    assert.equal(publishedJobs.length, 2);
    assert.deepEqual(seoCalls, ['Full Stack Engineer', 'DevOps Specialist']);
    assert.equal(publishCalls.length, 2);
    assert.equal(publishCalls[0].status, 'published');

    // Verify published jobs qualify as Verified Direct Company postings
    for (const pub of publishedJobs) {
      assert.equal(pub.source_name, 'Direct Company Website');
      assert.equal(isDirectPosting(pub), true);
    }

    assert.ok(progressEvents.includes('fetching'));
    assert.ok(progressEvents.includes('seo'));
    assert.ok(progressEvents.includes('publishing'));
    assert.equal(progressEvents.at(-1), 'done');
  });

  await t.test('handles 0 Vizag roles found cleanly', async () => {
    const { report, publishedJobs } = await runSingleCompanyCareerPipeline({
      company: {
        name: 'Tech Mahindra',
        careersUrl: 'https://careers.techmahindra.com',
      },
      accessToken: 'mock.jwt.token',
      existingJobs: [],
      seoGapMs: 0,
      services: {
        fetchCompanyCareerJobs: async () => ({
          ok: true,
          scrape_source: 'firecrawl',
          scraped_chars: 5000,
          jobs: [],
        }),
      },
    });

    assert.equal(report.stats.fetched, 0);
    assert.equal(report.stats.published, 0);
    assert.equal(publishedJobs.length, 0);
  });
});

test('Company Career Fetch: Modular Approval Steps (Pre-Optimize & Post-Optimize)', async (t) => {
  const company = {
    name: 'Pfizer',
    careersUrl: 'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers',
    category: 'Healthcare',
  };

  const existingJobs = [
    {
      id: 'existing-pfizer-1',
      title: 'Old Published Role',
      company: 'Pfizer',
      apply_link: 'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers/job/1',
      slug: 'old-published-role-pfizer',
    },
  ];

  await t.test('fetchAndClassifyCompanyJobs flags duplicates and marks new roles for SEO', async () => {
    const mockServices = {
      fetchCompanyCareerJobs: async () => ({
        ok: true,
        scrape_source: 'workday_cxs',
        scraped_chars: 12000,
        jobs: [
          {
            title: 'Team Leader',
            company: 'Pfizer',
            location: 'Visakhapatnam',
            apply_link: 'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers/job/Team-Leader_4960223',
            description: 'Lead manufacturing shift operations in Vizag.',
          },
          {
            title: 'Old Published Role',
            company: 'Pfizer',
            location: 'Visakhapatnam',
            apply_link: 'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers/job/1',
            description: 'Already exists.',
          },
        ],
      }),
    };

    const res = await fetchAndClassifyCompanyJobs({
      company,
      accessToken: 'test-token',
      existingJobs,
      services: mockServices,
    });

    assert.equal(res.companyName, 'Pfizer');
    assert.equal(res.scrapeSource, 'workday_cxs');
    assert.equal(res.jobs.length, 2);

    const teamLeader = res.jobs.find((j) => j.title === 'Team Leader');
    assert.ok(teamLeader);
    assert.equal(teamLeader.isDuplicate, false);
    assert.equal(teamLeader.selectedForSeo, true);

    const oldRole = res.jobs.find((j) => j.title === 'Old Published Role');
    assert.ok(oldRole);
    assert.equal(oldRole.isDuplicate, true);
    assert.equal(oldRole.selectedForSeo, false);
    assert.match(oldRole.duplicateReason, /already published/i);
  });

  await t.test('optimizeSingleCompanyJob produces SEO refined fields', async () => {
    const rawJob = {
      title: 'Team Leader',
      company: 'Pfizer',
      location: 'Visakhapatnam',
      apply_link: 'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers/job/Team-Leader_4960223',
      description: 'Raw description.',
    };

    const mockServices = {
      seoOptimizeExternalJob: async (_token, j) => ({
        ok: true,
        job: {
          ...j,
          slug: 'team-leader-pfizer-vizag',
          short_description: 'Join Pfizer in Visakhapatnam as Team Leader.',
          description: 'Refined SEO description for Team Leader at Pfizer Vizag.',
          responsibilities: ['Oversee batch manufacturing'],
          skills: ['cGMP', 'Quality Compliance'],
        },
      }),
    };

    const optimized = await optimizeSingleCompanyJob({
      job: rawJob,
      company,
      accessToken: 'test-token',
      services: mockServices,
    });

    assert.equal(optimized.title, 'Team Leader');
    assert.equal(optimized.slug, 'team-leader-pfizer-vizag');
    assert.equal(optimized.seo_optimized, true);
    assert.equal(optimized.source_name, 'Direct Company Website');
    assert.ok(optimized.responsibilities.includes('Oversee batch manufacturing'));
  });

  await t.test('publishSingleCompanyJob inserts to DB and updates existing index', async () => {
    const existingIndex = buildCompanyExistingJobIndex([]);
    const jobToPublish = {
      title: 'Team Leader',
      company: 'Pfizer',
      location: 'Visakhapatnam',
      slug: 'team-leader-pfizer-vizag',
      apply_link: 'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers/job/Team-Leader_4960223',
    };

    let publishCalled = false;
    const mockServices = {
      createAdminJob: async (job, status) => {
        publishCalled = true;
        assert.equal(status, 'published');
        return { ...job, id: 'job-pfizer-1', status };
      },
    };

    const published = await publishSingleCompanyJob({
      job: jobToPublish,
      company,
      existingIndex,
      services: mockServices,
    });

    assert.equal(publishCalled, true);
    assert.equal(published.id, 'job-pfizer-1');
    assert.ok(existingIndex.slugs.has('team-leader-pfizer-vizag'));
    assert.ok(existingIndex.companyTitleKeys.has('pfizer::team leader'));
  });
});

test('Company Career Fetch: Strict Vizag Location Filtering & Cross-Source Deduplication', async (t) => {
  await t.test('cleanCompanyForDedupe removes legal suffixes and noise', () => {
    assert.equal(cleanCompanyForDedupe('Fluentgrid Limited'), 'fluentgrid');
    assert.equal(cleanCompanyForDedupe('Miracle Software Systems Inc.'), 'miracle software');
    assert.equal(cleanCompanyForDedupe('Patra India BPO Services Pvt Ltd'), 'patra india bpo');
  });

  await t.test('cleanTitleForDedupe strips location tags from job titles', () => {
    assert.equal(cleanTitleForDedupe('Senior Java Developer (Vizag)'), 'senior java developer');
    assert.equal(cleanTitleForDedupe('Full Stack Engineer - Visakhapatnam'), 'full stack engineer');
    assert.equal(cleanTitleForDedupe('Data Analyst [Vizag / VSP]'), 'data analyst');
  });

  await t.test('isVizagEligibleJobLocation correctly accepts Vizag and rejects other metros', () => {
    assert.equal(isVizagEligibleJobLocation('Visakhapatnam, Andhra Pradesh'), true);
    assert.equal(isVizagEligibleJobLocation('Rushikonda IT SEZ, Vizag'), true);
    assert.equal(isVizagEligibleJobLocation('Duvvada VSEZ'), true);
    assert.equal(isVizagEligibleJobLocation('Remote - Open to Vizag'), true);

    // Reject non-Vizag metros
    assert.equal(isVizagEligibleJobLocation('Bengaluru, Karnataka'), false);
    assert.equal(isVizagEligibleJobLocation('Hyderabad, Telangana'), false);
    assert.equal(isVizagEligibleJobLocation('Pune, Maharashtra'), false);
    assert.equal(isVizagEligibleJobLocation('Chennai, Tamil Nadu'), false);
    assert.equal(isVizagEligibleJobLocation('Noida, Uttar Pradesh'), false);
  });

  await t.test('strips tracking query params from apply links', () => {
    assert.equal(
      normalizeUrlForCompare('https://fluentgrid.com/careers/job-123?utm_source=linkedin&utm_medium=post'),
      'https://fluentgrid.com/careers/job-123'
    );
    assert.equal(
      normalizeUrlForCompare('https://fluentgrid.com/careers/job-123/?ref=indeed&fbclid=abc123xyz'),
      'https://fluentgrid.com/careers/job-123'
    );
  });

  await t.test('shouldSkipCompanyCareerJob rejects jobs located in other cities', () => {
    const existingIndex = buildCompanyExistingJobIndex([]);
    const res = shouldSkipCompanyCareerJob(
      {
        title: 'Backend Engineer',
        company: 'Fluentgrid',
        location: 'Bengaluru, Karnataka',
        apply_link: 'https://fluentgrid.com/careers/job-456',
      },
      'https://fluentgrid.com/careers',
      existingIndex
    );

    assert.equal(res.skip, true);
    assert.match(res.reason, /outside visakhapatnam/i);
  });

  await t.test('cross-source dedupe: detects duplicate when existing job from Naukri has "Limited" in company name', () => {
    // Simulated existing job imported from Naukri with formal company name and city in title
    const existingIndex = buildCompanyExistingJobIndex([
      {
        slug: 'fluentgrid-limited-senior-java-developer-vizag',
        company: 'Fluentgrid Limited',
        title: 'Senior Java Developer (Vizag)',
        apply_link: 'https://www.naukri.com/job-listings-123',
      },
    ]);

    // Incoming job from direct career portal scrape with clean company name and standard title
    const portalJob = {
      title: 'Senior Java Developer',
      company: 'Fluentgrid',
      location: 'Visakhapatnam',
      apply_link: 'https://fluentgrid.com/careers/java-dev',
    };

    const res = shouldSkipCompanyCareerJob(
      portalJob,
      'https://fluentgrid.com/careers',
      existingIndex
    );

    assert.equal(res.skip, true);
    assert.match(res.reason, /role already published/i);
  });
});

test('Company Career Fetch: Canonical Career Portal URL Resolution for Published Companies', async (t) => {
  await t.test('resolves TCS to dedicated India careers portal', () => {
    assert.equal(
      resolveCanonicalCareerPortalUrl('https://www.tcs.com/careers', 'Tata Consultancy Services'),
      'https://www.tcs.com/careers/india'
    );
  });

  await t.test('resolves Infosys to direct joblist portal', () => {
    assert.equal(
      resolveCanonicalCareerPortalUrl('https://www.infosys.com/careers/', 'Infosys'),
      'https://career.infosys.com/joblist'
    );
  });

  await t.test('resolves Amazon to Visakhapatnam location search portal', () => {
    assert.equal(
      resolveCanonicalCareerPortalUrl('https://www.amazon.jobs', 'Amazon'),
      VERIFIED_VIZAG_PORTALS.amazon
    );
  });

  await t.test('resolves Conduent to the verified Vizag search', () => {
    assert.equal(
      resolveCanonicalCareerPortalUrl('https://careers.conduent.com/us/en', 'Conduent'),
      'https://careers.conduent.com/us/en/search-results?keywords=Visakhapatnam'
    );
  });

  await t.test('resolves Pfizer to Workday CXS JSON API URL', () => {
    assert.match(
      resolveCanonicalCareerPortalUrl('https://www.pfizer.com/about/careers', 'Pfizer'),
      /myworkdayjobs\.com/
    );
  });

  await t.test('resolves 404/broken URLs to verified active career targets', () => {
    assert.equal(
      resolveCanonicalCareerPortalUrl('https://www.acnhealthcare.com/careers', 'ACN Healthcare'),
      'https://www.acnhealthcare.com/Careers.html'
    );
    assert.equal(
      resolveCanonicalCareerPortalUrl('https://arbhasoft.com/careers', 'Arbhasoft'),
      'https://arbhasoft.com/career/'
    );
    assert.equal(
      resolveCanonicalCareerPortalUrl('https://celestinfo.com/careers', 'Celestinfo Software Solutions'),
      'https://celestinfo.com/careers.html'
    );
    assert.equal(
      resolveCanonicalCareerPortalUrl('https://edge3d.in/careers', 'EDGE 3D TECHNOLOGIES Pvt. Ltd.'),
      'https://www.edge3d.io/'
    );
    assert.equal(
      resolveCanonicalCareerPortalUrl('https://urcc.in/careers', 'URC Construction (P) Ltd'),
      'https://www.urcindia.com/'
    );
    assert.equal(
      resolveCanonicalCareerPortalUrl('https://sitarammotors.royalenfield.com', 'SITARAM MOTORS'),
      'https://www.sitarammotors.com/'
    );
    assert.equal(
      resolveCanonicalCareerPortalUrl('https://www.cult.fit/careers', 'cult fit'),
      'https://careers.cult.fit/cult/'
    );
    assert.equal(
      resolveCanonicalCareerPortalUrl('https://homelane.darwinbox.in/careers', 'HomeLane'),
      'https://www.homelane.com/careers'
    );
    assert.equal(
      resolveCanonicalCareerPortalUrl('https://deccanfinechemicals.com/career', 'Deccan Fine Chemicals'),
      'https://www.deccanchemicals.com/'
    );
  });
});

test('Company Career Fetch: Resilient Error Handling (No 502/Unhandled Exceptions)', async (t) => {
  await t.test('fetchAndClassifyCompanyJobs returns message and empty list without throwing when no jobs found', async () => {
    const mockServices = {
      fetchCompanyCareerJobs: async () => ({
        ok: true,
        jobs: [],
        scrape_source: 'direct_portal',
        scraped_chars: 0,
        message: 'No open Visakhapatnam vacancies detected via automated crawl.',
      }),
    };

    const res = await fetchAndClassifyCompanyJobs({
      company: {
        name: 'AU Small Finance Bank',
        careers_url: 'https://www.au.bank.in/careers',
      },
      accessToken: 'test-token',
      services: mockServices,
    });

    assert.equal(res.jobs.length, 0);
    assert.equal(res.companyName, 'AU Small Finance Bank');
    assert.match(res.message, /No open Visakhapatnam vacancies/);
  });
});

