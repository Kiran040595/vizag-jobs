import { createClient } from '@supabase/supabase-js';
import { pipelineConfig } from './lib/pipeline-env.mjs';

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

async function listBugs(status = 'open') {
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
      console.log('👉 To enable the database queue, paste the SQL from:');
      console.log('   supabase/migrations/20261015120000_create_site_error_logs.sql into Supabase SQL Editor.');
      return [];
    }
    throw error;
  }

  return data || [];
}

async function resolveBug(id, { notes = 'Resolved by AI agent', commit = '' }) {
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

async function ignoreBug(id, { notes = 'Ignored' }) {
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

async function main() {
  const { command, options } = parseArgs();

  try {
    if (command === 'list') {
      const bugs = await listBugs('open');
      if (bugs.length === 0) {
        console.log('🎉 No open production bugs found in site_error_logs.');
        return;
      }

      console.log(`\n🚨 Found ${bugs.length} open production bug(s):\n`);
      for (const bug of bugs) {
        console.log(`--------------------------------------------------------------------------------`);
        console.log(`[Bug ID]: ${bug.id}`);
        console.log(`[Time]:   ${bug.created_at} (${bug.pathname || bug.url || '/'})`);
        console.log(`[Source]: ${bug.context} | Screen: ${bug.screen_size || 'Unknown'}`);
        console.log(`[Error]:  ${bug.error_message}`);
        if (bug.stack_trace) {
          const lines = bug.stack_trace.split('\n').slice(0, 8).join('\n');
          console.log(`[Stack]:\n${lines}`);
        }
      }
      console.log(`--------------------------------------------------------------------------------\n`);
    } else if (command === 'all') {
      const bugs = await listBugs('all');
      console.log(`\n📋 Displaying last ${bugs.length} bug report(s) (all statuses):\n`);
      for (const bug of bugs) {
        console.log(`[${bug.status.toUpperCase()}] ${bug.id.slice(0, 8)}: ${bug.error_message} (${bug.pathname})`);
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
    } else {
      console.log('Usage: node scripts/bugs-queue.mjs [list|all|resolve <id>|ignore <id>]');
    }
  } catch (err) {
    console.error('Failed to run bugs-queue script:', err.message);
    process.exit(1);
  }
}

main();
