const KNOWN_SECTION_HEADINGS = [
  'About the Role',
  'Skills Required',
  'Skills',
  'Key Responsibilities',
  'Responsibilities',
  'Who Can Apply',
  'How to Apply',
  'Why Join',
  'FAQs',
  'FAQ',
];

function normalizeInlineMarkdown(text) {
  let out = text;

  for (const heading of KNOWN_SECTION_HEADINGS) {
    const re = new RegExp(`(#{1,3}\\s+${heading.replace(/\s+/g, '\\s+')})\\s+`, 'gi');
    out = out.replace(re, '$1\n\n');
  }

  out = out.replace(/\s+(#{1,3}\s+[A-Za-z])/g, '\n\n$1');
  out = out.replace(/([.!?])\s+\*\s+/g, '$1\n\n* ');
  out = out.replace(/\n{3,}/g, '\n\n');

  return out.trim();
}

/** Strip source attribution and scrape references from public job copy. */
export function sanitizeJobDescriptionForDisplay(text) {
  if (!text?.trim()) {
    return '';
  }

  let out = text;

  out = out.replace(
    /^\s*(?:#{1,3}\s*)?(?:\*\*)?(?:Source|Job source|Originally posted on|Posted on|Apply via|Scraped from)(?:\*\*)?[:\s].*$/gim,
    '',
  );
  out = out.replace(/^\s*(?:LinkedIn|Naukri|Indeed)(?:\s+(?:Jobs?|Post|listing))?\s*$/gim, '');
  out = out.replace(
    /\[([^\]]*)\]\(\s*https?:\/\/(?:[\w.-]+\.)?(?:linkedin|naukri|indeed)\.com[^)]*\)/gi,
    '$1',
  );
  out = out.replace(/\bhttps?:\/\/(?:[\w.-]+\.)?(?:linkedin|naukri|indeed)\.com\S*/gi, '');
  out = out.replace(/\n{3,}/g, '\n\n');

  return normalizeInlineMarkdown(out);
}

/** SEO descriptions already include ## headings and bullet sections. */
export function looksLikeStructuredJobDescription(text) {
  return /(^|\n)#{1,3}\s+\S/m.test(text || '');
}

export function stripMarkdownForPlainText(text, maxLen = 320) {
  if (!text?.trim()) {
    return '';
  }
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length <= maxLen ? plain : `${plain.slice(0, maxLen - 1).trim()}…`;
}
