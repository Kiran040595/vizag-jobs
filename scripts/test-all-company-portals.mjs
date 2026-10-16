#!/usr/bin/env node
/**
 * Automated Portal Audit Runner:
 * Tests every published company's careers portal URL, checks connectivity,
 * identifies redirects, verifies ATS endpoints, scans for Visakhapatnam openings,
 * and reports the verified canonical URLs.
 *
 * Usage:
 *   node scripts/test-all-company-portals.mjs
 *   node scripts/test-all-company-portals.mjs --company "Pfizer"
 *   node scripts/test-all-company-portals.mjs --days 180
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyLocalEnv, pipelineConfig } from './lib/pipeline-env.mjs';
import { parseWorkdayPortalUrl, scrapeWorkdayCareerPortal } from '../supabase/functions/fetch-external-jobs/company-careers.ts';

applyLocalEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const targetArg = process.argv.find((_, i, arr) => arr[i - 1] === '--company');
const daysArgIndex = process.argv.indexOf('--days');
const lookbackDays = daysArgIndex !== -1 && process.argv[daysArgIndex + 1]
  ? Math.max(1, parseInt(process.argv[daysArgIndex + 1], 10))
  : 180; // 6 months for test audit

const log = (msg) => console.log(`[audit-portals] ${msg}`);

// Curated list of published directory companies with their baseline URLs
const PUBLISHED_COMPANIES = [
  // IT & Software
  {
    name: 'Fluentgrid Limited',
    careers_url: 'https://fluentgrid.com/careers/',
    category: 'IT & Software',
    location: 'Visakhapatnam, IT SEZ Rushikonda',
  },
  {
    name: 'Miracle Software Systems',
    careers_url: 'https://careers.miraclesoft.com/',
    category: 'IT & Software',
    location: 'Visakhapatnam, Miracle City, Bhogapuram',
  },
  {
    name: 'Conduent',
    careers_url: 'https://careers.conduent.com/us/en',
    category: 'IT & Software',
    location: 'Visakhapatnam, IT SEZ Hill No. 2 Rushikonda',
  },
  {
    name: 'WNS',
    careers_url: 'https://www.wns.com/about-us/careers',
    category: 'IT & Software',
    location: 'Visakhapatnam, IT SEZ Rushikonda',
  },
  {
    name: 'Symbiosys Technologies',
    careers_url: 'https://symbiosystech.com/',
    category: 'IT & Software',
    location: 'Visakhapatnam, IT Park Rushikonda',
  },
  {
    name: 'Patra India',
    careers_url: 'https://careers.patracorp.com/jobs',
    category: 'IT & Software',
    location: 'Visakhapatnam',
  },
  {
    name: 'Tech Mahindra',
    careers_url: 'https://careers.techmahindra.com/',
    category: 'IT & Software',
    location: 'Visakhapatnam, Tech Mahindra SEZ Rushikonda',
  },
  {
    name: 'Tata Consultancy Services',
    careers_url: 'https://www.tcs.com/careers',
    category: 'IT & Software',
    location: 'Visakhapatnam',
  },
  {
    name: 'Infosys',
    careers_url: 'https://www.infosys.com/careers.html',
    category: 'IT & Software',
    location: 'Visakhapatnam, Rushikonda IT Park',
  },
  {
    name: 'Cognizant',
    careers_url: 'https://careers.cognizant.com/india-en/',
    category: 'IT & Software',
    location: 'Visakhapatnam',
  },
  {
    name: 'Mouri Tech',
    careers_url: 'https://www.mouritech.com/careers/',
    category: 'IT & Software',
    location: 'Visakhapatnam',
  },
  {
    name: 'Sails Software',
    careers_url: 'https://sailssoftware.com/careers/',
    category: 'IT & Software',
    location: 'Visakhapatnam',
  },
  {
    name: 'iMerit',
    careers_url: 'https://imerit.ai/careers/',
    category: 'IT & Software',
    location: 'Visakhapatnam',
  },
  {
    name: 'XTGlobal',
    careers_url: 'https://xtglobal.com/careers/',
    category: 'IT & Software',
    location: 'Visakhapatnam',
  },
  {
    name: 'Innocito',
    careers_url: 'https://innocito.com/careers',
    category: 'IT & Software',
    location: 'Visakhapatnam',
  },

  // Healthcare & Pharma
  {
    name: 'Pfizer',
    careers_url:
      'https://pfizer.wd1.myworkdayjobs.com/PfizerCareers?locations=e2d3979e3af10195da701f58076c648f&startDate=a6e09e1f3296100014ae1d545f3c0098',
    category: 'Healthcare',
    location: 'Visakhapatnam, Jawaharlal Nehru Pharma City, Parawada',
  },
  {
    name: 'Hetero',
    careers_url: 'https://www.heterohealthcare.com/careers',
    category: 'Healthcare',
    location: 'Visakhapatnam',
  },
  {
    name: 'Granules India',
    careers_url: 'https://careers.mygranules.com/',
    category: 'Healthcare',
    location: 'Visakhapatnam',
  },
  {
    name: 'Amneal Pharmaceuticals',
    careers_url: 'https://amneal.com/careers/',
    category: 'Healthcare',
    location: 'Visakhapatnam',
  },
  {
    name: 'Biocon',
    careers_url: 'https://careers.biocon.com/',
    category: 'Healthcare',
    location: 'Visakhapatnam',
  },
  {
    name: 'Eisai Pharmaceuticals India',
    careers_url: 'https://www.eisai.co.in/',
    category: 'Healthcare',
    location: 'Visakhapatnam, Ramky Pharma City, Parawada',
  },
  {
    name: 'Pulsus Healthtech',
    careers_url: 'https://www.pulsus.com/careers',
    category: 'Healthcare',
    location: 'Visakhapatnam',
  },
  {
    name: 'Apollo Hospitals',
    careers_url: 'https://www.apollohospitals.com/corporate/careers/',
    category: 'Healthcare',
    location: 'Visakhapatnam, Waltair Main Road',
  },
  {
    name: 'Care Hospitals',
    careers_url: 'https://www.carehospitals.com/careers',
    category: 'Healthcare',
    location: 'Visakhapatnam, Ramnagar',
  },
  {
    name: 'Medicover Hospitals',
    careers_url: 'https://www.medicoverhospitals.in/careers/',
    category: 'Healthcare',
    location: 'Visakhapatnam, MVP Colony',
  },
  {
    name: 'MGM Healthcare',
    careers_url: 'https://mgmsevenhills.in/careers/',
    category: 'Healthcare',
    location: 'Visakhapatnam, Seven Hills, Waltair',
  },
  {
    name: 'Aspiro Pharma',
    careers_url: 'https://aspiropharma.com/careers.php',
    category: 'Healthcare',
    location: 'Visakhapatnam, Pharma City',
  },
  {
    name: 'Deccan Fine Chemicals',
    careers_url: 'https://deccanfinechemicals.com/career',
    category: 'Healthcare',
    location: 'Visakhapatnam, Payakaraopeta',
  },

  // Manufacturing, Engineering & Infrastructure
  {
    name: 'Adani Group',
    careers_url: 'https://careers.adani.com',
    category: 'Manufacturing',
    location: 'Visakhapatnam Port',
  },
  {
    name: 'Asian Paints',
    careers_url: 'https://careers.asianpaints.com/',
    category: 'Manufacturing',
    location: 'Visakhapatnam',
  },
  {
    name: 'Brandix',
    careers_url: 'https://careers.brandix.com/',
    category: 'Manufacturing',
    location: 'Visakhapatnam, Brandix India Apparel City, Atchutapuram',
  },
  {
    name: 'Foxconn',
    careers_url: 'https://recruit.foxconn.com/isite-web-tw/',
    category: 'Manufacturing',
    location: 'Visakhapatnam',
  },
  {
    name: 'GMR Group',
    careers_url: 'https://careers.gmrgroup.in/',
    category: 'Manufacturing',
    location: 'Visakhapatnam / Bhogapuram Airport',
  },
  {
    name: 'Indus Towers',
    careers_url: 'https://www.industowers.com/careers/',
    category: 'Manufacturing',
    location: 'Visakhapatnam',
  },
  {
    name: 'KONE',
    careers_url: 'https://www.kone.in/about-kone/careers.html',
    category: 'Manufacturing',
    location: 'Visakhapatnam',
  },

  // Education & Academics
  {
    name: 'GITAM Deemed University',
    careers_url: 'https://careers.gitam.edu/',
    category: 'Education',
    location: 'Visakhapatnam, Rushikonda',
  },
  {
    name: 'DA VINCI INTERNATIONAL SCHOOL',
    careers_url: 'https://davincischool.in/contact.html',
    category: 'Education',
    location: 'Visakhapatnam',
  },
  {
    name: 'Kiya World School',
    careers_url: 'https://kiyaworldschool.com',
    category: 'Education',
    location: 'Visakhapatnam',
  },
  {
    name: 'Mdn Edify Education',
    careers_url: 'https://edifyschools.com/career/',
    category: 'Education',
    location: 'Visakhapatnam',
  },

  // Banking & Financial Services
  {
    name: 'AU Small Finance Bank',
    careers_url: 'https://www.au.bank.in/careers',
    category: 'Banking & Finance',
    location: 'Visakhapatnam',
  },
  {
    name: 'Bajaj Finance',
    careers_url: 'https://www.bajajfinservmarkets.in/careers',
    category: 'Banking & Finance',
    location: 'Visakhapatnam',
  },
];

const VIZAG_RE = /\b(visakhapatnam|vishakhapatnam|vizag|rushikonda|duvvada|gajuwaka|gambheeram|parawada|sheela\s*nagar|madhurawada|pendurthi|anakapalle|atchutapuram|vsez)\b/i;

async function testSinglePortal(comp) {
  const result = {
    name: comp.name,
    category: comp.category,
    originalUrl: comp.careers_url,
    effectiveUrl: comp.careers_url,
    httpStatus: null,
    redirected: false,
    contentLength: 0,
    isWorkday: false,
    workdayJobsCount: 0,
    hasVizagMention: false,
    sampleJobs: [],
    status: 'UNKNOWN', // 'OK_WITH_JOBS' | 'ACCESSIBLE_NO_VIZAG' | 'REDIRECTED_UPDATED' | 'BLOCKED_OR_ERROR'
    notes: '',
  };

  const workdayParsed = parseWorkdayPortalUrl(comp.careers_url);
  if (workdayParsed) {
    result.isWorkday = true;
    try {
      const wd = await scrapeWorkdayCareerPortal(comp.careers_url);
      if (wd && wd.count > 0) {
        result.httpStatus = 200;
        result.workdayJobsCount = wd.count;
        result.hasVizagMention = true;
        result.sampleJobs = (wd.structuredJobs || []).slice(0, 3);
        result.status = 'OK_WITH_JOBS';
        result.notes = `Workday CXS verified: ${wd.count} active Vizag posting(s) found.`;
        return result;
      }
    } catch (wdErr) {
      result.notes = `Workday check warning: ${wdErr.message}`;
    }
  }

  // Standard HTTP check with redirect tracking
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    const res = await fetch(comp.careers_url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    result.httpStatus = res.status;
    result.effectiveUrl = res.url;
    result.redirected = res.redirected && res.url !== comp.careers_url;

    if (!res.ok) {
      result.status = 'BLOCKED_OR_ERROR';
      result.notes = `HTTP ${res.status} returned by server.`;
      return result;
    }

    const text = await res.text();
    result.contentLength = text.length;

    // Check for Vizag keywords
    if (VIZAG_RE.test(text)) {
      result.hasVizagMention = true;
      result.status = 'OK_WITH_JOBS';
      result.notes = `Accessible (${text.length} bytes), Vizag locations mentioned.`;
    } else {
      result.status = 'ACCESSIBLE_NO_VIZAG';
      result.notes = `Accessible (${text.length} bytes), no explicit Vizag keyword in HTML body.`;
    }

    if (result.redirected) {
      result.notes += ` (Redirected to: ${result.effectiveUrl})`;
    }
  } catch (err) {
    result.status = 'BLOCKED_OR_ERROR';
    result.notes = `Fetch failed: ${err.message}`;
  } finally {
    clearTimeout(timer);
  }

  return result;
}

async function main() {
  log(`Starting Portal Verification & URL Audit (Lookback: ${lookbackDays} days)...`);

  const list = targetArg
    ? PUBLISHED_COMPANIES.filter((c) => c.name.toLowerCase().includes(targetArg.toLowerCase()))
    : PUBLISHED_COMPANIES;

  log(`Auditing ${list.length} company career portals...\n`);

  const results = [];
  for (let i = 0; i < list.length; i += 1) {
    const comp = list[i];
    process.stdout.write(`[${i + 1}/${list.length}] Testing ${comp.name.padEnd(30, ' ')} ... `);
    const res = await testSinglePortal(comp);
    results.push(res);
    console.log(`[${res.status}] (HTTP ${res.httpStatus || 'ERR'}, Vizag: ${res.hasVizagMention ? 'YES' : 'NO'})`);
  }

  // Print Summary Table
  console.log('\n' + '='.repeat(80));
  console.log('AUDIT SUMMARY TABLE:');
  console.log('='.repeat(80));
  for (const r of results) {
    const symbol = r.status === 'OK_WITH_JOBS' ? '✅' : r.status === 'ACCESSIBLE_NO_VIZAG' ? 'ℹ️' : '❌';
    console.log(`${symbol} ${r.name.padEnd(32)} | Status: ${r.status.padEnd(20)} | URL: ${r.effectiveUrl}`);
    if (r.notes) console.log(`   └─ ${r.notes}`);
    if (r.sampleJobs.length > 0) {
      for (const sj of r.sampleJobs) {
        console.log(`      * Job: ${sj.title} (${sj.location}) -> ${sj.apply_link}`);
      }
    }
  }

  const reportPath = path.join(projectRoot, `company-portals-audit-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  log(`\nDetailed audit results saved to: ${reportPath}`);
}

main().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
