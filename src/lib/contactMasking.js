/**
 * Contact details masking utilities for candidate privacy in employer views.
 * Masks email and phone numbers until explicitly revealed by an employer.
 */

/**
 * Masks a phone number to protect candidate privacy.
 * Examples:
 *   "+91 9876543210" -> "+91 98••••••10"
 *   "9876543210"     -> "98••••••10"
 *   "+1 5551234567"  -> "+1 55••••••67"
 *
 * @param {string|null|undefined} phone
 * @returns {string}
 */
export function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length <= 4) {
    return '••••••••';
  }

  // 10-digit Indian national number or with country code
  if (digits.length >= 10) {
    const last2 = digits.slice(-2);
    if (digits.length > 10) {
      const countryCode = digits.slice(0, digits.length - 10);
      const national = digits.slice(digits.length - 10);
      const first2 = national.slice(0, 2);
      return `${hasPlus ? '+' : ''}${countryCode} ${first2}••••••${last2}`;
    }
    const first2 = digits.slice(0, 2);
    return `${hasPlus ? '+' : ''}${first2}••••••${last2}`;
  }

  // Fallback for short numbers
  const first2 = digits.slice(0, 2);
  const last2 = digits.slice(-2);
  return `${hasPlus ? '+' : ''}${first2}••••${last2}`;
}

/**
 * Masks an email address to protect candidate privacy while showing domain.
 * Examples:
 *   "kiran.reddy@gmail.com" -> "ki••••••@gmail.com"
 *   "a@example.com"         -> "a••••••@example.com"
 *
 * @param {string|null|undefined} email
 * @returns {string}
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) {
    return trimmed ? '••••••' : '';
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex);

  if (local.length <= 1) {
    return `${local}••••••${domain}`;
  }

  const prefix = local.slice(0, 2);
  return `${prefix}••••••${domain}`;
}
