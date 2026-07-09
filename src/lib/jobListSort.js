const toTimestamp = (value) => {
  const ts = Date.parse(value || '');
  return Number.isFinite(ts) ? ts : 0;
};

/**
 * Public job listings: featured jobs first, then most recently featured,
 * then newest posted_at for everything else.
 */
export const sortJobsForPublicDisplay = (jobs) => {
  if (!Array.isArray(jobs) || jobs.length <= 1) {
    return Array.isArray(jobs) ? jobs : [];
  }

  return [...jobs].sort((left, right) => {
    const leftFeatured = Boolean(left.isFeatured);
    const rightFeatured = Boolean(right.isFeatured);
    if (leftFeatured !== rightFeatured) {
      return Number(rightFeatured) - Number(leftFeatured);
    }

    if (leftFeatured && rightFeatured) {
      const featuredDiff = toTimestamp(right.featuredAt) - toTimestamp(left.featuredAt);
      if (featuredDiff !== 0) return featuredDiff;
    }

    const postedDiff = toTimestamp(right.postedAt) - toTimestamp(left.postedAt);
    if (postedDiff !== 0) return postedDiff;

    return String(right.id || '').localeCompare(String(left.id || ''));
  });
};
