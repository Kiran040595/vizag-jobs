import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

export function queryLinkedDb(sql, retries = 2) {
  const tmpName = `.tmp_query_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.sql`;
  const tmpPath = path.join(projectRoot, tmpName);

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      fs.writeFileSync(tmpPath, sql, 'utf8');
      const stdout = execSync(`npx supabase db query --linked --file "${tmpPath}"`, {
        cwd: projectRoot,
        encoding: 'utf8',
        timeout: 120_000,
        maxBuffer: 64 * 1024 * 1024, // 64 MB buffer to prevent ENOBUFS
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const jsonStart = stdout.indexOf('{');
      if (jsonStart !== -1) {
        const parsed = JSON.parse(stdout.slice(jsonStart));
        return parsed.rows || [];
      }
      return [];
    } catch (err) {
      const errMsg = err.stderr ? String(err.stderr).slice(0, 300) : err.message;
      if (attempt <= retries) {
        // Sleep 2s before retry
        const waitUntil = Date.now() + 2000;
        while (Date.now() < waitUntil) {}
        continue;
      }
      throw new Error(`Linked DB query error (after ${attempt} attempts): ${errMsg}`);
    } finally {
      if (fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath);
        } catch {}
      }
    }
  }
}

export function escapeSqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (Array.isArray(value)) {
    if (value.length === 0) return "'{}'::text[]";
    const escapedItems = value.map((v) => `'${String(v).replace(/'/g, "''")}'`);
    return `ARRAY[${escapedItems.join(', ')}]::text[]`;
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function getEligibleVerifiedCompanies(limit = 1) {
  const sql = `
    SELECT id, name, website, careers_url, verified_careers_url, category, location, last_fetched_at
    FROM public.companies
    WHERE is_directory_approved = true
      AND is_active_for_scrape = true
      AND verified_careers_url IS NOT NULL
      AND verified_careers_url = careers_url
      AND (last_fetched_at IS NULL OR last_fetched_at < timezone('utc', now()) - INTERVAL '7 days')
    ORDER BY last_fetched_at ASC NULLS FIRST
    LIMIT ${Number(limit) || 1};
  `;
  return queryLinkedDb(sql);
}

export function markCompanyLastFetched(companyId) {
  const sql = `
    UPDATE public.companies
    SET last_fetched_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = ${escapeSqlValue(companyId)};
  `;
  return queryLinkedDb(sql);
}

export function fetchExistingJobKeysLinked(targetCompanyName = '') {
  let whereClause = '';
  if (targetCompanyName) {
    const cleanComp = String(targetCompanyName).trim().replace(/'/g, "''");
    whereClause = `WHERE company ILIKE '%${cleanComp}%'`;
  } else {
    whereClause = "WHERE created_at > timezone('utc', now()) - INTERVAL '30 days'";
  }

  const sql = `
    SELECT slug, apply_link, source_url, company, title
    FROM public.jobs
    ${whereClause};
  `;
  const rows = queryLinkedDb(sql);

  const slugs = new Set();
  const applyLinks = new Set();
  const companyTitleKeys = new Set();

  for (const row of rows) {
    const slug = String(row.slug || '').trim().toLowerCase();
    if (slug) slugs.add(slug);

    const apply = String(row.apply_link || '').trim().toLowerCase().replace(/\/+$/, '');
    if (apply) applyLinks.add(apply);

    const compClean = String(row.company || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const titleClean = String(row.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (compClean && titleClean) {
      companyTitleKeys.add(`${compClean}::${titleClean}`);
    }

    // Also strip company name and location tokens from existing title for matching
    let tNorm = String(row.title || '').toLowerCase();
    const words = compClean.split(/\s+/).filter((w) => w.length > 2);
    for (const w of words) {
      tNorm = tNorm.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
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

  return { slugs, applyLinks, companyTitleKeys };
}

export function insertJobDirect(payload) {
  const columns = [
    'slug',
    'title',
    'company',
    'location',
    'category',
    'job_type',
    'work_mode',
    'experience',
    'is_fresher',
    'salary',
    'apply_link',
    'short_description',
    'description',
    'responsibilities',
    'eligibility',
    'skills',
    'warning',
    'source_name',
    'source_url',
    'status',
    'apply_mode',
    'json_ld',
    'seo_meta',
  ];

  const values = columns.map((col) => escapeSqlValue(payload[col]));

  const sql = `
    INSERT INTO public.jobs (${columns.join(', ')})
    VALUES (${values.join(', ')})
    RETURNING id, title, slug, status;
  `;

  const rows = queryLinkedDb(sql);
  if (!rows || rows.length === 0) {
    throw new Error('Insert did not return created row.');
  }
  return rows[0];
}
