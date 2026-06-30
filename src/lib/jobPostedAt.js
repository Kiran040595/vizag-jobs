/** Use current server time when a job goes live on the portal. */
export const getSystemPostedAtIso = () => new Date().toISOString();

/**
 * Set `posted_at` (and JSON-LD `datePosted`) to publish time, not the source listing date.
 * @param {Record<string, unknown>} payload
 */
export const applySystemPostedAtToPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const postedAt = getSystemPostedAtIso();
  const next = { ...payload, posted_at: postedAt };

  if (next.json_ld && typeof next.json_ld === 'object' && !Array.isArray(next.json_ld)) {
    next.json_ld = { ...next.json_ld, datePosted: postedAt };
  }

  if (next.seo_meta && typeof next.seo_meta === 'object' && !Array.isArray(next.seo_meta)) {
    const seoMeta = { ...next.seo_meta };
    if (seoMeta.json_ld && typeof seoMeta.json_ld === 'object' && !Array.isArray(seoMeta.json_ld)) {
      seoMeta.json_ld = { ...seoMeta.json_ld, datePosted: postedAt };
    }
    next.seo_meta = seoMeta;
  }

  return next;
};

/**
 * @param {string | undefined} statusOverride
 * @param {string | undefined} currentStatus
 */
export const shouldUseSystemPostedAtOnPublish = (statusOverride, currentStatus) => {
  if (statusOverride !== 'published') {
    return false;
  }
  return normalizeStatus(currentStatus) !== 'published';
};

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();
