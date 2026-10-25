/**
 * Admin User Credentials & Account Status Utilities
 */

export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export const MIN_PASSWORD_LENGTH = 6;

/**
 * Validates inputs when updating user credentials.
 * @param {{ newEmail?: string, newPassword?: string }} payload
 * @returns {{ valid: boolean, error?: string, cleanEmail?: string, cleanPassword?: string }}
 */
export function validateCredentialsUpdate({ newEmail, newPassword } = {}) {
  const cleanEmail = typeof newEmail === 'string' ? newEmail.trim() : '';
  const cleanPassword = typeof newPassword === 'string' ? newPassword.trim() : '';

  if (!cleanEmail && !cleanPassword) {
    return {
      valid: false,
      error: 'Please enter a new email address or password to update.',
    };
  }

  if (cleanEmail) {
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return {
        valid: false,
        error: 'Please enter a valid email address (e.g. name@domain.com).',
      };
    }
  }

  if (cleanPassword) {
    if (cleanPassword.length < MIN_PASSWORD_LENGTH) {
      return {
        valid: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      };
    }
  }

  return {
    valid: true,
    cleanEmail: cleanEmail ? cleanEmail.toLowerCase() : undefined,
    cleanPassword: cleanPassword || undefined,
  };
}

/**
 * Generates a strong, user-friendly temporary password.
 * Formatted like 'Vizag#2026!7x' for readability and security.
 */
export function generateSuggestedPassword(prefix = 'Vizag') {
  const years = ['2026', '2027'];
  const symbols = ['@', '#', '$', '!', '&'];
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';

  const randomYear = years[Math.floor(Math.random() * years.length)];
  const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
  let randomTail = '';
  for (let i = 0; i < 3; i++) {
    randomTail += chars[Math.floor(Math.random() * chars.length)];
  }

  return `${prefix}${randomSymbol}${randomYear}${randomTail}`;
}

/**
 * Formats account credentials into a clean message for WhatsApp / Email sharing.
 */
export function formatLoginCredentialsForSharing({
  displayName = 'User',
  role = 'student',
  email = '',
  password = '',
  siteUrl = 'https://vizagjobs.in',
} = {}) {
  const loginPath = role === 'employer' ? '/employers/login' : '/students/login';
  const fullLoginUrl = `${siteUrl.replace(/\/$/, '')}${loginPath}`;
  const roleLabel = role === 'employer' ? 'Employer Portal' : 'Student Portal';

  const lines = [
    `🔐 Vizag Jobs — Account Login Details`,
    `Hello ${displayName},`,
    `Your ${roleLabel} account credentials have been configured:`,
    ``,
    `📧 Login Email: ${email}`,
  ];

  if (password) {
    lines.push(`🔑 Password: ${password}`);
  }

  lines.push(
    ``,
    `🔗 Login here: ${fullLoginUrl}`,
    `Please sign in and change your password after logging in if required.`,
    `Need help? Reply to this message.`
  );

  return lines.join('\n');
}

/**
 * Formats a timestamp into human readable date & time for admin status inspection.
 */
export function formatAuthTimestamp(isoString) {
  if (!isoString) return 'Never';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'Invalid date';

    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return 'Invalid date';
  }
}
