export function hasVerifiedCompanyCareers(company) {
  return Boolean(company?.isDirectoryApproved && company?.verifiedCareersUrl &&
    company.verifiedCareersUrl === company.careersUrl);
}
