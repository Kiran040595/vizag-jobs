import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-fetch-jobs-cron-secret',
  'Access-Control-Max-Age': '86400',
};

const WORKFLOW_FILE = 'youtube-short-manual.yml';
const DEFAULT_REPO = 'Kiran040595/vizag-jobs';
const DEFAULT_REF = 'develop';

type RequestBody = {
  privacy?: string;
  skip_if_exists?: boolean;
  publish?: boolean;
};

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

function parseBody(value: unknown): RequestBody {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as RequestBody;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
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

  let body: RequestBody = {};
  try {
    body = parseBody(await req.json());
  } catch {
    body = {};
  }

  const privacy = ['public', 'unlisted', 'private'].includes(String(body.privacy || ''))
    ? String(body.privacy)
    : 'unlisted';
  const skipIfExists = body.skip_if_exists === true;
  const publish = body.publish !== false;

  const dispatchUrl = `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
  const ghRes = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'jobsinvizag-trigger-youtube-short',
    },
    body: JSON.stringify({
      ref,
      inputs: {
        privacy,
        skip_if_exists: skipIfExists,
        publish,
      },
    }),
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

  const actionsUrl = `https://github.com/${repo}/actions/workflows/${WORKFLOW_FILE}`;

  return jsonResponse({
    ok: true,
    queued: true,
    message: publish
      ? 'YouTube Short upload started on GitHub Actions. It usually takes 2–5 minutes.'
      : 'YouTube Short dry run started on GitHub Actions.',
    actions_url: actionsUrl,
    privacy,
    skip_if_exists: skipIfExists,
    publish,
    workflow: WORKFLOW_FILE,
    ref,
  });
});
