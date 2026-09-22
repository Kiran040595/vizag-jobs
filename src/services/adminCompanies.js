import { supabase } from '../lib/supabaseClient';
import { fetchJobs } from './jobs';
import { filterProcessedJobsForPublicDisplay } from '../lib/jobDisplayWindow';

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

    const isDirectoryApproved =
      dbRecord?.is_directory_approved !== undefined
        ? Boolean(dbRecord.is_directory_approved)
        : Boolean(local.is_directory_approved);

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
      isDirectoryApproved,
      notes: dbRecord?.notes || local.notes || '',
    });
  }

  // Sort: Directory approved first, then with careers_url, then totalJobs desc, then name asc
  return result.sort((a, b) => {
    if (b.isDirectoryApproved !== a.isDirectoryApproved) {
      return (b.isDirectoryApproved ? 1 : 0) - (a.isDirectoryApproved ? 1 : 0);
    }
    const aHasCareer = a.careersUrl ? 1 : 0;
    const bHasCareer = b.careersUrl ? 1 : 0;
    if (bHasCareer !== aHasCareer) return bHasCareer - aHasCareer;
    if (b.totalJobs !== a.totalJobs) return b.totalJobs - a.totalJobs;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Saves company website, careers URL, scrape toggle, and directory approval.
 * Writes to Supabase `companies` table and syncs local override fallback.
 */
export async function saveCompanyDetails({
  name,
  website,
  careersUrl,
  category,
  location,
  isActiveForScrape,
  isDirectoryApproved,
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
    is_directory_approved: isDirectoryApproved,
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
    is_directory_approved: Boolean(isDirectoryApproved),
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

/**
 * Quick toggle for approving or hiding a company in the public /companies directory.
 */
export async function toggleCompanyDirectoryApproval({ name, isDirectoryApproved }) {
  if (!name?.trim()) return;
  const cleanName = name.trim();

  setLocalCompanyOverride(cleanName, {
    is_directory_approved: isDirectoryApproved,
  });

  if (!supabase) return;

  try {
    await supabase
      .from('companies')
      .update({
        is_directory_approved: Boolean(isDirectoryApproved),
        updated_at: new Date().toISOString(),
      })
      .eq('name', cleanName);
  } catch (err) {
    console.warn('Could not update company directory approval:', err);
  }
}

export const DIRECTORY_SECTORS = [
  { id: 'all', label: 'All Sectors', icon: '🏢' },
  { id: 'it', label: 'IT & Software', icon: '💻', match: ['IT', 'Software', 'Tech', 'Information Technology'] },
  { id: 'pharma', label: 'Pharma & Healthcare', icon: '💊', match: ['Healthcare', 'Pharma', 'Pharmaceutical', 'Hospital', 'Biomedical'] },
  { id: 'education', label: 'Education & Universities', icon: '🎓', match: ['Education', 'University', 'School', 'Academy', 'College'] },
  { id: 'banking', label: 'Banking & Financial', icon: '🏦', match: ['Banking & Finance', 'Banking', 'Finance', 'Insurance', 'Fintech'] },
  { id: 'manufacturing', label: 'Manufacturing & Engineering', icon: '🏭', match: ['Manufacturing', 'Engineering', 'Civil Engineering', 'Mechanical Engineering', 'Electrical / EEE', 'Logistics'] },
  { id: 'hospitality', label: 'Hospitality & Retail', icon: '🏨', match: ['Hospitality & Retail', 'Hospitality', 'Retail', 'Hotel', 'Food', 'Sales & Marketing'] },
];

export function mapCategoryToSector(category = '') {
  const norm = String(category).toLowerCase();
  for (const s of DIRECTORY_SECTORS) {
    if (s.id === 'all') continue;
    if (s.match.some((m) => norm.includes(m.toLowerCase()))) {
      return s;
    }
  }
  return DIRECTORY_SECTORS[1]; // default to IT & Software
}

/**
 * Loads approved companies for the public /companies directory page.
 * Returns only companies where `is_directory_approved = true`.
 */
export async function fetchPublicDirectoryCompanies() {
  if (!supabase) return [];

  // Fetch approved companies
  const companiesRes = await supabase
    .from('companies')
    .select('id, name, website, careers_url, category, location, is_directory_approved, notes')
    .eq('is_directory_approved', true)
    .limit(1000);

  // 2. Fetch the exact same active public jobs used on /jobs
  let publicJobs = [];
  try {
    const rawJobs = await fetchJobs();
    publicJobs = filterProcessedJobsForPublicDisplay(rawJobs);
  } catch (err) {
    console.warn('Could not fetch public jobs for company directory counts:', err);
  }

  const normalizeCompName = (name = '') => String(name).trim().toLowerCase().replace(/\s+/g, ' ');

  const exactJobCounts = new Map();
  for (const j of publicJobs) {
    if (j.company) {
      const key = normalizeCompName(j.company);
      exactJobCounts.set(key, (exactJobCounts.get(key) || 0) + 1);
    }
  }

  const rawList = companiesRes.data || [];
  return rawList
    .map((c) => {
      const sector = mapCategoryToSector(c.category);
      const key = normalizeCompName(c.name);
      const activeJobsCount = exactJobCounts.get(key) || 0;
      return {
        id: c.id,
        name: c.name,
        website: c.website || '',
        careersUrl: c.careers_url || '',
        category: c.category || sector.label,
        sectorId: sector.id,
        sectorLabel: sector.label,
        sectorIcon: sector.icon,
        location: c.location || 'Visakhapatnam',
        activeJobsCount,
        notes: c.notes || '',
      };
    })
    .sort((a, b) => {
      // Prioritize companies with live jobs, then by name
      if (b.activeJobsCount !== a.activeJobsCount) {
        return b.activeJobsCount - a.activeJobsCount;
      }
      return a.name.localeCompare(b.name);
    });
}
