export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx']);

const EXTENSION_CONTENT_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const ALLOWED_CONTENT_TYPES = new Set(Object.values(EXTENSION_CONTENT_TYPES));

const getExtension = (fileName) => {
  const parts = String(fileName || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

export const resolveResumeContentType = (fileName, fileType = '') => {
  const extension = getExtension(fileName);
  const normalizedType = String(fileType || '').trim().toLowerCase();

  if (ALLOWED_CONTENT_TYPES.has(normalizedType)) {
    return normalizedType;
  }

  return EXTENSION_CONTENT_TYPES[extension] || '';
};

export const validateResumeFile = (file) => {
  if (!file) {
    return '';
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
