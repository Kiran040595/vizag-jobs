import { resolveResumeContentType, validateResumeFileMeta } from '../_lib/resumeFileMeta.js';
import { setCors, readJsonBody, sendJson } from '../_lib/http.js';
import { createR2UploadUrl, getR2Config } from '../_lib/r2.js';
import { toR2ResumePath } from '../_lib/resumeStoragePath.js';
import { requireUser } from '../_lib/supabaseAuth.js';

const getExtension = (fileName) => {
  const parts = String(fileName || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
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

  const fileName = String(body?.fileName || '').trim();
  const fileSize = Number(body?.fileSize || 0);
  const fileType = String(body?.contentType || body?.fileType || '').trim();

  const validationError = validateResumeFileMeta({ name: fileName, size: fileSize });
  if (validationError) {
    sendJson(res, 400, { error: validationError });
    return;
  }

  const contentType = resolveResumeContentType(fileName, fileType);
  if (!contentType) {
    sendJson(res, 400, { error: 'Upload a PDF or Word document (.pdf, .doc, .docx).' });
    return;
  }

  const extension = getExtension(fileName);
  const objectKey = `${auth.user.id}/resume-${Date.now()}.${extension}`;
  const resumePath = toR2ResumePath(objectKey);

  try {
    const uploadUrl = await createR2UploadUrl({
      objectKey,
      contentType,
      expiresIn: 600,
    });

    sendJson(res, 200, {
      uploadUrl,
      resumePath,
      objectKey,
      contentType,
      expiresIn: 600,
    });
  } catch (error) {
    sendJson(res, 500, { error: error?.message || 'Could not create upload URL.' });
  }
}
