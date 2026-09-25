/** Strip a phone value to digits suitable for wa.me (country code + number, no +). */
export const normalizeWhatsAppDigits = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.length >= 11 && digits.length <= 13) {
    return digits;
  }

  return '';
};

/** Build a WhatsApp chat URL for the given phone number. */
export const buildWhatsAppContactUrl = (phone, message) => {
  const withCountry = normalizeWhatsAppDigits(phone);
  if (!withCountry) {
    return null;
  }

  const base = `https://wa.me/${withCountry}`;
  if (message) {
    return `${base}?text=${encodeURIComponent(message)}`;
  }

  return base;
};
