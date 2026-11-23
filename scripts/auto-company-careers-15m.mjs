#!/usr/bin/env node
/**
 * Automated Verified Company Career Fetcher for VizagJobs
 *
 * Rules:
 * - Runs during active windows: 6:00 AM - 12:00 PM & 5:00 PM - 10:00 PM IST (unless --force)
 * - Fetches verified career companies from Supabase (up to 3 per scheduled run)
 * - 7-day cooldown: Skips companies fetched within the last 7 days
 * - 30-day age limit: Drops postings older than 30 days
 * - Strict deduplication: Drops duplicate slugs, apply links, or role titles
 * - Rewrites job with clean SEO title, description, markdown, and JSON-LD
 * - Posts directly to Supabase jobs table
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getEligibleVerifiedCompanies,
  markCompanyLastFetched,
  fetchExistingJobKeysLinked,
  insertJobDirect,
} from './lib/linked-db.mjs';
import {
  scrapeVerifiedVizagPortal,
} from '../supabase/functions/fetch-external-jobs/company-careers.ts';
import {
  cleanCompanyForDedupe,
  cleanTitleForDedupe,
  normalizeCompanyTitleKey,
  normalizeUrlForCompare,
} from '../src/lib/companyCareerFetchAutomation.js';
import { rewriteJobForVizag } from './lib/job-rewriter.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const log = (msg) => console.log(`[career-fetch] ${msg}`);

function isWithinActiveWindows() {
  // IST is UTC + 5:30
  const nowUtc = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(nowUtc.getTime() + istOffsetMs);
  const hour = istTime.getUTCHours(); // Hour in IST

  const isMorning = hour >= 6 && hour < 12;
  const isEvening = hour >= 17 && hour < 22;

  return { active: isMorning || isEvening, hour, timeStr: istTime.toISOString().slice(11, 16) };
}

function normalizeTitleForCompare(title, companyName) {
  let t = String(title || '').toLowerCase();
  if (companyName) {
    const compWords = companyName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    for (const w of compWords) {
      t = t.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
    }
  }
  return t
    .replace(/\b(visakhapatnam|vishakhapatnam|vizag|vsp|andhra\s+pradesh|india)\b/gi, ' ')
    .replace(/[()[\]{}|/\\-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isJobOlderThan30Days(job) {
  if (!job.posted_at) return false;
  const date = new Date(job.posted_at);
  if (isNaN(date.getTime())) return false;
  const ageMs = Date.now() - date.getTime();
  const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
  return ageMs > maxAgeMs;
}

async function processCompany(company) {
  log(`\n--- Processing company: ${company.name} ---`);
  log(`Careers URL: ${company.verified_careers_url}`);
  log(`Last fetched: ${company.last_fetched_at || 'Never'}`);

  // Fetch existing job keys for deduplication (only for this company to save egress)
  log(`Loading existing job keys for ${company.name} deduplication...`);
  const existing = fetchExistingJobKeysLinked(company.name);
  log(`Loaded ${existing.slugs.size} existing slugs and ${existing.companyTitleKeys.size} company-title keys.`);

  // Scrape company portal
  let extractedJobs = [];
  try {
    log(`Scraping verified portal for ${company.name}...`);
    const result = await scrapeVerifiedVizagPortal(company.verified_careers_url, company.name);
    if (result && Array.isArray(result.structuredJobs)) {
      extractedJobs = result.structuredJobs;
      log(`Extracted ${extractedJobs.length} structured job(s) from ${result.source}.`);
    } else {
      log(`No structured jobs returned for ${company.name}.`);
    }
  } catch (scrapeErr) {
    log(`Scrape warning: ${scrapeErr.message}`);
  }

  const report = {
    company: company.name,
    careersUrl: company.verified_careers_url,
    timestamp: new Date().toISOString(),
    jobsFound: extractedJobs.length,
    published: 0,
    skipped: 0,
    details: [],
  };

  // Process and filter jobs
  for (const rawJob of extractedJobs) {
    const title = String(rawJob.title || '').trim();
    if (!title) {
      report.skipped++;
      report.details.push({ title: 'Untitled', reason: 'Missing title' });
      continue;
    }

    // Check age limit (30 days)
    if (isJobOlderThan30Days(rawJob)) {
      log(`  [SKIP] "${title}" -> Posted > 30 days ago`);
      report.skipped++;
      report.details.push({ title, reason: 'Job older than 30 days' });
      continue;
    }

    // Deduplication checks
    const ctKey = normalizeCompanyTitleKey(company.name, title);
    const cleanComp = cleanCompanyForDedupe(company.name);
    const cleanTit = cleanTitleForDedupe(title);
    const canonicalKey = cleanComp && cleanTit ? `${cleanComp}::${cleanTit}` : '';
    const normTit = normalizeTitleForCompare(title, company.name);
    const normKey = cleanComp && normTit ? `${cleanComp}::${normTit}` : '';

    if (
      (ctKey && existing.companyTitleKeys.has(ctKey)) ||
      (canonicalKey && existing.companyTitleKeys.has(canonicalKey)) ||
      (normKey && existing.companyTitleKeys.has(normKey))
    ) {
      log(`  [SKIP] "${title}" -> Role already published for this company`);
      report.skipped++;
      report.details.push({ title, reason: 'Duplicate company title key' });
      continue;
    }

    const applyNorm = normalizeUrlForCompare(rawJob.apply_link);
    if (applyNorm && existing.applyLinks.has(applyNorm)) {
      log(`  [SKIP] "${title}" -> Apply link already in database`);
      report.skipped++;
      report.details.push({ title, reason: 'Duplicate apply link' });
      continue;
    }

    // Rewrite the job
    log(`  [REWRITING] "${title}"...`);
    const rewritten = rewriteJobForVizag(rawJob, company);

    // Slug deduplication check
    if (existing.slugs.has(rewritten.slug.toLowerCase())) {
      rewritten.slug = `${rewritten.slug}-${Date.now().toString(36).slice(-4)}`;
    }

    // Post the job to the database
    try {
      log(`  [POSTING] "${rewritten.title}" (${rewritten.slug})...`);
      const inserted = insertJobDirect(rewritten);
      log(`  ✅ [PUBLISHED] ID: ${inserted.id} -> /jobs/${inserted.slug}`);

      existing.slugs.add(rewritten.slug.toLowerCase());
      if (applyNorm) existing.applyLinks.add(applyNorm);
      if (ctKey) existing.companyTitleKeys.add(ctKey);
      if (canonicalKey) existing.companyTitleKeys.add(canonicalKey);

      report.published++;
      report.details.push({ title: rewritten.title, slug: rewritten.slug, status: 'published' });
    } catch (insertErr) {
      log(`  ❌ [ERROR INSERTING] "${title}": ${insertErr.message}`);
      report.skipped++;
      report.details.push({ title, error: insertErr.message });
    }
  }

  // Lock the company for 7 days
  log(`Updating ${company.name} last_fetched_at to enforce 7-day cooldown...`);
  markCompanyLastFetched(company.id);
  log(`✅ ${company.name} cooldown set for next 7 days.`);

  // Write log report
  const logsDir = path.join(projectRoot, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const logFileName = `career-fetch-${Date.now()}.json`;
  fs.writeFileSync(path.join(logsDir, logFileName), JSON.stringify(report, null, 2), 'utf8');

  log(`SUMMARY for ${company.name}: Found: ${report.jobsFound}, Published: ${report.published}, Skipped: ${report.skipped}`);
}

async function main() {
  const isForce = process.argv.includes('--force');
  const windowCheck = isWithinActiveWindows();

  log(`Execution at ${windowCheck.timeStr} IST (Active Window: ${windowCheck.active}, Force: ${isForce})`);

  if (!windowCheck.active && !isForce) {
    log(`Outside active operating windows (06:00-12:00 & 17:00-22:00 IST). Exiting quietly.`);
    return;
  }

  // Query next eligible verified companies (up to 3 per scheduled run)
  const batchSize = 3;
  log(`Checking for eligible verified companies (batch size: ${batchSize}, cooldown: 7 days)...`);
  const eligible = getEligibleVerifiedCompanies(batchSize);

  if (!eligible || eligible.length === 0) {
    log('No companies currently due for a fetch. All verified companies have been checked within the last 7 days.');
    return;
  }

  log(`Found ${eligible.length} eligible company(ies) due for fetch: ${eligible.map(c => c.name).join(', ')}`);

  for (const company of eligible) {
    await processCompany(company);
  }

  log(`\nAll scheduled companies in this run completed successfully.`);
}

main().catch((err) => {
  console.error('[career-fetch] Fatal error:', err);
  process.exit(1);
});
