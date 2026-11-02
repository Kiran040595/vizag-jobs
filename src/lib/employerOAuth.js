export const PENDING_EMPLOYER_COMPANY_KEY = 'vizagjobs:pending-company-name';

export const setPendingEmployerCompanyName = (companyName) => {
  const trimmed = String(companyName || '').trim();
  try {
    if (!trimmed) {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(PENDING_EMPLOYER_COMPANY_KEY);
      }
      return;
    }
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(PENDING_EMPLOYER_COMPANY_KEY, trimmed);
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
};

export const takePendingEmployerCompanyName = () => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return '';
    const value = window.sessionStorage.getItem(PENDING_EMPLOYER_COMPANY_KEY);
    window.sessionStorage.removeItem(PENDING_EMPLOYER_COMPANY_KEY);
    return value?.trim() || '';
  } catch {
    return '';
  }
};
