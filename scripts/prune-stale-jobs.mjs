#!/usr/bin/env node
/**
 * Archive old published jobs and purge long-archived rows to stay within Supabase free tier.
 *
 * Usage:
 *   node scripts/prune-stale-jobs.mjs
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   JOB_ARCHIVE_AFTER_DAYS (default 90)
 *   JOB_PURGE_ARCHIVED_AFTER_DAYS (default 180)
 *   JOB_RETENTION_DRY_RUN=true — log only, no RPC calls
 */

import { createClient } from '@supabase/supabase-js';
import { applyLocalEnv } from './lib/pipeline-env.mjs';
import {
  JOB_ARCHIVE_AFTER_DAYS,
  JOB_PURGE_ARCHIVED_AFTER_DAYS,
} from '../src/lib/jobRetention.js';

applyLocalEnv();

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const dryRun = (process.env.JOB_RETENTION_DRY_RUN || '').toLowerCase() === 'true';
const archiveDays = Number(process.env.JOB_ARCHIVE_AFTER_DAYS || JOB_ARCHIVE_AFTER_DAYS) || JOB_ARCHIVE_AFTER_DAYS;
const purgeDays =
  Number(process.env.JOB_PURGE_ARCHIVED_AFTER_DAYS || JOB_PURGE_ARCHIVED_AFTER_DAYS) ||
  JOB_PURGE_ARCHIVED_AFTER_DAYS;

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const run = async () => {
  console.log(
    JSON.stringify({
      event: 'job_retention_start',
      archive_after_days: archiveDays,
      purge_after_days: purgeDays,
      dry_run: dryRun,
    }),
  );

  if (dryRun) {
    console.log('Dry run — skipping archive and purge RPC calls.');
    return;
  }

  const { data: archivedCount, error: archiveError } = await supabase.rpc('archive_stale_jobs', {
    archive_after_days: archiveDays,
  });
  if (archiveError) {
    throw new Error(`archive_stale_jobs failed: ${archiveError.message}`);
  }

  const { data: purgedCount, error: purgeError } = await supabase.rpc('purge_archived_jobs', {
    purge_after_days: purgeDays,
  });
  if (purgeError) {
    throw new Error(`purge_archived_jobs failed: ${purgeError.message}`);
  }

  console.log(
    JSON.stringify({
      event: 'job_retention_done',
      archived: archivedCount ?? 0,
      purged: purgedCount ?? 0,
    }),
  );
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
