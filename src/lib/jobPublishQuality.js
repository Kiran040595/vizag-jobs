/**
 * Block publishing scraped/SEO jobs with placeholder company names or aggregate keyword titles.
 * Keep in sync with supabase/functions/_shared/jobPublishQuality.ts
 */

import { PUBLIC_JOB_DISPLAY, isPlaceholderJobValue } from './jobDisplayLabels.js';
import { isUsableCompanyName } from './jobRecordInference.js';

const INTERVIEW_PLACEHOLDER_RE = /(?:shared|discussed|confirmed)\s+during\s+interview/i;
const AGGREGATE_TITLE_RE =
  /\bjobs?\s+in\s+(?:vizag|visakhapatnam|vishakhapatnam|andhra\s+pradesh)\b/i;
const CAMELCASE_TAG_RE = /[a-z][A-Z][a-zA-Z]{2,}/g;
const SEO_KEYWORD_BLOB_RE =
  /\b(?:artificialintelligence|datacenters?|cloudcomputing|softwareengineering|sustainability)\b/i;

/** True when the employer name is a real company, not a Gemini/display fallback. */
export function isPublishableCompanyName(name) {
  const text = String(name ?? '').trim();
  if (!isUsableCompanyName(text)) return false;
  if (isPlaceholderJobValue(text)) return false;
  if (text === PUBLIC_JOB_DISPLAY.company) return false;
  if (INTERVIEW_PLACEHOLDER_RE.test(text)) return false;
  return true;
}

/** True when the title is an SEO aggregate / keyword listing rather than one role. */
export function isLowQualityJobTitle(title) {
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

export function isPublishableJobTitle(title) {
  const text = String(title ?? '').trim();
  if (!text) return false;
  return !isLowQualityJobTitle(text);
}

/** Reject comma-separated hashtag-style location blobs; empty is OK (defaults at insert). */
export function isPublishableJobLocation(location) {
  const text = String(location ?? '').trim();
  if (!text || isPlaceholderJobValue(text)) return true;

  if ((text.match(/,/g) || []).length >= 3) return false;

  const camelTags = text.match(CAMELCASE_TAG_RE);
  if (camelTags && camelTags.length >= 2) return false;

  const compact = text.replace(/\s+/g, '');
  if (SEO_KEYWORD_BLOB_RE.test(compact)) return false;

  return true;
}

/** Returns a human-readable block reason, or null when the job is OK to publish. */
export function getJobPublishBlockReason(job = {}) {
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

export function isPublishableAutomationJob(job = {}) {
  return getJobPublishBlockReason(job) === null;
}
