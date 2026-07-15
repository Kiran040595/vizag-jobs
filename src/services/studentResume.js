import { resolveResumeContentType, validateResumeFile } from '../lib/studentResumeFile';
import { supabase } from '../lib/supabaseClient';

const RESUME_BUCKET = 'student-resumes';

const getExtension = (fileName) => {
  const parts = String(fileName || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

export { resolveResumeContentType, validateResumeFile } from '../lib/studentResumeFile';

export const uploadStudentResume = async (file, userId) => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const validationError = validateResumeFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const extension = getExtension(file.name);
  const path = `${userId}/resume-${Date.now()}.${extension}`;
  const contentType = resolveResumeContentType(file.name, file.type);

  const { error } = await supabase.storage.from(RESUME_BUCKET).upload(path, file, {
    upsert: true,
    contentType,
  });

  if (error) {
    throw new Error(error.message);
  }

  return path;
};

export const createResumeSignedUrl = async (resumePath, expiresIn = 3600) => {
  if (!supabase || !resumePath) {
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
