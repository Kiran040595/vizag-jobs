/**
 * Block publishing scraped/SEO jobs with placeholder company names or aggregate keyword titles.
 * Keep in sync with src/lib/jobPublishQuality.js
 */

import { PUBLIC_JOB_DISPLAY, isPlaceholderJobValue } from './jobDisplayLabels.ts';
import { isUsableCompanyName } from './jobRecordInference.ts';

const INTERVIEW_PLACEHOLDER_RE = /(?:shared|discussed|confirmed)\s+during\s+interview/i;
const AGGREGATE_TITLE_RE =
  /\bjobs?\s+in\s+(?:vizag|visakhapatnam|vishakhapatnam|andhra\s+pradesh)\b/i;
const CAMELCASE_TAG_RE = /[a-z][A-Z][a-zA-Z]{2,}/g;
const SEO_KEYWORD_BLOB_RE =
  /\b(?:artificialintelligence|datacenters?|cloudcomputing|softwareengineering|sustainability)\b/i;

export function isPublishableCompanyName(name: unknown): boolean {
  const text = String(name ?? '').trim();
  if (!isUsableCompanyName(text)) return false;
  if (isPlaceholderJobValue(text)) return false;
  if (text === PUBLIC_JOB_DISPLAY.company) return false;
  if (INTERVIEW_PLACEHOLDER_RE.test(text)) return false;
  return true;
}

export function isLowQualityJobTitle(title: unknown): boolean {
  const text = String(title ?? '').trim();
  if (!text || text.length < 3) return true;

  const low = text.toLowerCase();
  if (AGGREGATE_TITLE_RE.test(low)) return true;

  const hasVizag = /\bvizag\b/i.test(low);
  const hasVsp = /\bvisakhapatnam\b|\bvishakhapatnam\b/i.test(low);
  if (hasVizag && hasVsp) return true;

  if (/\bjobs?\b/i.test(low) && text.includes('&') && (hasVizag || hasVsp)) return true;

  const camelTags = text.match(CAMELCASE_TAG_RE);
  if (camelTags && camelTags.length >= 2) return true;

  if ((text.match(/,/g) || []).length >= 3 && (hasVizag || hasVsp)) return true;

  return false;
}

export function isPublishableJobTitle(title: unknown): boolean {
  const text = String(title ?? '').trim();
  if (!text) return false;
  return !isLowQualityJobTitle(text);
}

export function isPublishableJobLocation(location: unknown): boolean {
  const text = String(location ?? '').trim();
  if (!text || isPlaceholderJobValue(text)) return true;

  if ((text.match(/,/g) || []).length >= 3) return false;

  const camelTags = text.match(CAMELCASE_TAG_RE);
  if (camelTags && camelTags.length >= 2) return false;

  const compact = text.replace(/\s+/g, '');
  if (SEO_KEYWORD_BLOB_RE.test(compact)) return false;

  return true;
}

export function getJobPublishBlockReason(job: Record<string, unknown> = {}): string | null {
  const title = String(job.title ?? '').trim();
  const company = String(job.company ?? '').trim();
  const location = String(job.location ?? '').trim();

  if (!title) return 'missing title';
  if (isLowQualityJobTitle(title)) {
    return 'title looks like a keyword listing, not a specific role';
  }
  if (!company) return 'missing company';
  if (!isPublishableCompanyName(company)) {
    return 'company name is missing or generic';
  }
  if (location && !isPublishableJobLocation(location)) {
    return 'location looks like SEO keywords, not a real place';
  }

  return null;
}

/**
 * After Make SEO, Gemini sometimes overwrites a good scraped title/company/location
 * with keyword-stuffed SEO phrasing that publish quality gates reject. Prefer the
 * original scraped field when the SEO rewrite is not publishable.
 */
export function recoverPublishableFieldsFromOriginal(
  original: Record<string, unknown> = {},
  optimized: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...optimized };

  const optTitle = String(out.title ?? '').trim();
  const origTitle = String(original.title ?? '').trim();
  if (optTitle && isLowQualityJobTitle(optTitle) && origTitle && isPublishableJobTitle(origTitle)) {
    out.title = origTitle;
  }

  const optCompany = String(out.company ?? '').trim();
  const origCompany = String(original.company ?? '').trim();
  if (
    (!optCompany || !isPublishableCompanyName(optCompany)) &&
    origCompany &&
    isPublishableCompanyName(origCompany)
  ) {
    out.company = origCompany;
  }

  const optLocation = String(out.location ?? '').trim();
  const origLocation = String(original.location ?? '').trim();
  if (optLocation && !isPublishableJobLocation(optLocation)) {
    if (origLocation && isPublishableJobLocation(origLocation)) {
      out.location = origLocation;
    } else {
      out.location = 'Visakhapatnam';
    }
  }

  return out;
}

export function isPublishableAutomationJob(job: Record<string, unknown> = {}): boolean {
  return getJobPublishBlockReason(job) === null;
}
