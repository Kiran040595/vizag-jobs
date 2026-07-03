const MS_PER_DAY = 24 * 60 * 60 * 1000;

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

/**
 * Derive homepage trust stats from the same published job list shown on the site.
 * @param {Array<{ company?: string, category?: string, postedAt?: string }>} jobs
 */
export const computeSiteStats = (jobs = []) => {
  const now = Date.now();
  const companies = new Set();
  const categories = new Set();
  let newThisWeek = 0;
  let postedToday = 0;

  for (const job of jobs) {
    const company = normalizeKey(job.company);
    if (company) {
      companies.add(company);
    }

    const category = String(job.category || '').trim();
    if (category) {
      categories.add(category);
    }

    const postedAtMs = job.postedAt ? new Date(job.postedAt).getTime() : Number.NaN;
    if (!Number.isNaN(postedAtMs)) {
      if (now - postedAtMs <= 7 * MS_PER_DAY) {
        newThisWeek += 1;
      }
      if (now - postedAtMs <= MS_PER_DAY) {
        postedToday += 1;
      }
    }
  }

  return {
    activeJobs: jobs.length,
    companies: companies.size,
    newThisWeek,
    categories: categories.size,
    postedToday,
  };
};

/** @param {number | null | undefined} value */
export const formatStatCount = (value) => {
  if (value === null || value === undefined) {
    return '—';
  }
  return Number(value).toLocaleString('en-IN');
};
