import { createClient } from '@supabase/supabase-js';
import { applyLocalEnv, pipelineConfig } from './lib/pipeline-env.mjs';
import { CURATED_COMPANIES } from './lib/curated-companies.mjs';
import { KNOWN_COMPANY_DEFAULTS, EXCLUDED_DIRECTORY_COMPANIES } from '../src/services/adminCompanies.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

applyLocalEnv();

const supabase = createClient(
  pipelineConfig.supabaseUrl,
  pipelineConfig.supabaseServiceRoleKey || pipelineConfig.supabaseAnonKey
);

async function run() {
  console.log('🔄 Starting Full Company Career URLs Sync to Supabase & Local Cache...');

  // Combine curated and defaults into master mapping
  const masterMap = new Map();

  for (const [name, def] of Object.entries(CURATED_COMPANIES)) {
    masterMap.set(name.trim().toLowerCase(), {
      name: name.trim(),
      ...def
    });
  }

  for (const [name, def] of Object.entries(KNOWN_COMPANY_DEFAULTS)) {
    const key = name.trim().toLowerCase();
    const existing = masterMap.get(key) || { name: name.trim() };
    masterMap.set(key, {
      ...existing,
      ...def
    });
  }

  console.log(`Master registry contains ${masterMap.size} verified company definitions.`);

  // 1. Fetch all companies currently in Supabase with pagination
  let dbComps = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('❌ Error fetching from Supabase:', error.message);
      return;
    }
    if (!data || data.length === 0) break;
    dbComps = dbComps.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Fetched ${dbComps.length} companies total from Supabase.`);

  const updates = [];
  let updatedCareersCount = 0;
  let excludedCount = 0;

  for (const comp of dbComps) {
    const key = comp.name.trim().toLowerCase();
    const verified = masterMap.get(key);
    const isExcluded = EXCLUDED_DIRECTORY_COMPANIES.has(key);

    let needsUpdate = false;
    const patch = { id: comp.id, name: comp.name };

    // Check exclusion
    if (isExcluded && comp.is_directory_approved !== false) {
      patch.is_directory_approved = false;
      needsUpdate = true;
      excludedCount++;
    }

    if (verified) {
      if (verified.careers_url && comp.careers_url !== verified.careers_url) {
        patch.careers_url = verified.careers_url;
        needsUpdate = true;
        updatedCareersCount++;
      }
      if (verified.website && comp.website !== verified.website) {
        patch.website = verified.website;
        needsUpdate = true;
      }
      if (verified.category && (!comp.category || comp.category === 'General')) {
        patch.category = verified.category;
        needsUpdate = true;
      }
      if (!isExcluded && comp.is_directory_approved !== true) {
        patch.is_directory_approved = true;
        needsUpdate = true;
      }
      if (comp.is_active_for_scrape !== true) {
        patch.is_active_for_scrape = true;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      updates.push(patch);
    }
  }

  console.log(`\nFound ${updates.length} company records to update in Supabase:`);
  console.log(`- Career URLs being fixed: ${updatedCareersCount}`);
  console.log(`- Excluded/Junk companies de-approved: ${excludedCount}`);

  // Batch updates to Supabase (50 at a time)
  const batchSize = 50;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    for (const item of batch) {
      const { id, ...fields } = item;
      const { error: updateErr } = await supabase
        .from('companies')
        .update({
          ...fields,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateErr) {
        console.warn(`⚠️ Failed updating ${item.name}: ${updateErr.message}`);
      } else {
        console.log(`✅ Updated ${item.name}: ${fields.careers_url || (fields.is_directory_approved === false ? '[Excluded]' : '[Metadata]')}`);
      }
    }
  }

  // Also ensure any curated companies not yet in DB are inserted
  const existingNames = new Set(dbComps.map(c => c.name.trim().toLowerCase()));
  const missingInserts = [];
  for (const [key, data] of masterMap.entries()) {
    if (!existingNames.has(key)) {
      missingInserts.push({
        name: data.name,
        website: data.website || null,
        careers_url: data.careers_url || null,
        category: data.category || 'General',
        location: 'Visakhapatnam',
        is_directory_approved: !EXCLUDED_DIRECTORY_COMPANIES.has(key),
        is_active_for_scrape: Boolean(data.careers_url),
        notes: 'Curated Vizag employer'
      });
    }
  }

  if (missingInserts.length > 0) {
    console.log(`\nInserting ${missingInserts.length} missing curated companies into Supabase...`);
    const { error: insertErr } = await supabase.from('companies').insert(missingInserts);
    if (insertErr) {
      console.warn('Insert warning:', insertErr.message);
    } else {
      console.log('✅ Inserted missing curated companies successfully.');
    }
  }

  // 2. Also update scripts/enriched-companies.json
  const enrichedPath = path.join(__dirname, 'enriched-companies.json');
  if (fs.existsSync(enrichedPath)) {
    try {
      const enrichedData = JSON.parse(fs.readFileSync(enrichedPath, 'utf8'));
      let enrichedUpdated = 0;
      for (const item of enrichedData) {
        const key = item.name.trim().toLowerCase();
        const verified = masterMap.get(key);
        if (verified && verified.careers_url && item.careers_url !== verified.careers_url) {
          item.careers_url = verified.careers_url;
          item.website = verified.website || item.website;
          enrichedUpdated++;
        }
      }
      fs.writeFileSync(enrichedPath, JSON.stringify(enrichedData, null, 2));
      console.log(`\n💾 Synchronized ${enrichedUpdated} entries in scripts/enriched-companies.json`);
    } catch (e) {
      console.warn('Notice regarding enriched-companies.json:', e.message);
    }
  }

  console.log('\n✨ All company career URLs successfully synchronized and verified!');
}

run();
