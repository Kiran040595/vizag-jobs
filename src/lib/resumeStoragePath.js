/** Prefix stored in resume_path for objects in Cloudflare R2. */
export const R2_RESUME_PREFIX = 'r2:';

export const isR2ResumePath = (resumePath) =>
  String(resumePath || '').trim().startsWith(R2_RESUME_PREFIX);

/** Strip `r2:` to get the object key used inside the R2 bucket. */
export const toR2ObjectKey = (resumePath) => {
  const path = String(resumePath || '').trim();
  if (!path.startsWith(R2_RESUME_PREFIX)) {
    return path;
  }
  return path.slice(R2_RESUME_PREFIX.length);
};

/** Build the DB path value for a new R2 upload. */
export const toR2ResumePath = (objectKey) => {
  const key = String(objectKey || '').trim().replace(/^\/+/, '');
  if (!key) {
    return '';
  }
  return key.startsWith(R2_RESUME_PREFIX) ? key : `${R2_RESUME_PREFIX}${key}`;
};

/** Owner user id encoded as the first path segment: `{userId}/resume-….ext`. */
export const resumeOwnerUserId = (resumePath) => {
  const raw = isR2ResumePath(resumePath) ? toR2ObjectKey(resumePath) : String(resumePath || '').trim();
  if (!raw) {
    return '';
  }
  return raw.split('/')[0] || '';
};
