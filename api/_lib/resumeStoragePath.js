export const R2_RESUME_PREFIX = 'r2:';

export const isR2ResumePath = (resumePath) =>
  String(resumePath || '').trim().startsWith(R2_RESUME_PREFIX);

export const toR2ObjectKey = (resumePath) => {
  const path = String(resumePath || '').trim();
  if (!path.startsWith(R2_RESUME_PREFIX)) {
    return path;
  }
  return path.slice(R2_RESUME_PREFIX.length);
};

export const toR2ResumePath = (objectKey) => {
  const key = String(objectKey || '').trim().replace(/^\/+/, '');
  if (!key) {
    return '';
  }
  return key.startsWith(R2_RESUME_PREFIX) ? key : `${R2_RESUME_PREFIX}${key}`;
};

export const resumeOwnerUserId = (resumePath) => {
  const raw = isR2ResumePath(resumePath) ? toR2ObjectKey(resumePath) : String(resumePath || '').trim();
  if (!raw) {
    return '';
  }
  return raw.split('/')[0] || '';
};
