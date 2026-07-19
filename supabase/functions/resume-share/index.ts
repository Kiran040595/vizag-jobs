import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const RESUME_BUCKET = 'student-resumes';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

function textResponse(message: string, status = 400) {
  return new Response(message, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function fileNameFromPath(path: string) {
  const base = path.split('/').pop() || 'resume';
  return base.replace(/[^\w.\-]+/g, '_') || 'resume';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return textResponse('Method not allowed.', 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!supabaseUrl || !serviceRole) {
    return textResponse('Resume sharing is not configured.', 500);
  }

  const url = new URL(req.url);
  const token = (url.searchParams.get('t') || url.searchParams.get('token') || '').trim();
  if (!UUID_RE.test(token)) {
    return textResponse('Invalid or missing resume link.', 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: application, error } = await supabaseAdmin
    .from('job_applications')
    .select('resume_path')
    .eq('resume_share_token', token)
    .maybeSingle();

  if (error) {
    console.error('resume-share lookup failed:', error.message);
    return textResponse('Could not resolve resume link.', 500);
  }

  const resumePath = String(application?.resume_path || '').trim();
  if (!resumePath) {
    return textResponse('No resume is available for this link.', 404);
  }

  // Fresh short-lived URL on every click so Excel links never "expire".
  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(resumePath, 60 * 60, {
      download: fileNameFromPath(resumePath),
    });

  if (signError || !signed?.signedUrl) {
    console.error('resume-share sign failed:', signError?.message);
    return textResponse('Could not open resume file.', 500);
  }

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: signed.signedUrl,
      'Cache-Control': 'no-store',
    },
  });
});
