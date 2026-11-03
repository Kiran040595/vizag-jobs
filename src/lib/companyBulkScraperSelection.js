export function getBulkScrapeSelection(companies = [], selectedNames = [], isActiveForScrape) {
  const selected = new Set(selectedNames);
  const selectedCompanies = companies.filter((company) => selected.has(company.name));

  if (!isActiveForScrape) {
    return {
      targets: selectedCompanies,
      skippedMissingCareersUrl: [],
    };
  }

  return {
    targets: selectedCompanies.filter((company) => Boolean(company.careersUrl)),
    skippedMissingCareersUrl: selectedCompanies.filter((company) => !company.careersUrl),
  };
}

export function updateCompanyScrapeFlags(companies = [], targetNames = [], isActiveForScrape) {
  const targets = new Set(targetNames);
  return companies.map((company) =>
    targets.has(company.name) ? { ...company, isActiveForScrape } : company,
  );
}

export function buildCompanyScrapeUpdateBatches(
  companyNames = [],
  isActiveForScrape,
  updatedAt,
  batchSize = 250,
) {
  const names = [...new Set(companyNames.map((name) => String(name || '').trim()).filter(Boolean))];
  const batches = [];

  for (let start = 0; start < names.length; start += batchSize) {
    batches.push(names.slice(start, start + batchSize).map((name) => ({
      name,
      is_active_for_scrape: Boolean(isActiveForScrape),
      updated_at: updatedAt,
    })));
  }

  return batches;
}
