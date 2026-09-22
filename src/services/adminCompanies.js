import { supabase } from '../lib/supabaseClient';

const KNOWN_COMPANY_DEFAULTS = {
  'Miracle Software Systems': {
    website: 'https://www.miraclesoft.com',
    careers_url: 'https://www.miraclesoft.com/careers/openings',
    category: 'IT',
  },
  'Miraclesoft': {
    website: 'https://www.miraclesoft.com',
    careers_url: 'https://www.miraclesoft.com/careers/openings',
    category: 'IT',
  },
  'Fluentgrid Limited': {
    website: 'https://fluentgrid.com',
    careers_url: 'https://fluentgrid.com/careers/',
    category: 'IT',
  },
  'Fluentgrid': {
    website: 'https://fluentgrid.com',
    careers_url: 'https://fluentgrid.com/careers/',
    category: 'IT',
  },
  'Symbiosis Technologies': {
    website: 'https://symbiosistechnologies.com',
    careers_url: 'https://symbiosistechnologies.com/careers/',
    category: 'IT',
  },
  'Pulsus Healthtech': {
    website: 'https://www.pulsus.com',
    careers_url: 'https://www.pulsus.com/careers',
    category: 'Healthcare',
  },
  'Pulsus Group': {
    website: 'https://www.pulsus.com',
    careers_url: 'https://www.pulsus.com/careers',
    category: 'Healthcare',
  },
  'Eisai Pharmaceuticals India': {
    website: 'https://www.eisai.co.in',
    careers_url: 'https://www.eisai.co.in/careers/',
    category: 'Pharma',
  },
  'Patra India': {
    website: 'https://patracorp.com',
    careers_url: 'https://patracorp.com/careers/',
    category: 'BPO',
  },
  'Granules India': {
    website: 'https://granulesindia.com',
    careers_url: 'https://granulesindia.com/careers/',
    category: 'Pharma',
  },
};

const LOCAL_STORAGE_COMPANIES_KEY = 'vizag_admin_companies_overrides_v1';

function getLocalCompanyOverrides() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_COMPANIES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalCompanyOverride(name, data) {
  if (typeof localStorage === 'undefined') return;
  try {
    const all = getLocalCompanyOverrides();
    all[name] = { ...all[name], ...data };
    localStorage.setItem(LOCAL_STORAGE_COMPANIES_KEY, JSON.stringify(all));
  } catch {
    // Ignore storage quota or access errors
  }
}

/** Extracts domain as website hint if source/apply url is not aggregator */
function inferWebsiteFromUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (
      host.includes('linkedin.com') ||
      host.includes('naukri.com') ||
      host.includes('indeed.com') ||
      host.includes('google.com')
    ) {
      return '';
    }
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return '';
  }
}

async function fetchAllRows(table, columns = '*') {
  let allRows = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);

    if (error) {
      if (allRows.length > 0) return { data: allRows, error: null };
      return { data: [], error };
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { data: allRows, error: null };
}

/**
 * Loads all companies from the database:
 * 1. Aggregates distinct company names and job counts from `jobs`.
 * 2. Fetches stored website & career URLs from `companies` table.
 * 3. Merges defaults and local overrides.
 */
