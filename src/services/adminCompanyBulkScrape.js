import { supabase } from '../lib/supabaseClient.js';
import { buildCompanyScrapeUpdateBatches } from '../lib/companyBulkScraperSelection.js';

const BULK_UPSERT_SIZE = 250;

export async function setCompaniesScrapeStatus(companyNames, isActiveForScrape) {
  const updatedAt = new Date().toISOString();
  const batches = buildCompanyScrapeUpdateBatches(
    companyNames,
    isActiveForScrape,
    updatedAt,
    BULK_UPSERT_SIZE,
  );
  if (batches.length === 0) return { updated: 0 };
  if (!supabase) throw new Error('Supabase client is not configured.');

  for (const rows of batches) {
    const { error } = await supabase.from('companies').upsert(rows, { onConflict: 'name' });
    if (error) throw new Error(`Could not update company scraper settings: ${error.message}`);
  }

  return { updated: batches.reduce((total, rows) => total + rows.length, 0) };
}
