const PHONE_AUTH_EMAIL_DOMAIN = 'phone.jobsinvizag.in';

/** Normalize Indian mobile numbers to E.164 (+91…). */
export const normalizeStudentPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  if (digits.length === 13 && digits.startsWith('091')) {
    return `+91${digits.slice(3)}`;
  }

  if (String(value || '').trim().startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }

  return '';
};

export const isValidStudentPhone = (value) => {
  const normalized = normalizeStudentPhone(value);
  return /^\+91[6-9]\d{9}$/.test(normalized);
};

export const isEmailIdentifier = (value) => String(value || '').includes('@');

/** Internal Supabase email for phone-based student accounts (users sign in with phone + password). */
export const phoneToAuthEmail = (phone) => {
  const normalized = normalizeStudentPhone(phone);
  if (!normalized) {
    return '';
  }
  const digits = normalized.replace(/\D/g, '');
  return `${digits}@${PHONE_AUTH_EMAIL_DOMAIN}`;
};

export const resolveStudentSignInCredentials = ({ identifier, password }) => {
  const trimmed = String(identifier || '').trim();
  if (!trimmed) {
    throw new Error('Enter your email or mobile number.');
  }

  if (isEmailIdentifier(trimmed)) {
    return { email: trimmed.toLowerCase(), password, phone: null };
  }

  const phone = normalizeStudentPhone(trimmed);
  if (!isValidStudentPhone(phone)) {
    throw new Error('Enter a valid 10-digit Indian mobile number or email address.');
  }

  return {
    email: phoneToAuthEmail(phone),
    password,
    phone,
  };
};

/** Map email or registered phone to the Supabase auth email used at sign-in. */
export const resolveStudentLoginEmail = async (supabase, identifier) => {
  const trimmed = String(identifier || '').trim();
  if (!trimmed) {
    throw new Error('Enter your email or mobile number.');
  }

  if (isEmailIdentifier(trimmed)) {
    return trimmed.toLowerCase();
  }

  const phone = normalizeStudentPhone(trimmed);
  if (!isValidStudentPhone(phone)) {
    throw new Error('Enter a valid 10-digit Indian mobile number or email address.');
  }

  if (supabase) {
    const { data, error } = await supabase.rpc('resolve_student_login_email', { p_phone: phone });
    if (error) {
      throw error;
    }
    if (data) {
      return data;
    }
  }

  return phoneToAuthEmail(phone);
};
