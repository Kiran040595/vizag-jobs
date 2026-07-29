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
    payload = null;
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
  const payload = await postResumeApi('/api/resume/upload-url', {
    fileName: file.name,
    fileSize: file.size,
    contentType,
  });

  const uploadUrl = payload.uploadUrl;
  const resumePath = payload.resumePath;
  if (!uploadUrl || !resumePath) {
    throw new Error('Could not prepare resume upload.');
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': payload.contentType || contentType || 'application/octet-stream',
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Resume upload failed (${uploadResponse.status}).`);
  }

  return resumePath;
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
