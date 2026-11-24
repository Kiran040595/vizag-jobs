import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { pipelineConfig, applyLocalEnv } from './lib/pipeline-env.mjs';
import {
  cleanCompanyForDedupe,
  cleanTitleForDedupe,
  normalizeUrlForCompare,
  extractCanonicalJobPostingId,
} from '../src/lib/companyCareerFetchAutomation.js';

applyLocalEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const isDryRun = !process.argv.includes('--execute');

const key = pipelineConfig.supabaseServiceRoleKey || pipelineConfig.supabaseAnonKey;
const supabase = createClient(pipelineConfig.supabaseUrl, key, {
  auth: { persistSession: false },
});

async function fetchAllJobs() {
  console.log('[cleanup] Fetching all jobs from Supabase...');
  let all = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, slug, title, company, apply_link, source_url, created_at, status, application_count, apply_click_count')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw new Error(`Failed to load jobs: ${error.message}`);
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    page += 1;
  }
  console.log(`[cleanup] Loaded ${all.length} total jobs.`);
  return all;
}

function hasRandomSuffix(slug) {
  // Matches -535dd, -p4nc7, -bt00h, -x7n46, -hgct3, -tihhs, -00x9a, etc. (4-5 alphanumeric chars after hyphen at end)
  return /-[a-z0-9]{4,6}$/i.test(slug);
}

