import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { CURATED_COMPANIES } from './lib/curated-companies.mjs';
import { KNOWN_COMPANY_DEFAULTS, EXCLUDED_DIRECTORY_COMPANIES } from '../src/services/adminCompanies.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function run() {
  console.log('⚡ Generating Production SQL for Supabase Companies Update...');

  // Build master mapping
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

  console.log(`Loaded ${masterMap.size} verified companies.`);

  const sqlStatements = [];

  // 1. Update verified companies
  for (const [key, data] of masterMap.entries()) {
    const isExcluded = EXCLUDED_DIRECTORY_COMPANIES.has(key);
    const nameVal = escapeSql(data.name);
    const webVal = escapeSql(data.website);
    const carVal = escapeSql(data.careers_url);
    const catVal = escapeSql(data.category);
    const approvedVal = isExcluded ? 'false' : 'true';
    const activeVal = Boolean(data.careers_url) ? 'true' : 'false';

    // Update query targeting ILIKE or exact name
    sqlStatements.push(`
UPDATE public.companies
SET
  website = COALESCE(${webVal}, website),
  careers_url = ${carVal},
  category = COALESCE(${catVal}, category),
  is_directory_approved = ${approvedVal},
  is_active_for_scrape = ${activeVal},
  updated_at = timezone('utc', now())
WHERE LOWER(TRIM(name)) = '${key.replace(/'/g, "''")}';
`);
  }

  // 2. Set excluded companies to false
  for (const exc of EXCLUDED_DIRECTORY_COMPANIES) {
    sqlStatements.push(`
UPDATE public.companies
SET is_directory_approved = false, updated_at = timezone('utc', now())
WHERE LOWER(TRIM(name)) = '${exc.replace(/'/g, "''")}';
`);
  }

  const fullSql = `BEGIN;\n${sqlStatements.join('\n')}\nCOMMIT;`;
  const sqlFile = path.join(__dirname, 'update_companies.sql');
  fs.writeFileSync(sqlFile, fullSql, 'utf8');

  console.log(`Generated SQL file with ${sqlStatements.length} updates at scripts/update_companies.sql`);
  console.log('Executing SQL against linked Supabase PostgreSQL database...');

  try {
    const out = execSync(`npx supabase db query --linked --file "${sqlFile}"`, {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 60000,
    });
    console.log('✅ SQL execution succeeded!');
  } catch (err) {
    console.error('❌ SQL execution error:', err.message);
    if (err.stdout) console.log('Stdout:', err.stdout.toString());
    if (err.stderr) console.error('Stderr:', err.stderr.toString());
    process.exit(1);
  } finally {
    if (fs.existsSync(sqlFile)) {
      fs.unlinkSync(sqlFile);
    }
  }

  // Verification query
  console.log('\n🔍 Verifying updated records in Supabase:');
  const verifySql = `
SELECT name, careers_url, is_directory_approved
FROM public.companies
WHERE name IN ('Conduent', 'Miracle Software Systems', 'WNS', 'Symbiosis Technologies', 'Symbiosys Technologies', 'Granules India', 'Pfizer', 'Hetero', 'GMR Group', 'Adani Group', 'CSB Bank', 'Swiggy', 'Escape Academy')
ORDER BY name;
`;
  const verifyOut = execSync(`npx supabase db query --linked "${verifySql.trim()}"`, {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 30000,
  });

  try {
    const parsed = JSON.parse(verifyOut);
    console.log('Verified database rows:');
    console.table(parsed.rows || parsed);
  } catch {
    console.log(verifyOut);
  }
}

run();
