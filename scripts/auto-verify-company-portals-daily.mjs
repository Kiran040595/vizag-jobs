#!/usr/bin/env node
/**
 * Daily Automated Strict Vizag Career Portal Verification & Publish Pipeline.
 *
 * Picks up to N unapproved companies (default: 10) with a website, probes for a
 * strict Visakhapatnam-filtered career URL, verifies live Vizag job postings,
 * approves qualifying portals in Supabase, and updates QA/verification docs.
 *
 * Usage:
 *   node scripts/auto-verify-company-portals-daily.mjs
 *   node scripts/auto-verify-company-portals-daily.mjs --limit 10 --dry-run
 *   node scripts/auto-verify-company-portals-daily.mjs --force
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { applyLocalEnv, pipelineConfig } from './lib/pipeline-env.mjs';
import { discoverCompanyCareerPortal } from './lib/career-portal-finder.mjs';
import {
  VERIFIED_VIZAG_PORTALS,
  scrapeVerifiedVizagPortal,
} from '../supabase/functions/fetch-external-jobs/company-careers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

applyLocalEnv();

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');
const limitArg = (() => {
  const idx = args.indexOf('--limit');
  const val = idx !== -1 ? Number.parseInt(args[idx + 1], 10) : 10;
  return Number.isFinite(val) && val > 0 ? Math.min(val, 25) : 10;
})();

const STATE_PATH = path.join(projectRoot, 'logs', 'daily-portal-verify-state.json');
const VERIFICATION_DOC = path.join(projectRoot, 'docs', 'qa', '2026-11-01', 'company-career-verification.md');
const TRACKER_DOC = path.join(projectRoot, 'docs', 'SCREEN_FUNCTIONALITY_TEST_TRACKER.md');

const SUPABASE_URL = pipelineConfig.supabaseUrl;
const SUPABASE_KEY = pipelineConfig.supabaseServiceRoleKey || pipelineConfig.supabaseAnonKey;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY) are required.');
  process.exit(1);
}

const log = (msg) => console.log(`[daily-portal-verify] ${msg}`);
const todayStr = () => new Date().toISOString().slice(0, 10);

function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    }
  } catch { /* ignore */ }
  return { lastRunDate: null, attempted: {} };
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

/**
 * Resilient Supabase REST request: uses fetch, falling back to curl.exe on Windows
 * when Node OpenSSL hits TLS renegotiation reset against Cloudflare/Supabase.
 */
