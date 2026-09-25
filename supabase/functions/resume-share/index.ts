import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const RESUME_BUCKET = 'student-resumes';
const R2_RESUME_PREFIX = 'r2:';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

function textResponse(message: string, status = 400) {
  return new Response(message, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function isR2ResumePath(path: string) {
  return path.startsWith(R2_RESUME_PREFIX);
}

function toR2ObjectKey(path: string) {
  return isR2ResumePath(path) ? path.slice(R2_RESUME_PREFIX.length) : path;
}

function fileNameFromPath(path: string) {
  const key = toR2ObjectKey(path);
  const base = key.split('/').pop() || 'resume';
  return base.replace(/[^\w.\-]+/g, '_') || 'resume';
}

function contentTypeForFileName(fileName: string) {
  const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  return CONTENT_TYPES[extension] || 'application/octet-stream';
}

function contentDisposition(fileName: string) {
  const safe = fileName.replace(/"/g, '');
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

function getR2Config() {
  const accountId = Deno.env.get('R2_ACCOUNT_ID')?.trim() || '';
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')?.trim() || '';
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')?.trim() || '';
  const bucket = Deno.env.get('R2_BUCKET_NAME')?.trim() || '';
  const endpoint =
    Deno.env.get('R2_ENDPOINT')?.trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, endpoint };
}

async function downloadFromR2(objectKey: string) {
  const config = getR2Config();
  if (!config) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: 'auto',
  });

  const url = `${config.endpoint.replace(/\/+$/, '')}/${config.bucket}/${objectKey
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

  const response = await client.fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`R2 download failed (${response.status}).`);
  }

  const fileBlob = await response.blob();
  return {
    fileBlob,
    contentType: response.headers.get('content-type') || '',
  };
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

  const fileName = fileNameFromPath(resumePath);
  let fileBlob: Blob;
  let detectedType = '';

  try {
    if (isR2ResumePath(resumePath)) {
      const downloaded = await downloadFromR2(toR2ObjectKey(resumePath));
      fileBlob = downloaded.fileBlob;
      detectedType = downloaded.contentType;
    } else {
      const { data, error: downloadError } = await supabaseAdmin.storage
        .from(RESUME_BUCKET)
        .download(resumePath);

      if (downloadError || !data) {
        console.error('resume-share download failed:', downloadError?.message);
        return textResponse('Could not open resume file.', 500);
      }

      fileBlob = data;
    }
  } catch (downloadError) {
    console.error('resume-share download failed:', (downloadError as Error)?.message);
    return textResponse('Could not open resume file.', 500);
  }

  const headers = {
    ...corsHeaders,
    'Content-Type': detectedType || contentTypeForFileName(fileName),
    'Content-Disposition': contentDisposition(fileName),
    'Cache-Control': 'no-store',
    'Content-Length': String(fileBlob.size),
  };

  if (req.method === 'HEAD') {
    return new Response(null, { status: 200, headers });
  }

  return new Response(fileBlob.stream(), { status: 200, headers });
});
