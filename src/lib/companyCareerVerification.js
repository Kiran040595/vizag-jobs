export function hasVerifiedCompanyCareers(company) {
  const isDirectoryApproved = company?.isDirectoryApproved ?? company?.is_directory_approved;
  const careersUrl = company?.careersUrl ?? company?.careers_url;
  const verifiedCareersUrl = company?.verifiedCareersUrl ?? company?.verified_careers_url;

  return Boolean(
    isDirectoryApproved &&
    careersUrl &&
    verifiedCareersUrl &&
    verifiedCareersUrl === careersUrl,
  );
}

export function filterVerifiedCareerCompanies(companies) {
  if (!Array.isArray(companies)) return [];
  return companies.filter(hasVerifiedCompanyCareers);
}