function findDuplicateGroups(allJobs) {
  // Group by (cleanCompany, cleanTitle, canonicalApplyId or normalizedApply)
  const groups = new Map();

  for (const job of allJobs) {
    const compClean = cleanCompanyForDedupe(job.company);
    const titleClean = cleanTitleForDedupe(job.title);
    const applyNorm = normalizeUrlForCompare(job.apply_link);
    const postingId = extractCanonicalJobPostingId(job.apply_link) || extractCanonicalJobPostingId(job.source_url);

    // Primary unique key for deduplication
    let dedupeKey = '';
    if (postingId) {
      dedupeKey = `id:${compClean}:::${postingId}`;
    } else if (applyNorm && !applyNorm.endsWith('/careers') && !applyNorm.endsWith('/jobs')) {
      dedupeKey = `apply:${compClean}:::${titleClean}:::${applyNorm}`;
    } else {
      dedupeKey = `title:${compClean}:::${titleClean}`;
    }

    if (!groups.has(dedupeKey)) {
      groups.set(dedupeKey, []);
    }
    groups.get(dedupeKey).push(job);
  }

  const duplicates = [];
  for (const [key, jobs] of groups.entries()) {
    if (jobs.length > 1) {
      // Pick canonical: prefer the one without random suffix, or oldest created_at
      jobs.sort((a, b) => {
        const aHasSuffix = hasRandomSuffix(a.slug);
        const bHasSuffix = hasRandomSuffix(b.slug);
        if (!aHasSuffix && bHasSuffix) return -1;
        if (aHasSuffix && !bHasSuffix) return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const canonical = jobs[0];
      const dupesToRemove = jobs.slice(1);

      duplicates.push({
        key,
        canonical,
        dupesToRemove,
      });
    }
  }

  return duplicates;
}

async function main() {
  console.log(`[cleanup] Duplicate Jobs Cleanup (Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE EXECUTION'})`);

  const allJobs = await fetchAllJobs();
  const duplicateGroups = findDuplicateGroups(allJobs);

  console.log(`[cleanup] Found ${duplicateGroups.length} duplicate groups.`);
  const totalDupes = duplicateGroups.reduce((acc, g) => acc + g.dupesToRemove.length, 0);
  console.log(`[cleanup] Total excess duplicate jobs to remove: ${totalDupes}`);

  const backupDir = path.join(projectRoot, 'logs');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const backupData = duplicateGroups.map((g) => ({
    key: g.key,
    canonical: {
      id: g.canonical.id,
      slug: g.canonical.slug,
      title: g.canonical.title,
      company: g.canonical.company,
      created_at: g.canonical.created_at,
      apply_link: g.canonical.apply_link,
    },
    dupesToRemove: g.dupesToRemove.map((d) => ({
      id: d.id,
      slug: d.slug,
      title: d.title,
      company: d.company,
      created_at: d.created_at,
      apply_link: d.apply_link,
      application_count: d.application_count,
      apply_click_count: d.apply_click_count,
    })),
  }));

  const backupFile = path.join(backupDir, `duplicate-jobs-audit-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`[cleanup] Full backup audit saved to: ${backupFile}`);

  // Display Brandix duplicates specifically
  const brandixGroups = duplicateGroups.filter((g) => g.key.toLowerCase().includes('brandix'));
  console.log(`\n=== BRANDIX DUPLICATE AUDIT (${brandixGroups.length} roles affected) ===`);
  for (const g of brandixGroups) {
    console.log(`\nRole: ${g.canonical.company} - ${g.canonical.title}`);
    console.log(`  KEEP (Canonical): [${g.canonical.slug}] ID: ${g.canonical.id} (Created: ${g.canonical.created_at})`);
    for (const d of g.dupesToRemove) {
      console.log(`  REMOVE (Duplicate): [${d.slug}] ID: ${d.id} (Created: ${d.created_at})`);
    }
  }

  if (isDryRun) {
    console.log('\n[cleanup] DRY-RUN complete. No database changes were made.');
    console.log('[cleanup] To execute removal, run with: node scripts/cleanup-duplicate-jobs.mjs --execute');
    return;
  }

  // If live execution:
  console.log('\n[cleanup] Backing up full records for all candidate duplicates...');
  const allDupeIds = duplicateGroups.flatMap((g) => g.dupesToRemove.map((d) => d.id));
  const fullBackupRows = [];
  const chunkSize = 50;
  for (let i = 0; i < allDupeIds.length; i += chunkSize) {
    const chunkIds = allDupeIds.slice(i, i + chunkSize);
    const { data: chunkData, error: chunkErr } = await supabase
      .from('jobs')
      .select('*')
      .in('id', chunkIds);
    if (chunkErr) {
      console.warn(`  Warning fetching full rows chunk ${i}: ${chunkErr.message}`);
    } else if (chunkData) {
      fullBackupRows.push(...chunkData);
    }
  }

  const fullBackupFile = path.join(backupDir, `duplicate-jobs-full-records-${Date.now()}.json`);
  fs.writeFileSync(fullBackupFile, JSON.stringify(fullBackupRows, null, 2), 'utf8');
  console.log(`[cleanup] Saved ${fullBackupRows.length} full duplicate records to: ${fullBackupFile}`);

  console.log('\n[cleanup] EXECUTING REMOVAL OF DUPLICATE JOBS...');
  let removedCount = 0;
  let mergedClicks = 0;

  for (const g of duplicateGroups) {
    let addClicks = 0;
    let addApps = 0;

    for (const d of g.dupesToRemove) {
      addClicks += Number(d.apply_click_count) || 0;
      addApps += Number(d.application_count) || 0;

      // Delete the duplicate row
      const { data: delData, error: delErr } = await supabase.from('jobs').delete().eq('id', d.id).select('id');
      if (delErr) {
        console.error(`  ❌ Failed to delete duplicate ID ${d.id} (${d.slug}): ${delErr.message}`);
      } else if (delData && delData.length > 0) {
        removedCount += delData.length;
      }
    }

    // Merge click/application counts into canonical job if any
    if (addClicks > 0 || addApps > 0) {
      const nextClicks = (Number(g.canonical.apply_click_count) || 0) + addClicks;
      const nextApps = (Number(g.canonical.application_count) || 0) + addApps;
      await supabase
        .from('jobs')
        .update({
          apply_click_count: nextClicks,
          application_count: nextApps,
        })
        .eq('id', g.canonical.id);
      mergedClicks += addClicks;
    }
  }

  console.log(`\n✅ [cleanup] Successfully removed ${removedCount} duplicate jobs!`);
  if (mergedClicks > 0) {
    console.log(`[cleanup] Merged ${mergedClicks} application/click interactions into canonical jobs.`);
  }

  // Regenerate sitemap
  console.log('[cleanup] Regenerating sitemap.xml to purge removed duplicate URLs...');
  try {
    const { execSync } = await import('node:child_process');
    execSync('node scripts/generate-sitemap.mjs', { cwd: projectRoot, stdio: 'inherit' });
    console.log('✅ [cleanup] Sitemap regenerated successfully.');
  } catch (smErr) {
    console.warn(`[cleanup] Sitemap regeneration warning: ${smErr.message}`);
  }
}

main().catch((err) => {
  console.error('[cleanup] Fatal error:', err);
  process.exit(1);
});
