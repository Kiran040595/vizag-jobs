import { supabase } from '../lib/supabaseClient';

const RESUME_BUCKET = 'student-resumes';
const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx']);

const getExtension = (fileName) => {
  const parts = String(fileName || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

export const validateResumeFile = (file) => {
  if (!file) {
    return 'Please upload your resume.';
  }

  const extension = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return 'Upload a PDF or Word document (.pdf, .doc, .docx).';
  }

  if (file.size > MAX_RESUME_BYTES) {
    return 'Resume must be 5 MB or smaller.';
  }

  return '';
};

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

  const { error } = await supabase.storage.from(RESUME_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
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
