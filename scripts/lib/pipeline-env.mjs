import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const loadEnvFile = (file) => {
  const filePath = path.join(projectRoot, file);
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return env;
      }
      const eq = trimmed.indexOf('=');
      if (eq === -1) {
        return env;
      }
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      env[key] = value;
      return env;
    }, {});
};

const env = { ...loadEnvFile('.env'), ...loadEnvFile('.env.local'), ...process.env };

export const pipelineConfig = {
  supabaseUrl: (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, ''),
  supabaseAnonKey: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
  cronSecret: env.FETCH_JOBS_CRON_SECRET || '',
  jobsTable: env.SUPABASE_JOBS_TABLE || env.VITE_SUPABASE_JOBS_TABLE || 'jobs',
  functionsUrl: (
    env.SUPABASE_FUNCTIONS_URL ||
    env.VITE_SUPABASE_FUNCTIONS_URL ||
    (env.SUPABASE_URL || env.VITE_SUPABASE_URL
      ? `${(env.SUPABASE_URL || env.VITE_SUPABASE_URL).replace(/\/$/, '')}/functions/v1/fetch-external-jobs`
      : '')
  ).replace(/\/$/, ''),
  seoGapMs: Math.max(60_000, Number(env.AUTO_NAUKRI_SEO_GAP_MS || 3 * 60 * 1000)),
  naukriCollectWaitMs: Math.max(60_000, Number(env.AUTO_NAUKRI_COLLECT_WAIT_MS || 3 * 60 * 1000)),
  naukriCollectMaxAttempts: Math.max(1, Number(env.AUTO_NAUKRI_COLLECT_MAX_ATTEMPTS || 24)),
  seoTimeoutMs: Math.max(30_000, Number(env.AUTO_NAUKRI_SEO_TIMEOUT_MS || 130_000)),
  fetchTimeoutMs: Math.max(30_000, Number(env.AUTO_NAUKRI_FETCH_TIMEOUT_MS || 150_000)),
  dryRun: ['1', 'true', 'yes'].includes(String(env.AUTO_NAUKRI_DRY_RUN || '').toLowerCase()),
  maxJobs: Math.max(1, Number(env.AUTO_NAUKRI_MAX_JOBS || 30)),
};

export function assertPipelineConfig() {
  const missing = [];
  if (!pipelineConfig.supabaseUrl) missing.push('SUPABASE_URL');
  if (!pipelineConfig.supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
  if (!pipelineConfig.cronSecret) missing.push('FETCH_JOBS_CRON_SECRET');
  if (!pipelineConfig.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!pipelineConfig.functionsUrl) missing.push('SUPABASE_FUNCTIONS_URL');

  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(', ')}`);
  }
}
