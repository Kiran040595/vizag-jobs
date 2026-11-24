import { createClient } from '@supabase/supabase-js';
import { pipelineConfig, applyLocalEnv } from './pipeline-env.mjs';
import {
  cleanCompanyForDedupe,
  cleanTitleForDedupe,
  normalizeUrlForCompare,
  extractCanonicalJobPostingId,
  normalizeCompanyTitleKey,
} from '../../src/lib/companyCareerFetchAutomation.js';

applyLocalEnv();

let supabaseClient = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    if (!pipelineConfig.supabaseUrl) {
      throw new Error('Supabase URL is required.');
    }
    const key = pipelineConfig.supabaseServiceRoleKey || pipelineConfig.supabaseAnonKey;
    if (!key) {
      throw new Error('Supabase key (service role or anon) is required.');
    }
    supabaseClient = createClient(pipelineConfig.supabaseUrl, key, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

export async function getEligibleVerifiedCompanies(limit = 3, cooldownDays = 7) {
  const supabase = getSupabaseClient();
  const cooldownCutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('companies')
    .select('id, name, website, careers_url, verified_careers_url, category, location, last_fetched_at, is_active_for_scrape, is_directory_approved')
    .eq('is_directory_approved', true)
    .eq('is_active_for_scrape', true)
    .not('verified_careers_url', 'is', null)
    .or(`last_fetched_at.is.null,last_fetched_at.lt.${cooldownCutoff}`)
    .order('last_fetched_at', { ascending: true, nullsFirst: true })
    .limit(limit * 3);

  if (error) {
    throw new Error(`Failed to query eligible companies: ${error.message}`);
  }

  // Deduplicate by normalized company name so we don't pick two entries for the same company (e.g. Brandix and brandix)
  const seenCompanies = new Set();
  const result = [];
  for (const c of data || []) {
    const clean = cleanCompanyForDedupe(c.name);
    if (!seenCompanies.has(clean)) {
      seenCompanies.add(clean);
      result.push(c);
      if (result.length >= limit) break;
    }
  }

  return result;
}

export async function markCompanyLastFetched(companyId) {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('companies')
    .update({ last_fetched_at: now, updated_at: now })
    .eq('id', companyId);
  if (error) {
    console.error(`Warning: Could not update last_fetched_at for company ${companyId}: ${error.message}`);
  }
}

export async function fetchExistingJobKeysLinked(targetCompanyName = '') {
  const supabase = getSupabaseClient();
  let allRows = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from('jobs')
      .select('slug, apply_link, source_url, company, title, created_at')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (targetCompanyName) {
      query = query.ilike('company', `%${targetCompanyName.trim()}%`);
    } else {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', cutoff);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Could not load jobs: ${error.message}`);
    }

    allRows = allRows.concat(data || []);
    if (!data || data.length < pageSize) break;
    page += 1;
  }

  const slugs = new Set();
  const applyLinks = new Set();
  const companyTitleKeys = new Set();
  const jobPostingIds = new Set();

  for (const row of allRows) {
    const slug = String(row.slug || '').trim().toLowerCase();
    if (slug) slugs.add(slug);

    const apply = normalizeUrlForCompare(row.apply_link);
    if (apply) {
      applyLinks.add(apply);
      applyLinks.add(apply.replace(/\/+$/, ''));
      const id = extractCanonicalJobPostingId(apply);
      if (id) jobPostingIds.add(id);
    }

    const source = normalizeUrlForCompare(row.source_url);
    if (source) {
      applyLinks.add(source);
      applyLinks.add(source.replace(/\/+$/, ''));
      const id = extractCanonicalJobPostingId(source);
      if (id) jobPostingIds.add(id);
    }

    const compClean = cleanCompanyForDedupe(row.company);
    const titleClean = cleanTitleForDedupe(row.title);
    if (compClean && titleClean) {
      companyTitleKeys.add(`${compClean}::${titleClean}`);
    }

    const ctKey = normalizeCompanyTitleKey(row.company, row.title);
    if (ctKey) companyTitleKeys.add(ctKey);

    let tNorm = String(row.title || '').toLowerCase();
    if (compClean) {
      const words = compClean.split(/\s+/).filter((w) => w.length > 2);
      for (const w of words) {
        tNorm = tNorm.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
      }
    }
    tNorm = tNorm
      .replace(/\b(visakhapatnam|vishakhapatnam|vizag|vsp|andhra\s+pradesh|india)\b/gi, ' ')
      .replace(/[()[\]{}|/\\-]+/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (compClean && tNorm) {
      companyTitleKeys.add(`${compClean}::${tNorm}`);
    }
  }

  return { slugs, applyLinks, companyTitleKeys, jobPostingIds };
}

export async function insertJobDirect(payload) {
  const supabase = getSupabaseClient();

  if (payload.apply_link) {
    const { data: existingByApply } = await supabase
      .from('jobs')
      .select('id, slug, title')
      .or(`apply_link.eq.${payload.apply_link},source_url.eq.${payload.apply_link}`)
      .limit(1);
    if (existingByApply && existingByApply.length > 0) {
      throw new Error(`Duplicate job rejected: apply_link already exists in database (${existingByApply[0].slug}).`);
    }
  }

  if (payload.slug) {
    const { data: existingBySlug } = await supabase
      .from('jobs')
      .select('id, slug, title')
      .eq('slug', payload.slug)
      .limit(1);
    if (existingBySlug && existingBySlug.length > 0) {
      throw new Error(`Duplicate job rejected: slug "${payload.slug}" already exists in database.`);
    }
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert(payload)
    .select('id, title, slug, status')
    .single();

  if (error) {
    throw new Error(`Could not insert job: ${error.message}`);
  }
  return data;
}
