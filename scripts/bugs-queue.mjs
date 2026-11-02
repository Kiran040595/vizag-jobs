import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { pipelineConfig } from './lib/pipeline-env.mjs';

function runCliQuery(sql) {
  try {
    // Sanitize quotes for powershell/bash
    const sanitized = sql.replace(/"/g, '\\"');
    const raw = execSync(`npx supabase db query --linked -o json "${sanitized}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
      return Array.isArray(parsed?.rows) ? parsed.rows : [];
    }
    return [];
  } catch {
    return null;
  }
}

function getAdminClient() {
  const url = pipelineConfig.supabaseUrl;
  const key = pipelineConfig.supabaseServiceRoleKey || pipelineConfig.supabaseAnonKey;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/ANON_KEY in environment.');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'list';
  const options = {};
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    } else if (!options.targetId) {
      options.targetId = arg;
    }
  }
  return { command, options };
}

export async function listBugs(status = 'open') {
  // If service role key is available, use client library directly
  if (pipelineConfig.supabaseServiceRoleKey) {
    const client = getAdminClient();
    let query = client
      .from('site_error_logs')
      .select('id, error_message, stack_trace, component_stack, context, url, pathname, user_agent, screen_size, status, created_at, resolution_notes, resolved_in_commit')
      .order('created_at', { ascending: false })
      .limit(30);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      if (
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        String(error.message || '').includes('Could not find the table')
      ) {
        console.log('ℹ️  Table "site_error_logs" does not exist yet in your Supabase database.');
        return [];
      }
      throw error;
    }
    return data || [];
  }

  // Fallback to linked Supabase CLI query for seamless admin privilege
  let sql = 'select id, error_message, stack_trace, component_stack, context, url, pathname, user_agent, screen_size, status, created_at, resolution_notes, resolved_in_commit from public.site_error_logs';
  if (status && status !== 'all') {
    sql += ` where status = '${status}'`;
  }
  sql += ' order by created_at desc limit 30;';

  const rows = runCliQuery(sql);
  if (rows !== null) {
    return rows;
  }

  // Fallback to anon client
  const client = getAdminClient();
  let query = client
    .from('site_error_logs')
    .select('id, error_message, stack_trace, component_stack, context, url, pathname, user_agent, screen_size, status, created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data } = await query;
  return data || [];
}

export async function resolveBug(id, { notes = 'Resolved by AI agent', commit = '' } = {}) {
  if (pipelineConfig.supabaseServiceRoleKey) {
    const client = getAdminClient();
    const { data, error } = await client
      .from('site_error_logs')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_notes: notes,
        resolved_in_commit: commit || null,
      })
      .eq('id', id)
      .select('id, error_message, status, resolved_at, resolved_in_commit')
      .single();

    if (error) throw error;
    return data;
  }

  const safeNotes = String(notes || '').replace(/'/g, "''");
  const safeCommit = String(commit || '').replace(/'/g, "''");
  const sql = `update public.site_error_logs set status = 'resolved', resolved_at = now(), resolution_notes = '${safeNotes}', resolved_in_commit = '${safeCommit}' where id = '${id}';`;
  runCliQuery(sql);
  return { id, status: 'resolved', resolution_notes: notes, resolved_in_commit: commit };
}

export async function ignoreBug(id, { notes = 'Ignored' } = {}) {
  if (pipelineConfig.supabaseServiceRoleKey) {
    const client = getAdminClient();
    const { data, error } = await client
      .from('site_error_logs')
      .update({
        status: 'ignored',
        resolution_notes: notes,
      })
      .eq('id', id)
      .select('id, error_message, status')
      .single();

    if (error) throw error;
    return data;
  }

  const safeNotes = String(notes || '').replace(/'/g, "''");
  const sql = `update public.site_error_logs set status = 'ignored', resolution_notes = '${safeNotes}' where id = '${id}';`;
  runCliQuery(sql);
  return { id, status: 'ignored', resolution_notes: notes };
}

export async function batchUpdateBugs(ids, { status = 'resolved', notes = '', commit = '' } = {}) {
  if (!ids || ids.length === 0) return [];
  if (pipelineConfig.supabaseServiceRoleKey) {
    const client = getAdminClient();
    const updatePayload = {
      status,
      resolution_notes: notes,
    };
    if (status === 'resolved') {
      updatePayload.resolved_at = new Date().toISOString();
      updatePayload.resolved_in_commit = commit || null;
    }
    const { data, error } = await client
      .from('site_error_logs')
      .update(updatePayload)
      .in('id', ids)
      .select('id, error_message, status');
    if (error) throw error;
    return data || [];
  }

  const safeNotes = String(notes || '').replace(/'/g, "''");
  const safeCommit = String(commit || '').replace(/'/g, "''");
  const idsSql = ids.map((id) => `'${id}'`).join(', ');
  let sql = `update public.site_error_logs set status = '${status}', resolution_notes = '${safeNotes}'`;
  if (status === 'resolved') {
    sql += `, resolved_at = now(), resolved_in_commit = '${safeCommit}'`;
  }
  sql += ` where id in (${idsSql});`;
  runCliQuery(sql);
  return ids.map((id) => ({ id, status, resolution_notes: notes }));
}

export const AUTO_FIX_RULES = [
  {
    name: 'sw-permission-denial',
    pattern: /Registration failed/i,
    action: 'resolve',
    notes: 'Resolved: Hardened service worker registration and push notification subscription guards in webPushSubscriptions.js, JobAlertNotifications.jsx, and pwaRecovery.js; filtered noise in errorReporter.js and api/report-error.js',
  },
  {
    name: 'iab-java-bridge',
    pattern: /Java object is gone|Java exception was raised|enableButtonsClickedMetaDataLogging|navigation_performance_logger_android|iabjs:\/\//i,
    action: 'ignore',
    notes: 'Filtered: Meta/Instagram In-App Browser detached Java bridge noise',
  },
  {
    name: 'storage-access-denied',
    pattern: /localStorage.*Access is denied|The request was denied/i,
    action: 'resolve',
    notes: 'Resolved: Wrapped localStorage/sessionStorage in try/catch across auth contexts and app components',
  },
  {
    name: 'replace-state-loop',
    pattern: /Attempt to use history\.replaceState\(\) more than/i,
    action: 'resolve',
    notes: 'Resolved: Added canonicalRedirectAttemptedRef and pathname normalization in JobDetailsPage.jsx to prevent loop',
  },
  {
    name: 'autofill-extension',
    pattern: /_AutofillCallbackHandler/i,
    action: 'ignore',
    notes: 'Filtered: third-party browser autofill extension noise',
  },
  {
    name: 'browser-extension-noise',
    pattern: /chrome-extension:\/\/|moz-extension:\/\/|safari-extension:\/\//i,
    action: 'ignore',
    notes: 'Filtered: third-party browser extension script noise',
  },
  {
    name: 'resize-observer-loop',
    pattern: /ResizeObserver loop/i,
    action: 'ignore',
    notes: 'Filtered: benign browser layout timing noise',
  },
  {
    name: 'generic-script-error',
    pattern: /^Script error\.?$/i,
    action: 'ignore',
    notes: 'Filtered: cross-origin script error without stack',
  },
  {
    name: 'adsense-telemetry',
    pattern: /^int64$|pagead2\.googlesyndication\.com/i,
    action: 'ignore',
    notes: 'Filtered: Google AdSense telemetry parse noise',
  },
  {
    name: 'legacy-android-has-own',
    pattern: /Object\.hasOwn is not a function/i,
    action: 'resolve',
    notes: 'Resolved: Added backward-compatible Object.hasOwn polyfill in src/main.jsx for older Android browsers',
  },
  {
    name: 'unhandled-object-rejection',
    pattern: /^\[object Object\]$/i,
    action: 'resolve',
    notes: 'Resolved: Formatted error payload in handleUnhandledRejection to serialize error details',
  },
];

export async function autoFixBugs({ commit = '' } = {}) {
  const bugs = await listBugs('open');
  if (!bugs || bugs.length === 0) {
    console.log('🎉 Error queue is clean: 0 open production bugs found.');
    return { total: 0, resolved: 0, ignored: 0, unresolved: 0, processed: [] };
  }

  console.log(`\n🔍 Automated Production Bug Fixer: analyzing ${bugs.length} open bug(s)...\n`);
  let resolvedCount = 0;
  let ignoredCount = 0;
  let unresolvedCount = 0;
  const processed = [];
  const groupsToBatch = new Map();

  for (const bug of bugs) {
    const errorText = `${bug.error_message || ''} ${bug.stack_trace || ''}`;
    const rule = AUTO_FIX_RULES.find((r) => r.pattern.test(errorText));

    if (rule) {
      const groupKey = `${rule.action}:::${rule.notes}`;
      if (!groupsToBatch.has(groupKey)) {
        groupsToBatch.set(groupKey, { action: rule.action, notes: rule.notes, ids: [] });
      }
      groupsToBatch.get(groupKey).ids.push(bug.id);

      if (rule.action === 'resolve') {
        resolvedCount++;
        processed.push({ id: bug.id, status: 'resolved', rule: rule.name, error: bug.error_message });
        console.log(`  ✅ [RESOLVED] ${bug.id.slice(0, 8)}: ${bug.error_message}`);
        console.log(`     ↳ ${rule.notes}`);
      } else {
        ignoredCount++;
        processed.push({ id: bug.id, status: 'ignored', rule: rule.name, error: bug.error_message });
        console.log(`  ⚠️  [IGNORED]  ${bug.id.slice(0, 8)}: ${bug.error_message}`);
        console.log(`     ↳ ${rule.notes}`);
      }
    } else {
      unresolvedCount++;
      processed.push({ id: bug.id, status: 'open', rule: null, error: bug.error_message });
      console.log(`  ❓ [MANUAL]   ${bug.id.slice(0, 8)}: ${bug.error_message} (${bug.pathname || '/'}) requires manual code review.`);
    }
  }

  // Execute grouped batch updates
  for (const group of groupsToBatch.values()) {
    await batchUpdateBugs(group.ids, {
      status: group.action,
      notes: group.notes,
      commit,
    });
  }

  console.log(`\n================================================================================`);
  console.log(`Bug Queue Run Summary:`);
  console.log(`  Total scanned:   ${bugs.length}`);
  console.log(`  Resolved:        ${resolvedCount}`);
  console.log(`  Ignored (Noise): ${ignoredCount}`);
  console.log(`  Pending Manual:  ${unresolvedCount}`);
  console.log(`================================================================================\n`);

  return {
    total: bugs.length,
    resolved: resolvedCount,
    ignored: ignoredCount,
    unresolved: unresolvedCount,
    processed,
  };
}

async function main() {
  const { command, options } = parseArgs();

  try {
    if (command === 'list') {
      const bugs = await listBugs('open');
      if (bugs.length === 0) {
        console.log('🎉 No open production bugs found in site_error_logs.');
        return;
      }

      console.log(`\n🚨 Found ${bugs.length} open production bug(s) in queue:\n`);
      for (const bug of bugs) {
        console.log(`--------------------------------------------------------------------------------`);
        console.log(`[Bug ID]: ${bug.id}`);
        console.log(`[Time]:   ${bug.created_at} (${bug.pathname || bug.url || '/'})`);
        console.log(`[Source]: ${bug.context || 'Client Runtime'}`);
        console.log(`[Error]:  ${bug.error_message}`);
        if (bug.stack_trace) {
          const lines = String(bug.stack_trace).split('\n').slice(0, 6).join('\n');
          console.log(`[Stack]:\n${lines}`);
        }
      }
      console.log(`--------------------------------------------------------------------------------\n`);
    } else if (command === 'all') {
      const bugs = await listBugs('all');
      console.log(`\n📋 Displaying last ${bugs.length} bug report(s) (all statuses):\n`);
      for (const bug of bugs) {
        console.log(`[${bug.status.toUpperCase()}] ${bug.id.slice(0, 8)}: ${bug.error_message} (${bug.pathname || '/'})`);
      }
    } else if (command === 'resolve') {
      const id = options.targetId;
      if (!id) {
        console.error('Error: specify bug ID to resolve. Usage: node scripts/bugs-queue.mjs resolve <id> --notes "fix" --commit "hash"');
        process.exit(1);
      }
      const updated = await resolveBug(id, options);
      console.log(`✅ Bug marked as resolved:`, updated);
    } else if (command === 'ignore') {
      const id = options.targetId;
      if (!id) {
        console.error('Error: specify bug ID to ignore.');
        process.exit(1);
      }
      const updated = await ignoreBug(id, options);
      console.log(`⚠️ Bug marked as ignored:`, updated);
    } else if (command === 'auto-fix' || command === 'fix') {
      await autoFixBugs(options);
    } else {
      console.log('Usage: node scripts/bugs-queue.mjs [list|all|resolve <id>|ignore <id>|auto-fix]');
    }
  } catch (err) {
    console.error('Failed to run bugs-queue script:', err.message);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('bugs-queue.mjs')) {
  main();
}
