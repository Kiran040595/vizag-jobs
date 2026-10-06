#!/usr/bin/env node
/**
 * Automated Company Career Portal Discovery and Synchronization.
 *
 * Visits each company's official website, crawls and parses the page to discover
 * the actual live career portal URL (including ATS platforms and careers subdomains),
 * and updates the Supabase `companies` table.
 *
 * Usage:
 *   node scripts/fetch-company-career-portals.mjs
 *   node scripts/fetch-company-career-portals.mjs --approved-only
 *   node scripts/fetch-company-career-portals.mjs --company "Fluentgrid"
 *   node scripts/fetch-company-career-portals.mjs --all
 *   node scripts/fetch-company-career-portals.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { applyLocalEnv, pipelineConfig } from './lib/pipeline-env.mjs';
import { discoverCompanyCareerPortal } from './lib/career-portal-finder.mjs';

applyLocalEnv();

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isAll = args.includes('--all');
const targetCompanyArg = (() => {
  const idx = args.indexOf('--company');
  return idx !== -1 && args[idx + 1] ? args[idx + 1].trim() : null;
})();

const supabase = createClient(
  pipelineConfig.supabaseUrl,
  pipelineConfig.supabaseServiceRoleKey || pipelineConfig.supabaseAnonKey,
  { auth: { persistSession: false } }
);

async function run() {
  console.log('====================================================');
  console.log('🌐 Company Career Portal Discovery & Sync Pipeline');
  console.log('====================================================');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no database writes)' : 'LIVE SYNC'}`);
  console.log(`Target: ${targetCompanyArg ? `Single Company: "${targetCompanyArg}"` : isAll ? 'All Companies with Website' : 'Directory Approved Companies Only'}`);
  console.log('----------------------------------------------------\n');

  let query = supabase
    .from('companies')
    .select('id, name, website, careers_url, is_directory_approved, category')
    .not('website', 'is', null)
    .neq('website', '');

  if (targetCompanyArg) {
    query = query.ilike('name', targetCompanyArg);
  } else if (!isAll) {
    query = query.eq('is_directory_approved', true);
  }

  const { data: companies, error } = await query;
  if (error) {
    console.error('❌ Failed to fetch companies from Supabase:', error.message);
    process.exit(1);
  }

  if (!companies || companies.length === 0) {
    console.log('⚠️ No matching companies found with a website.');
    return;
  }

  console.log(`Found ${companies.length} companies to inspect.\n`);

  let updatedCount = 0;
  let alreadyCorrectCount = 0;
  let notFoundCount = 0;
  let skippedNoWebsite = 0;

  for (let i = 0; i < companies.length; i++) {
    const comp = companies[i];
    const prefix = `[${i + 1}/${companies.length}] ${comp.name}`;

    if (!comp.website || comp.website.trim().length < 4) {
      console.log(`${prefix}: ⚠️ No website listed. Skipping.`);
      skippedNoWebsite++;
      continue;
    }

    const currentCareers = (comp.careers_url || '').trim();
    console.log(`${prefix} => Visiting ${comp.website}...`);

    try {
      const result = await discoverCompanyCareerPortal(comp.website);

      if (result.success && result.careersUrl) {
        const discovered = result.careersUrl.trim();

        if (currentCareers === discovered) {
          console.log(`   ✅ Already up to date: ${discovered} (${result.method})`);
          alreadyCorrectCount++;
        } else {
          console.log(`   ✨ FOUND CAREER PORTAL!`);
          console.log(`      Old: ${currentCareers || '(none)'}`);
          console.log(`      New: ${discovered} [via ${result.method}]`);

          if (!isDryRun) {
            const { error: updateErr } = await supabase
              .from('companies')
              .update({
                careers_url: discovered,
                updated_at: new Date().toISOString(),
              })
              .eq('id', comp.id);

            if (updateErr) {
              console.error(`   ❌ Failed to update DB for ${comp.name}:`, updateErr.message);
            } else {
              console.log(`   💾 Database updated successfully.`);
              updatedCount++;
            }
          } else {
            console.log(`   🔍 Dry run: would update database.`);
            updatedCount++;
          }
        }
      } else {
        console.log(`   ⚠️ Could not detect career portal (${result.reason || 'Not found'})`);
        notFoundCount++;
      }
    } catch (err) {
      console.error(`   ❌ Error checking ${comp.name}:`, err.message);
      notFoundCount++;
    }

    // Small courteous pause between sites to avoid flooding
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log('\n====================================================');
  console.log('📊 Discovery & Sync Summary');
  console.log('====================================================');
  console.log(`Total inspected:      ${companies.length}`);
  console.log(`Updated with real URL:${updatedCount}`);
  console.log(`Already accurate:     ${alreadyCorrectCount}`);
  console.log(`Not found / Failed:   ${notFoundCount}`);
  console.log(`No website:           ${skippedNoWebsite}`);
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('Fatal pipeline error:', err);
  process.exit(1);
});
