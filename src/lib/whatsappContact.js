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

/** Build a tel: URL so the device dialer opens with this number. */
export const buildPhoneDialUrl = (phone) => {
  const withCountry = normalizeWhatsAppDigits(phone);
  if (!withCountry) {
    return null;
  }

  return `tel:+${withCountry}`;
};

/**
 * Build a professional interview call-letter message to send to candidate via WhatsApp.
 */
export const buildInterviewWhatsAppPassMessage = (options = {}) => {
  const {
    candidateName = 'Candidate',
    jobTitle = 'Position',
    companyName = 'Company',
    interviewDate,
    interviewTime,
    interviewScheduledAt,
    mode,
    interviewMode,
    location,
    interviewLocation,
    instructions,
    interviewInstructions,
  } = options;

  let resolvedDate = interviewDate || '';
  let resolvedTime = interviewTime || '';
  if ((!resolvedDate || !resolvedTime) && interviewScheduledAt) {
    try {
      const d = new Date(interviewScheduledAt);
      if (!Number.isNaN(d.getTime())) {
        if (!resolvedDate) {
          resolvedDate = d.toLocaleDateString('en-IN', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }
        if (!resolvedTime) {
          resolvedTime = d.toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
          });
        }
      }
    } catch {
      // Fallback
    }
  }

  const rawMode = String(interviewMode || mode || 'in_person').toLowerCase();
  const modeLabel =
    rawMode === 'virtual' || rawMode === 'online'
      ? 'Online / Video Call'
      : rawMode === 'telephonic' || rawMode === 'phone'
        ? 'Telephonic Interview'
        : 'In-Person / Office Venue';

  const venue = interviewLocation || location || '';
  const note = interviewInstructions || instructions || '';

  const lines = [
    `*VIZAGJOBS RECRUITMENT — INTERVIEW PASS*`,
    `Hello ${candidateName},`,
    `Congratulations! Your interview for the role of *${jobTitle}* at *${companyName}* has been scheduled:`,
    `📅 *Date:* ${resolvedDate || 'To be confirmed'}`,
    resolvedTime ? `⏰ *Time:* ${resolvedTime}` : null,
    `📍 *Mode:* ${modeLabel}`,
    venue ? `🏢 *Venue / Link:* ${venue}` : null,
    note ? `📝 *Note:* ${note}` : null,
    `Please reply *CONFIRM* to acknowledge your attendance. All the best!`,
    `— VizagJobs Consultancy Team`,
  ].filter(Boolean);

  return lines.join('\n\n');
};

/** Build direct WhatsApp URL for sending an interview pass. Supports both (phone, details) and ({ phone, ...details }) */
export const buildInterviewWhatsAppPassUrl = (phoneOrOptions, maybeDetails) => {
  if (typeof phoneOrOptions === 'object' && phoneOrOptions !== null) {
    const { phone, ...rest } = phoneOrOptions;
    const message = buildInterviewWhatsAppPassMessage(rest);
    return buildWhatsAppContactUrl(phone, message);
  }
  const message = buildInterviewWhatsAppPassMessage(maybeDetails || {});
  return buildWhatsAppContactUrl(phoneOrOptions, message);
};

