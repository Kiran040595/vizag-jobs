import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-fetch-jobs-cron-secret',
  'Access-Control-Max-Age': '86400',
};

const WORKFLOW_FILE = 'auto-naukri-fetch.yml';
const DEFAULT_REPO = 'Kiran040595/vizag-jobs';
const DEFAULT_REF = 'develop';
const ACTIVE_STATUSES = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);
const SUCCESS_WINDOW_MS = 12 * 60 * 60 * 1000;
const DEBOUNCE_MS = 20 * 60 * 1000;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function assertAuthorized(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const cronSecret = Deno.env.get('FETCH_JOBS_CRON_SECRET');
  const altCron = req.headers.get('x-fetch-jobs-cron-secret');
  if (cronSecret && altCron === cronSecret) {
    return { ok: true };
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearer = match?.[1]?.trim() ?? '';

  if (!bearer) {
    return { ok: false, status: 401, message: 'Missing Authorization bearer token.' };
  }

  if (cronSecret && bearer === cronSecret) {
    return { ok: true };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(bearer);
  if (userError || !userData?.user?.id) {
    return { ok: false, status: 401, message: 'Invalid or expired session.' };
  }

  const { data: adminRow, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (adminError) {
    return { ok: false, status: 500, message: 'Could not verify admin access.' };
  }
  if (!adminRow?.user_id) {
    return { ok: false, status: 403, message: 'Admin access required.' };
  }

  return { ok: true };
}

function shouldSkipNaukriDispatch(
  runs: Array<Record<string, unknown>>,
  now = Date.now(),
): { skip: boolean; reason?: string } {
  for (const run of runs) {
    const status = String(run.status || '').toLowerCase();
    const conclusion = String(run.conclusion || '').toLowerCase();
    const created = Date.parse(String(run.created_at || ''));
    const ageMs = Number.isFinite(created) ? now - created : Number.POSITIVE_INFINITY;

    if (ACTIVE_STATUSES.has(status)) {
      return { skip: true, reason: `Naukri workflow already ${status}` };
    }
    if (ageMs >= 0 && ageMs < DEBOUNCE_MS) {
      return { skip: true, reason: 'Naukri workflow already triggered in the last 20 minutes' };
    }
    if (conclusion === 'success' && ageMs >= 0 && ageMs < SUCCESS_WINDOW_MS) {
      return { skip: true, reason: 'Naukri workflow already succeeded in the last 12 hours' };
    }
  }
  return { skip: false };
}

function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'jobsinvizag-dispatch-naukri-workflow',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server misconfigured: missing Supabase credentials.' }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auth = await assertAuthorized(req, supabaseAdmin);
  if (!auth.ok) {
    return jsonResponse({ error: auth.message }, auth.status);
  }

  const token = Deno.env.get('GITHUB_DISPATCH_TOKEN')?.trim();
  const repo = Deno.env.get('GITHUB_REPOSITORY')?.trim() || DEFAULT_REPO;
  const ref = Deno.env.get('GITHUB_WORKFLOW_REF')?.trim() || DEFAULT_REF;

  if (!token) {
    return jsonResponse(
      {
        error:
          'GitHub dispatch is not configured. Add GITHUB_DISPATCH_TOKEN to Supabase Edge Function secrets (fine-grained PAT with Actions: Read and write).',
      },
      503,
    );
  }

  const listUrl =
    `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=8`;
  const listRes = await fetch(listUrl, { headers: githubHeaders(token) });
  if (!listRes.ok) {
    const text = await listRes.text();
    return jsonResponse(
      { error: `GitHub list runs failed (${listRes.status}). ${text.slice(0, 280)}` },
      502,
    );
  }

  const listData = await listRes.json();
  const runs = Array.isArray(listData?.workflow_runs) ? listData.workflow_runs : [];
  const decision = shouldSkipNaukriDispatch(runs);
  const actionsUrl = `https://github.com/${repo}/actions/workflows/${WORKFLOW_FILE}`;

  if (decision.skip) {
    return jsonResponse({
      ok: true,
      queued: false,
      skipped: true,
      reason: decision.reason,
      actions_url: actionsUrl,
      workflow: WORKFLOW_FILE,
      ref,
    });
  }

  const dispatchUrl =
    `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
  const ghRes = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      ...githubHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref }),
  });

  if (!ghRes.ok) {
    const text = await ghRes.text();
    return jsonResponse(
      {
        error: `GitHub workflow dispatch failed (${ghRes.status}). ${text.slice(0, 280)}`,
      },
      502,
    );
  }

  return jsonResponse({
    ok: true,
    queued: true,
    skipped: false,
    message: 'Naukri fetch started on GitHub Actions.',
    actions_url: actionsUrl,
    workflow: WORKFLOW_FILE,
    ref,
  });
});
