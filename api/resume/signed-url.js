import { setCors, readJsonBody, sendJson } from '../_lib/http.js';
import { createR2DownloadUrl, getR2Config } from '../_lib/r2.js';
import {
  isR2ResumePath,
  resumeOwnerUserId,
  toR2ObjectKey,
} from '../_lib/resumeStoragePath.js';
import { requireUser } from '../_lib/supabaseAuth.js';

const fileNameFromPath = (resumePath) => {
  const key = toR2ObjectKey(resumePath);
  const base = key.split('/').pop() || 'resume';
  return base.replace(/[^\w.\-]+/g, '_') || 'resume';
};

const canAccessResume = async (client, user, resumePath) => {
  const ownerId = resumeOwnerUserId(resumePath);
  if (ownerId && ownerId === user.id) {
    return true;
  }

  const { data: adminRow } = await client
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminRow?.user_id) {
    return true;
  }

  const { data: applications, error } = await client
    .from('job_applications')
    .select('id')
    .eq('resume_path', resumePath)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(applications?.length);
};

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  if (!getR2Config()) {
    sendJson(res, 503, { error: 'Cloudflare R2 is not configured.' });
    return;
  }

  const auth = await requireUser(req);
  if (auth.error) {
    sendJson(res, auth.status, { error: auth.error });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body.' });
    return;
  }

  const resumePath = String(body?.resumePath || '').trim();
  const expiresIn = Math.min(Math.max(Number(body?.expiresIn) || 3600, 60), 3600);

  if (!isR2ResumePath(resumePath)) {
    sendJson(res, 400, { error: 'Not an R2 resume path.' });
    return;
  }

  try {
    const allowed = await canAccessResume(auth.client, auth.user, resumePath);
    if (!allowed) {
      sendJson(res, 403, { error: 'You do not have access to this resume.' });
      return;
    }

    const objectKey = toR2ObjectKey(resumePath);
    const signedUrl = await createR2DownloadUrl({
      objectKey,
      expiresIn,
      fileName: fileNameFromPath(resumePath),
    });

    sendJson(res, 200, { signedUrl, expiresIn });
  } catch (error) {
    sendJson(res, 500, { error: error?.message || 'Could not create download URL.' });
  }
}
