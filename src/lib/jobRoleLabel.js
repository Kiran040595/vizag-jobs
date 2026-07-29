/**
 * Turn noisy SEO job titles into short role labels for student targeting.
 *
 * Examples:
 * - "Java Back End Developer Jobs in Vizag at Shvintech | Fresher | Apply Now"
 *   → "Java Back End Developer"
 * - "Sales Executive (Vizag)" → "Sales Executive"
 */

const TRAILING_CTA_RE =
  /\s*[|–—-]\s*(?:fresher|experienced|experience|apply\s*now|walk[\s-]?in|immediate\s*joiner|hot\s*job)\b.*$/i;

const JOBS_IN_LOCATION_RE =
  /\s+jobs?\s+in\s+(?:vizag|visakhapatnam|vishakhapatnam|andhra\s*pradesh|ap)\b.*$/i;

const AT_COMPANY_RE =
  /\s+at\s+[A-Za-z0-9][\w&.'’\- ]{1,80}$/i;

const LOCATION_PAREN_RE =
  /\s*\((?:vizag|visakhapatnam|vishakhapatnam|remote|hybrid)\)\s*$/i;

const LEADING_LOCATION_RE =
  /^(?:vizag|visakhapatnam|vishakhapatnam)\s+/i;

const TRAILING_JOBS_WORD_RE = /\s+jobs?\s*$/i;

const PIPE_SEGMENT_JUNK_RE =
  /^(?:fresher|experienced|experience|apply\s*now|walk[\s-]?in|hot\s*job|urgent|immediate)$/i;

const MAX_ROLE_CHARS = 56;

const collapseSpaces = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const stripPipeJunk = (value) => {
  const parts = String(value || '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !PIPE_SEGMENT_JUNK_RE.test(part));
  return parts[0] || '';
};

/**
 * Extract a clean human role label from a job title or role string.
 * Returns '' if nothing useful remains.
 */
export const cleanJobRoleLabel = (raw, maxLength = MAX_ROLE_CHARS) => {
  let text = collapseSpaces(raw);
  if (!text) {
    return '';
  }

  text = stripPipeJunk(text);
  text = text.replace(TRAILING_CTA_RE, '');
  text = text.replace(JOBS_IN_LOCATION_RE, '');
  text = text.replace(AT_COMPANY_RE, '');
  text = text.replace(LOCATION_PAREN_RE, '');
  text = text.replace(LEADING_LOCATION_RE, '');
  text = text.replace(TRAILING_JOBS_WORD_RE, '');
  text = text.replace(/\s*[|–—-]\s*$/g, '');
  text = text.replace(/\.{2,}$/g, '');
  text = collapseSpaces(text);

  // Drop leftover "Jobs in …" mid-string fragments if still present.
  const jobsInIdx = text.search(/\bjobs?\s+in\b/i);
  if (jobsInIdx > 8) {
    text = collapseSpaces(text.slice(0, jobsInIdx));
  }

  if (text.length > maxLength) {
    const cut = text.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    text = collapseSpaces(lastSpace > 20 ? cut.slice(0, lastSpace) : cut);
  }

  // Avoid keeping ultra-generic leftovers.
  if (/^(?:job|jobs|opening|openings|hiring|vacancy|vacancies)$/i.test(text)) {
    return '';
  }

  return text;
};

/** True when the string still looks like a scraped SEO title, not a short role. */
export const looksLikeSeoJobTitle = (raw) => {
  const text = String(raw || '');
  return (
    /\bjobs?\s+in\b/i.test(text) ||
    /\|\s*(?:fresher|experienced|apply\s*now)\b/i.test(text) ||
    /\bat\s+[A-Za-z].{2,}\|\s*/i.test(text) ||
    text.length > MAX_ROLE_CHARS + 10
  );
};
