import { resolveResumeContentType, validateResumeFile } from '../lib/studentResumeFile';
import { isR2ResumePath } from '../lib/resumeStoragePath';
import { supabase } from '../lib/supabaseClient';

const RESUME_BUCKET = 'student-resumes';

export { resolveResumeContentType, validateResumeFile } from '../lib/studentResumeFile';
export {
  isR2ResumePath,
  resumeOwnerUserId,
  toR2ObjectKey,
  toR2ResumePath,
} from '../lib/resumeStoragePath';

const getAccessToken = async () => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) {
    throw new Error('You must be signed in.');
  }

  return token;
};

const postResumeApi = async (path, body) => {
  const token = await getAccessToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON response, ignore
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Resume request failed (${response.status}).`);
  }

  return payload || {};
};

const createR2SignedUrl = async (resumePath, expiresIn = 3600) => {
  const payload = await postResumeApi('/api/resume/signed-url', {
    resumePath,
    expiresIn,
  });
  return payload.signedUrl || '';
};

export const uploadStudentResume = async (file, userId) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  if (!userId) {
    throw new Error('You must be signed in.');
  }

  const validationError = validateResumeFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const contentType = resolveResumeContentType(file.name, file.type);

  // 1. Attempt Cloudflare R2 upload via API worker if available
  try {
    const payload = await postResumeApi('/api/resume/upload-url', {
      fileName: file.name,
      fileSize: file.size,
      contentType,
    });

    const uploadUrl = payload?.uploadUrl;
    const resumePath = payload?.resumePath;
    if (uploadUrl && resumePath) {
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': payload.contentType || contentType || 'application/octet-stream',
        },
        body: file,
      });

      if (uploadResponse.ok) {
        return resumePath;
      }
    }
  } catch (r2Error) {
    console.warn(
      'Cloudflare R2 resume upload unavailable, falling back to Supabase storage:',
      r2Error instanceof Error ? r2Error.message : r2Error,
    );
  }

  // 2. Fallback to Supabase Storage bucket 'student-resumes'
  const fileExt = file.name.split('.').pop() || 'pdf';
  const filePath = `${userId}/${Date.now()}.${fileExt}`;

  const { data, error: uploadError } = await supabase.storage
    .from(RESUME_BUCKET)
    .upload(filePath, file, {
      upsert: true,
      contentType,
    });

  if (uploadError) {
    throw new Error(`Resume upload failed: ${uploadError.message}`);
  }

  return data?.path || filePath;
};

export const createResumeSignedUrl = async (resumePath, expiresIn = 3600) => {
  if (!resumePath) {
    return '';
  }

  if (isR2ResumePath(resumePath)) {
    return createR2SignedUrl(resumePath, expiresIn);
  }

  if (!supabase) {
    return '';
  }

  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(resumePath, expiresIn);

  if (error) {
    throw new Error(error.message);
  }

  return data?.signedUrl || '';
};

export const saveResumePathOnProfile = async (resumePath) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in.');
  }

  const { error } = await supabase
    .from('student_profiles')
    .update({ resume_path: resumePath })
    .eq('user_id', user.id);

  if (error) {
    throw new Error(error.message);
  }
};
