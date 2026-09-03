export const STUDENT_CONSENT_FIELDS = {
  terms: 'consent_terms_at',
  shareWithEmployers: 'consent_share_with_employers_at',
  accurateInfo: 'consent_accurate_info_at',
  age18: 'consent_age_18_at',
};

export const EMPTY_STUDENT_CONSENTS = {
  terms: false,
  shareWithEmployers: false,
  accurateInfo: false,
  age18: false,
};

export const validateStudentConsents = (consents) => {
  const missing = [];
  if (!consents?.terms) missing.push('Terms of Service and Privacy Policy');
  if (!consents?.shareWithEmployers) missing.push('sharing your profile with matching employers');
  if (!consents?.accurateInfo) missing.push('confirming your information is accurate');
  if (!consents?.age18) missing.push('confirming you are 18 or older');
  if (missing.length > 0) {
    throw new Error(`Please agree to: ${missing.join('; ')}.`);
  }
};

export const hasStudentRegistrationConsents = (profileRow) =>
  Boolean(
    profileRow?.consent_terms_at &&
      profileRow?.consent_share_with_employers_at &&
      profileRow?.consent_accurate_info_at &&
      profileRow?.consent_age_18_at,
  );
