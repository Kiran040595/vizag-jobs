#!/usr/bin/env node
/**
 * Automated pipeline for direct company career pages in Visakhapatnam.
 *
 * Scrapes curated company career sites, parses job openings with Gemini 2.0 Flash,
 * filters for Visakhapatnam/Vizag roles, and publishes them to Supabase.
 *
 * Usage:
 *   node scripts/auto-company-careers.mjs
 *   node scripts/auto-company-careers.mjs --dry-run
 *   node scripts/auto-company-careers.mjs --company "Fluentgrid"
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyLocalEnv, pipelineConfig } from './lib/pipeline-env.mjs';
import {
  fetchExistingJobKeys,
  getJobDedupeKey,
  publishJob,
  shouldSkipJob,
} from './lib/pipeline-publish.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

applyLocalEnv();

const log = (msg) => console.log(`[auto-company-careers] ${msg}`);

function getGeminiApiKeys() {
  const pool = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEYS,
    process.env.VITE_GEMINI_API_KEY,
  ]
    .filter(Boolean)
    .flatMap((entry) => entry.split(/[,;\n]/))
    .map((k) => k.trim())
    .filter((k) => k.length > 5);

  return [...new Set(pool)];
}

function getFirecrawlApiKey() {
  const pool = [
    process.env.FIRECRAWL_API_KEY,
    process.env.FIRECRAWL_API_KEYS,
    process.env.FIRECRAWL_API_KEY_VIZAG_IT,
  ]
    .filter(Boolean)
    .flatMap((entry) => entry.split(/[,;\n]/))
    .map((k) => k.trim())
    .filter((k) => k.length > 5);

  return pool[0] || null;
}

const EXTRACT_JOBS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    jobs: {
      type: 'ARRAY',
      description: 'List of jobs located in or open to Visakhapatnam / Vizag.',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          company: { type: 'STRING' },
          location: { type: 'STRING', description: 'Visakhapatnam or remote with Vizag mention' },
          category: { type: 'STRING' },
          job_type: { type: 'STRING', enum: ['Full-Time', 'Part-Time', 'Internship', 'Contract'] },
          work_mode: { type: 'STRING', enum: ['On-site', 'Remote', 'Hybrid'] },
          experience: { type: 'STRING' },
          is_fresher: { type: 'BOOLEAN' },
          salary: { type: 'STRING' },
          apply_link: { type: 'STRING' },
          short_description: { type: 'STRING' },
          description: { type: 'STRING' },
          responsibilities: { type: 'ARRAY', items: { type: 'STRING' } },
          eligibility: { type: 'ARRAY', items: { type: 'STRING' } },
          skills: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['title', 'apply_link'],
      },
    },
  },
  required: ['jobs'],
};

/** Simple HTML-to-text converter preserving links */
function htmlToCleanMarkdown(html, baseUrl) {
  if (!html) return '';
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Convert hyperlinks
  clean = clean.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const linkText = text.replace(/<[^>]+>/g, '').trim();
    if (!linkText) return '';
    try {
      const fullUrl = new URL(href, baseUrl).toString();
      return ` [${linkText}](${fullUrl}) `;
    } catch {
      return ` ${linkText} `;
    }
  });

  // Convert headings & line breaks
  clean = clean
    .replace(/<(?:h[1-6]|p|div|tr|li)\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

  return clean.slice(0, 50_000); // safety length cap
}