async function supabaseRequest(method, pathAndQuery, body = null) {
  const url = `${SUPABASE_URL}/rest/v1/${pathAndQuery}`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Supabase HTTP ${res.status}: ${await res.text()}`);
    return await res.json();
  } catch (err) {
    const curlArgs = [
      '-sS',
      '-X', method,
      '-H', `apikey: ${SUPABASE_KEY}`,
      '-H', `Authorization: Bearer ${SUPABASE_KEY}`,
      '-H', 'Content-Type: application/json',
      '-H', 'Prefer: return=representation',
    ];
    if (body) {
      curlArgs.push('-d', JSON.stringify(body));
    }
    curlArgs.push(url);
    const out = execFileSync('curl.exe', curlArgs, { encoding: 'utf8', timeout: 15000 });
    return JSON.parse(out || '[]');
  }
}

async function fetchHtml(url, timeoutMs = 12000) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/json,*/*',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { ok: res.ok, status: res.status, url: res.url, text: await res.text() };
}

/**
 * Probes a candidate career portal for a strict Visakhapatnam-filtered URL
 * and live Vizag vacancy evidence.
 */
async function verifyStrictVizagPortal(company) {
  const knownUrl = VERIFIED_VIZAG_PORTALS[company.name.trim().toLowerCase()];
  if (knownUrl) {
    try {
      const scraped = await scrapeVerifiedVizagPortal(knownUrl, company.name);
      if (scraped && scraped.count > 0) {
        return {
          verified: true,
          careersUrl: knownUrl,
          jobCount: scraped.count,
          evidence: `Existing native extractor verified ${scraped.count} active Vizag role(s) on ${knownUrl}.`,
        };
      }
    } catch { /* fall through to discovery */ }
  }

  let candidateUrl = (company.careers_url || '').trim();
  if (!candidateUrl || candidateUrl === company.website) {
    const discovered = await discoverCompanyCareerPortal(company.website);
    if (discovered?.success && discovered.careersUrl) {
      candidateUrl = discovered.careersUrl;
    }
  }
  if (!candidateUrl) {
    return { verified: false, reason: 'No career portal URL found' };
  }

  let parsed;
  try {
    parsed = new URL(candidateUrl);
  } catch {
    return { verified: false, reason: `Invalid URL: ${candidateUrl}` };
  }

  // 1. SmartRecruiters: careers.smartrecruiters.com/<employer>
  if (parsed.hostname === 'careers.smartrecruiters.com') {
    const employer = parsed.pathname.split('/').filter(Boolean)[0];
    if (employer) {
      const apiUrl = `https://api.smartrecruiters.com/v1/companies/${employer}/postings?q=Visakhapatnam&limit=100`;
      const apiRes = await fetchHtml(apiUrl);
      if (apiRes.ok) {
        const data = JSON.parse(apiRes.text);
        const vizagRows = (data.content || []).filter((r) =>
          /^visakhapatnam|vishakhapatnam$/i.test(r.location?.city || '')
        );
        if (vizagRows.length > 0) {
          const strictUrl = `https://careers.smartrecruiters.com/${employer}?search=Visakhapatnam`;
          return {
            verified: true,
            careersUrl: strictUrl,
            jobCount: vizagRows.length,
            evidence: `SmartRecruiters API verified ${vizagRows.length} active exact-city Visakhapatnam posting(s) for ${employer}.`,
          };
        }
      }
    }
  }

  // 2. Lever: jobs.lever.co/<company>
  if (parsed.hostname === 'jobs.lever.co') {
    const slug = parsed.pathname.split('/').filter(Boolean)[0];
    if (slug) {
      const apiRes = await fetchHtml(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      if (apiRes.ok) {
        const postings = JSON.parse(apiRes.text);
        const vizagRows = (Array.isArray(postings) ? postings : []).filter((p) =>
          /\b(visakhapatnam|vishakhapatnam|vizag)\b/i.test(p.categories?.location || '')
        );
        if (vizagRows.length > 0) {
          const strictUrl = `https://jobs.lever.co/${slug}?by=location&location=Vizag%2C+Andhra+Pradesh`;
          return {
            verified: true,
            careersUrl: strictUrl,
            jobCount: vizagRows.length,
            evidence: `Lever API verified ${vizagRows.length} active Visakhapatnam/Vizag posting(s).`,
          };
        }
      }
    }
  }

  // 3. WP Job Openings (?job__location_spec=visakhapatnam)
  const page = await fetchHtml(candidateUrl);
  if (!page.ok) {
    return { verified: false, reason: `HTTP ${page.status} on ${candidateUrl}` };
  }

  if (page.text.includes('awsm-job-openings') || page.text.includes('awsm_job_spec[job-location]')) {
    const wpUrl = new URL(page.url);
    wpUrl.searchParams.set('job__location_spec', 'visakhapatnam');
    const filtered = await fetchHtml(wpUrl.toString());
    if (filtered.ok) {
      const hasVizag = /\b(visakhapatnam|vishakhapatnam|vizag)\b/i.test(filtered.text);
      const jobCards = (filtered.text.match(/awsm-job-listing-item|awsm-grid-item/gi) || []).length;
      if (hasVizag && jobCards > 0) {
        return {
          verified: true,
          careersUrl: wpUrl.toString(),
          jobCount: jobCards,
          evidence: `WP Job Openings ?job__location_spec=visakhapatnam returned ${jobCards} Visakhapatnam listing(s).`,
        };
      }
    }
  }

  // 4. SuccessFactors (/search/)
  if (page.text.includes('locationsearch') || /successfactors|rmk/i.test(page.text)) {
    const sfUrl = new URL('/search/?q=&locationsearch=Visakhapatnam', page.url).toString();
    const sfRes = await fetchHtml(sfUrl);
    if (sfRes.ok && /class=["'][^"']*data-row/i.test(sfRes.text) && /\bvisakhapatnam\b/i.test(sfRes.text)) {
      const rows = (sfRes.text.match(/class=["'][^"']*data-row/gi) || []).length;
      return {
        verified: true,
        careersUrl: sfUrl,
        jobCount: rows,
        evidence: `SuccessFactors locationsearch=Visakhapatnam returned ${rows} active row(s).`,
      };
    }
  }

  return { verified: false, reason: 'No strict Vizag-filtered URL or active Vizag postings confirmed' };
}

function appendVerificationDocs(verifiedList) {
  if (verifiedList.length === 0) return;
  const date = todayStr();

  if (fs.existsSync(VERIFICATION_DOC)) {
    let doc = fs.readFileSync(VERIFICATION_DOC, 'utf8');
    const marker = '\nFluentgrid vacancies are available in Vizag';
    const rows = verifiedList
      .map((item) => `| ${item.name} | ${item.careersUrl} | Automated daily check (${date}): ${item.evidence} |`)
      .join('\n');
    if (doc.includes(marker)) {
      doc = doc.replace(marker, `\n${rows}\n${marker}`);
    } else {
      doc += `\n${rows}\n`;
    }
    fs.writeFileSync(VERIFICATION_DOC, doc);
  }

  if (fs.existsSync(TRACKER_DOC)) {
    let tracker = fs.readFileSync(TRACKER_DOC, 'utf8');
    const summaryLines = verifiedList
      .map((v) => `  - **${v.name}**: \`${v.careersUrl}\` (${v.evidence})`)
      .join('\n');
    tracker += `\n## QA-${date}-Daily-Verified-Portals\n\n- Automated daily verification batch checked and approved ${verifiedList.length} company portal(s) with strict Visakhapatnam URLs:\n${summaryLines}\n- Functional E2E: Not tested. Mobile UI: Not tested. Live HTTP/API verification recorded separately.\n`;
    fs.writeFileSync(TRACKER_DOC, tracker);
  }
}

async function run() {
  const state = loadState();
  const today = todayStr();

  if (!isForce && !isDryRun && state.lastRunDate === today) {
    log(`Already ran today (${today}). Use --force to run again.`);
    return;
  }

  log(`Starting daily verification batch (limit=${limitArg}, dryRun=${isDryRun})...`);

  // Load unapproved companies with a website
  const candidates = await supabaseRequest(
    'GET',
    'companies?select=id,name,website,careers_url,category,is_directory_approved&is_directory_approved=eq.false&website=not.is.null&limit=500'
  );

  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const eligible = candidates
    .filter((c) => {
      if (!c.website || c.website.includes('lnkd.in')) return false;
      const lastAttempt = state.attempted?.[c.id];
      if (!isForce && lastAttempt && (now - lastAttempt.at) < fourteenDaysMs) return false;
      return true;
    })
    .sort((a, b) => {
      const aIt = /it|software|tech/i.test(a.category || '') ? 0 : 1;
      const bIt = /it|software|tech/i.test(b.category || '') ? 0 : 1;
      return aIt - bIt;
    })
    .slice(0, limitArg);

  log(`Selected ${eligible.length} candidate company(ies) out of ${candidates.length} unapproved.`);

  const verifiedList = [];
  for (let i = 0; i < eligible.length; i++) {
    const comp = eligible[i];
    log(`[${i + 1}/${eligible.length}] Checking ${comp.name} (${comp.website})...`);
    try {
      const result = await verifyStrictVizagPortal(comp);
      state.attempted[comp.id] = {
        name: comp.name,
        at: Date.now(),
        verified: result.verified,
        reason: result.reason || result.evidence,
      };

      if (result.verified) {
        log(`  ✅ VERIFIED: ${result.careersUrl} (${result.jobCount} jobs)`);
        if (!isDryRun) {
          // Two-step update to satisfy guard_company_directory_careers trigger
          await supabaseRequest('PATCH', `companies?id=eq.${comp.id}`, {
            careers_url: result.careersUrl,
          });
          await supabaseRequest('PATCH', `companies?id=eq.${comp.id}`, {
            is_directory_approved: true,
            is_active_for_scrape: true,
          });
        }
        verifiedList.push({
          id: comp.id,
          name: comp.name,
          careersUrl: result.careersUrl,
          evidence: result.evidence,
        });
      } else {
        log(`  ⏭️ Skipped: ${result.reason}`);
      }
    } catch (err) {
      log(`  ⚠️ Error: ${err.message}`);
      state.attempted[comp.id] = {
        name: comp.name,
        at: Date.now(),
        verified: false,
        reason: err.message,
      };
    }
  }

  if (!isDryRun) {
    state.lastRunDate = today;
    saveState(state);
    appendVerificationDocs(verifiedList);
  }

  log(`Batch complete: ${verifiedList.length} verified and approved.`);
}

run().catch((err) => {
  console.error('[daily-portal-verify] Fatal error:', err);
  process.exit(1);
});