export async function fetchAdminCompanies() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  // 1. Fetch all jobs to aggregate companies
  const jobsPromise = fetchAllRows('jobs', 'company, category, location, apply_link, source_url, posted_at, status');

  // 2. Fetch all companies from companies table (fail gracefully if table not yet migrated)
  const companiesPromise = fetchAllRows('companies', '*')
    .catch(() => ({ data: [] }));

  // 3. Fetch employer profiles to pick up registered companies with websites
  const employersPromise = supabase
    .from('employer_profiles')
    .select('company_name, website, industry, location')
    .then((res) => (res.error ? { data: [] } : res))
    .catch(() => ({ data: [] }));

  const [jobsResult, companiesResult, employersResult] = await Promise.all([
    jobsPromise,
    companiesPromise,
    employersPromise,
  ]);

  if (jobsResult.error) {
    throw new Error(`Failed to load jobs for company list: ${jobsResult.error.message}`);
  }

  const dbSavedCompaniesMap = new Map();
  for (const row of companiesResult.data || []) {
    if (row.name) {
      dbSavedCompaniesMap.set(row.name.trim().toLowerCase(), row);
    }
  }

  const employerProfilesMap = new Map();
  for (const row of employersResult.data || []) {
    if (row.company_name) {
      employerProfilesMap.set(row.company_name.trim().toLowerCase(), row);
    }
  }

  const localOverrides = getLocalCompanyOverrides();
  const aggregated = new Map();

  for (const job of jobsResult.data || []) {
    const rawName = (job.company || '').trim();
    if (!rawName) continue;
    const key = rawName.toLowerCase();

    if (!aggregated.has(key)) {
      aggregated.set(key, {
        name: rawName,
        totalJobs: 0,
        publishedJobs: 0,
        category: job.category || 'General',
        location: job.location || 'Visakhapatnam',
        latestPostedAt: job.posted_at || null,
        sampleUrl: job.apply_link || job.source_url || '',
      });
    }

    const item = aggregated.get(key);
    item.totalJobs += 1;
    if (job.status === 'published') {
      item.publishedJobs += 1;
    }
    if (!item.category || item.category === 'General') {
      if (job.category && job.category !== 'General') {
        item.category = job.category;
      }
    }
  }

  // Also include any companies from `companies` table that might not have active jobs yet
  for (const [key, row] of dbSavedCompaniesMap.entries()) {
    if (!aggregated.has(key)) {
      aggregated.set(key, {
        name: row.name,
        totalJobs: 0,
        publishedJobs: 0,
        category: row.category || 'General',
        location: row.location || 'Visakhapatnam',
        latestPostedAt: row.created_at || null,
        sampleUrl: '',
      });
    }
  }

  // Final merge
  const result = [];
  for (const [key, comp] of aggregated.entries()) {
    const dbRecord = dbSavedCompaniesMap.get(key);
    const employerProfile = employerProfilesMap.get(key);
    const knownDefault = KNOWN_COMPANY_DEFAULTS[comp.name] || {};
    const local = localOverrides[comp.name] || {};

    const website =
      dbRecord?.website ||
      local.website ||
      employerProfile?.website ||
      knownDefault.website ||
      inferWebsiteFromUrl(comp.sampleUrl) ||
      '';

    const careersUrl =
      dbRecord?.careers_url ||
      local.careers_url ||
      knownDefault.careers_url ||
      '';

    const category =
      dbRecord?.category ||
      employerProfile?.industry ||
      knownDefault.category ||
      comp.category ||
      'General';

    const isActiveForScrape =
      dbRecord?.is_active_for_scrape !== undefined
        ? Boolean(dbRecord.is_active_for_scrape)
        : local.is_active_for_scrape !== undefined
          ? Boolean(local.is_active_for_scrape)
          : Boolean(careersUrl);

    result.push({
      id: dbRecord?.id || null,
      name: comp.name,
      website,
      careersUrl,
      category,
      location: comp.location || 'Visakhapatnam',
      totalJobs: comp.totalJobs,
      publishedJobs: comp.publishedJobs,
      latestPostedAt: comp.latestPostedAt,
      isActiveForScrape,
      notes: dbRecord?.notes || local.notes || '',
    });
  }

  // Sort: Companies with careers_url first, then by totalJobs desc, then name asc
  return result.sort((a, b) => {
    const aHasCareer = a.careersUrl ? 1 : 0;
    const bHasCareer = b.careersUrl ? 1 : 0;
    if (bHasCareer !== aHasCareer) return bHasCareer - aHasCareer;
    if (b.totalJobs !== a.totalJobs) return b.totalJobs - a.totalJobs;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Saves company website, careers URL, and scrape toggle.
 * Writes to Supabase `companies` table and syncs local override fallback.
 */
export async function saveCompanyDetails({
  name,
  website,
  careersUrl,
  category,
  location,
  isActiveForScrape,
  notes,
}) {
  if (!name?.trim()) {
    throw new Error('Company name is required.');
  }

  const cleanName = name.trim();
  const cleanWebsite = website?.trim() || null;
  const cleanCareersUrl = careersUrl?.trim() || null;
  const cleanCategory = category?.trim() || null;
  const cleanLocation = location?.trim() || 'Visakhapatnam';
  const cleanNotes = notes?.trim() || null;

  // Always save to local fallback for instant resilience
  setLocalCompanyOverride(cleanName, {
    website: cleanWebsite,
    careers_url: cleanCareersUrl,
    category: cleanCategory,
    location: cleanLocation,
    is_active_for_scrape: isActiveForScrape,
    notes: cleanNotes,
  });

  if (!supabase) return { name: cleanName };

  const payload = {
    name: cleanName,
    website: cleanWebsite,
    careers_url: cleanCareersUrl,
    category: cleanCategory,
    location: cleanLocation,
    is_active_for_scrape: Boolean(isActiveForScrape),
    notes: cleanNotes,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('companies')
      .upsert(payload, { onConflict: 'name' })
      .select('*')
      .single();

    if (error) {
      console.warn('Supabase companies table upsert notice (saved locally):', error.message);
    }
    return data || payload;
  } catch (err) {
    console.warn('Could not write to companies table (saved locally):', err);
    return payload;
  }
}
