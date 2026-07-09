export const PENDING_EMPLOYER_COMPANY_KEY = 'vizagjobs:pending-company-name';

export const setPendingEmployerCompanyName = (companyName) => {
  const trimmed = String(companyName || '').trim();
  if (!trimmed) {
    sessionStorage.removeItem(PENDING_EMPLOYER_COMPANY_KEY);
    return;
  }
  sessionStorage.setItem(PENDING_EMPLOYER_COMPANY_KEY, trimmed);
};

export const takePendingEmployerCompanyName = () => {
  try {
    const value = sessionStorage.getItem(PENDING_EMPLOYER_COMPANY_KEY);
    sessionStorage.removeItem(PENDING_EMPLOYER_COMPANY_KEY);
    return value?.trim() || '';
  } catch {
    return '';
  }
};
