/** Extract job slug or id from public job detail paths. */
export const parseJobRouteIdentifier = (pathname = '') => {
  const segmentMatch = pathname.match(/^\/jobs\/[^/]+\/([^/]+)$/);
  if (segmentMatch) {
    return segmentMatch[1];
  }

  const legacyMatch = pathname.match(/^\/job\/([^/]+)$/);
  if (legacyMatch) {
    return legacyMatch[1];
  }

  const directMatch = pathname.match(/^\/jobs\/([^/]+)$/);
  if (directMatch) {
    return directMatch[1];
  }

  return '';
};

/** Extract job id from the internal apply route. */
export const parseApplyRouteJobId = (pathname = '') => {
  const match = pathname.match(/^\/student\/apply\/([^/]+)/);
  return match ? match[1] : '';
};