async function scrapeCareerPage(url, firecrawlKey) {
  // Strategy 1: Firecrawl (if key available)
  if (firecrawlKey) {
    try {
      log(`Scraping via Firecrawl: ${url}`);
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const md = data?.data?.markdown || '';
        if (md.trim().length > 100) {
          return { content: md.slice(0, 50_000), source: 'firecrawl' };
        }
      }
    } catch (err) {
      log(`Firecrawl failed for ${url}: ${err.message}. Trying direct fetch fallback...`);
    }
  }

  // Strategy 2: Direct HTTP fetch fallback
  log(`Scraping via direct fetch: ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const html = await res.text();
    const markdown = htmlToCleanMarkdown(html, url);
    return { content: markdown, source: 'direct_html' };
  } finally {
    clearTimeout(timer);
  }
}

async function parseJobsWithGemini(company, pageContent) {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('No GEMINI_API_KEY configured.');
  }

  const prompt = [
    `You are an expert recruiter for Jobs in Vizag (jobsinvizag.in), a job portal for Visakhapatnam, Andhra Pradesh, India.`,
    `Below is the extracted text from the official career page of "${company.name}" (Careers URL: ${company.careers_url}).`,
    company.location_hint ? `Company location in Vizag: ${company.location_hint}.` : '',
    '',
    `TASK:`,
    `Extract all open job vacancies that are located in Visakhapatnam / Vizag, or remote positions applicable to candidates in Vizag.`,
    `CRITICAL LOCATION RULE:`,
    `- If a job is explicitly located in other cities (e.g. Hyderabad, Bangalore, Chennai, Pune, USA), DO NOT EXTRACT IT.`,
    `- Only extract jobs where the location is Visakhapatnam (Vizag) or where it is clearly a local opening for this office/remote.`,
    `- If no specific Vizag jobs are listed, return an empty array {"jobs": []}.`,
    `- Ensure apply_link is a valid URL (if a specific job link exists in markdown, use it; otherwise use ${company.careers_url}).`,
    `- Keep descriptions informative, professional, and clean.`,
    '',
    `CAREER PAGE CONTENT:`,
    pageContent,
  ]
    .filter(Boolean)
    .join('\n');

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  let lastErr = null;

  for (const apiKey of keys) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
            responseSchema: EXTRACT_JOBS_SCHEMA,
          },
        }),
        signal: controller.signal,
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastErr = new Error(payload?.error?.message || `Gemini error HTTP ${res.status}`);
        continue;
      }

      const rawText =
        payload?.candidates?.[0]?.content?.parts?.[0]?.text ||
        payload?.candidates?.[0]?.text ||
        '{}';

      const parsed = JSON.parse(rawText);
      return Array.isArray(parsed?.jobs) ? parsed.jobs : [];
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr || new Error('All Gemini API keys failed.');
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const targetCompanyArg = process.argv.find((_, i, arr) => arr[i - 1] === '--company');

  log(`Starting Direct Company Careers Pipeline (DryRun: ${isDryRun})...`);

  // 1. Load curated companies
  const catalogPath = path.join(projectRoot, 'data', 'vizag-company-careers.json');
  if (!fs.existsSync(catalogPath)) {
    throw new Error(`Companies catalog not found at ${catalogPath}`);
  }

  const companies = JSON.parse(fs.readFileSync(catalogPath, 'utf8')).filter((c) => {
    if (!c.active) return false;
    if (targetCompanyArg) {
      return c.name.toLowerCase().includes(targetCompanyArg.toLowerCase());
    }
    return true;
  });

  log(`Loaded ${companies.length} active company target(s).`);

  // 2. Fetch existing job keys to avoid duplicates
  let existing = { slugs: new Set(), applyLinks: new Set() };
  if (!isDryRun) {
    try {
      existing = await fetchExistingJobKeys(30);
      log(`Loaded ${existing.slugs.size} existing slugs for deduplication.`);
    } catch (err) {
      log(`Warning: Could not fetch existing keys: ${err.message}. Proceeding carefully.`);
    }
  }

  const firecrawlKey = getFirecrawlApiKey();
  if (firecrawlKey) {
    log('Firecrawl API key detected; dynamic rendering enabled.');
  } else {
    log('No Firecrawl key found; using resilient direct HTML parser.');
  }

  const report = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    dryRun: isDryRun,
    companiesProcessed: 0,
    totalJobsFound: 0,
    publishedJobs: 0,
    skippedJobs: 0,
    details: [],
  };

  for (const company of companies) {
    log(`\n========================================`);
    log(`Checking: ${company.name} (${company.careers_url})`);

    const companyReport = {
      company: company.name,
      careersUrl: company.careers_url,
      jobsFound: 0,
      published: 0,
      skipped: 0,
      error: null,
      jobs: [],
    };

    try {
      const { content, source } = await scrapeCareerPage(company.careers_url, firecrawlKey);
      log(`Fetched ${content.length} characters of page text via ${source}.`);

      if (content.length < 50) {
        log(`Page content too short, skipping.`);
        companyReport.error = 'Page content too short';
        report.details.push(companyReport);
        continue;
      }

      log(`Analyzing with Gemini for Vizag roles...`);
      const extractedJobs = await parseJobsWithGemini(company, content);
      log(`Found ${extractedJobs.length} potential Vizag job(s).`);

      companyReport.jobsFound = extractedJobs.length;
      report.totalJobsFound += extractedJobs.length;

      for (const rawJob of extractedJobs) {
        const job = {
          ...rawJob,
          company: company.name,
          location: rawJob.location || 'Visakhapatnam',
          category: rawJob.category || company.category || 'General',
          source_name: 'Direct Company Website',
          source_url: company.careers_url,
          apply_link: rawJob.apply_link || company.careers_url,
        };

        const { skip, reason } = shouldSkipJob(job, existing);
        if (skip) {
          log(`  [SKIP] "${job.title}" -> ${reason}`);
          companyReport.skipped += 1;
          report.skippedJobs += 1;
          companyReport.jobs.push({ title: job.title, status: 'skipped', reason });
          continue;
        }

        if (isDryRun) {
          log(`  [DRY-RUN WOULD PUBLISH] "${job.title}" (${job.location})`);
          companyReport.published += 1;
          report.publishedJobs += 1;
          companyReport.jobs.push({ title: job.title, status: 'dry_run_published' });
        } else {
          try {
            const inserted = await publishJob(job, 'published');
            log(`  [PUBLISHED] "${inserted.title}" -> /jobs/${inserted.slug}`);
            companyReport.published += 1;
            report.publishedJobs += 1;
            companyReport.jobs.push({ title: inserted.title, slug: inserted.slug, status: 'published' });

            // Add to in-memory set to prevent duplicate within the same run
            if (inserted.slug) existing.slugs.add(inserted.slug.toLowerCase());
            if (inserted.apply_link) existing.applyLinks.add(inserted.apply_link.toLowerCase());
          } catch (pubErr) {
            log(`  [ERROR PUBLISHING] "${job.title}": ${pubErr.message}`);
            companyReport.skipped += 1;
            report.skippedJobs += 1;
            companyReport.jobs.push({ title: job.title, status: 'error', reason: pubErr.message });
          }
        }
      }
    } catch (compErr) {
      log(`Error processing ${company.name}: ${compErr.message}`);
      companyReport.error = compErr.message;
    }

    report.details.push(companyReport);
    report.companiesProcessed += 1;
  }

  report.finishedAt = new Date().toISOString();

  log(`\n========================================`);
  log(`SUMMARY:`);
  log(`Companies Processed: ${report.companiesProcessed}`);
  log(`Jobs Found: ${report.totalJobsFound}`);
  log(`Jobs Published: ${report.publishedJobs}`);
  log(`Jobs Skipped: ${report.skippedJobs}`);

  // Write report
  const reportFileName = `company-careers-automation-report-${Date.now()}.json`;
  const reportPath = path.join(projectRoot, reportFileName);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  log(`Report saved to ${reportFileName}`);
}

main().catch((err) => {
  console.error(`[auto-company-careers] Fatal error:`, err);
  process.exit(1);
});
