import { getJobDetailPath } from './jobRoutes.js';
import {
  displayCompanyName,
  displayJobType,
  displayLocation,
  sanitizeJsonLdJobPosting,
} from './jobDisplayLabels.js';
import { resolveJobExperienceForDisplay } from './jobRecordInference.js';

const SCHEMA_CONTEXT = 'https://schema.org/';
const DEFAULT_SITE_URL = 'https://jobsinvizag.in';
/** Central Visakhapatnam GPO pin — used when listing has no explicit postal code. */
const VIZAG_DEFAULT_POSTAL_CODE = '530001';
/** Default listing window when no explicit expiry is stored. */
const DEFAULT_VALID_DAYS = 30;

const buildAbsoluteUrl = (path, siteUrl) => {
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  if (!path) {
    return base;
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

const EMPLOYMENT_TYPE_MAP = [
  { pattern: /\b(full[\s-]?time|fulltime)\b/i, value: 'FULL_TIME' },
  { pattern: /\b(part[\s-]?time|parttime)\b/i, value: 'PART_TIME' },
  { pattern: /\b(contract|contractor|freelance)\b/i, value: 'CONTRACTOR' },
  { pattern: /\b(temp|temporary)\b/i, value: 'TEMPORARY' },
  { pattern: /\b(intern|internship|trainee)\b/i, value: 'INTERN' },
  { pattern: /\b(volunteer)\b/i, value: 'VOLUNTEER' },
  { pattern: /\b(per[\s-]?diem)\b/i, value: 'PER_DIEM' },
];

const REMOTE_PATTERN = /\b(remote|work from home|wfh|hybrid)\b/i;

const normalizeText = (value, fallback = '') => {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value).trim();
};

const pick = (job, ...keys) => {
  for (const key of keys) {
    const value = job?.[key];
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }
  return null;
};

const stripMarkdownForPlainText = (markdown, maxLength = 5000) => {
  const text = normalizeText(markdown)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#>*_~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return '';
  }

  return maxLength > 0 && text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

const visibleTextLength = (html) =>
  String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;

export const mapEmploymentType = (jobType) => {
  const normalized = normalizeText(jobType);
  if (!normalized) {
    return 'FULL_TIME';
  }

  for (const { pattern, value } of EMPLOYMENT_TYPE_MAP) {
    if (pattern.test(normalized)) {
      return value;
    }
  }

  return 'OTHER';
};

const parseSalaryAmount = (salaryText) => {
  const text = normalizeText(salaryText).toLowerCase();
  if (!text || /negotiable|not disclosed|as per/i.test(text)) {
    return null;
  }

  const lakhRange = text.match(
    /(\d+(?:\.\d+)?)\s*l?\s*-\s*(\d+(?:\.\d+)?)\s*l(?:akh|pa|acs?)?\b/i,
  );
  if (lakhRange) {
    const min = Number(lakhRange[1]) * 100000;
    const max = Number(lakhRange[2]) * 100000;
    return { min, max, unitText: 'YEAR' };
  }

  const lakhSingle = text.match(/(\d+(?:\.\d+)?)\s*l(?:akh|pa|acs?)?\b/i);
  if (lakhSingle) {
    const min = Number(lakhSingle[1]) * 100000;
    return { min, max: min, unitText: 'YEAR' };
  }

  const kRange = text.match(/(\d+(?:\.\d+)?)\s*k?\s*-\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (kRange) {
    const min = Number(kRange[1]) * 1000;
    const max = Number(kRange[2]) * 1000;
    return { min, max, unitText: 'MONTH' };
  }

  const kSingle = text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kSingle) {
    const min = Number(kSingle[1]) * 1000;
    return { min, max: min, unitText: 'MONTH' };
  }

  const plainMatch = text.match(/(\d{4,7})(?:\s*-\s*(\d{4,7}))?/);
  if (plainMatch) {
    const min = Number(plainMatch[1]);
    const max = plainMatch[2] ? Number(plainMatch[2]) : min;
    const unitText = min >= 100000 ? 'YEAR' : 'MONTH';
    return { min, max, unitText };
  }

  const inrRange = text.match(
    /₹?\s*(\d{1,3}(?:,\d{3})+|\d+)\s*(?:-|to)\s*₹?\s*(\d{1,3}(?:,\d{3})+|\d+)/i,
  );
  if (inrRange) {
    const min = Number(inrRange[1].replace(/,/g, ''));
    const max = Number(inrRange[2].replace(/,/g, ''));
    if (min > 0 && max >= min) {
      const unitText = min >= 100000 ? 'YEAR' : 'MONTH';
      return { min, max, unitText };
    }
  }

  return null;
};

export const buildBaseSalary = (salaryText) => {
  const parsed = parseSalaryAmount(salaryText);
  if (!parsed) {
    return null;
  }

  const value =
    parsed.min === parsed.max
      ? {
          '@type': 'QuantitativeValue',
          value: parsed.min,
          unitText: parsed.unitText,
        }
      : {
          '@type': 'QuantitativeValue',
          minValue: parsed.min,
          maxValue: parsed.max,
          unitText: parsed.unitText,
        };

  return {
    '@type': 'MonetaryAmount',
    currency: 'INR',
    value,
  };
};

/** Try salary column, then description / short text (for GSC baseSalary coverage). */
export const resolveBaseSalary = (job, extraText = '') => {
  const direct = buildBaseSalary(pick(job, 'salary'));
  if (direct) {
    return direct;
  }

  const blobs = [
    pick(job, 'description'),
    pick(job, 'shortDescription', 'short_description'),
    extraText,
  ].filter(Boolean);

  for (const blob of blobs) {
    const parsed = buildBaseSalary(stripMarkdownForPlainText(blob, 8000));
    if (parsed) {
      return parsed;
    }
  }

  return null;
};

const extractPostalCodeFromText = (text) => {
  const match = String(text || '').match(/\b(5[0-3]\d{4})\b/);
  return match?.[1] || null;
};

/** Ensure jobLocation.address includes postalCode (GSC recommendation). */
export const enrichJobLocation = (jobLocation, job) => {
  const fallback = buildJobLocation(job);
  const base =
    jobLocation && typeof jobLocation === 'object' && !Array.isArray(jobLocation)
      ? { ...jobLocation }
      : { ...fallback };

  const rawAddress =
    base.address && typeof base.address === 'object' && !Array.isArray(base.address)
      ? { ...base.address }
      : { ...fallback.address };

  const address = {
    '@type': 'PostalAddress',
    addressLocality: rawAddress.addressLocality || fallback.address.addressLocality,
    addressRegion: rawAddress.addressRegion || fallback.address.addressRegion || 'Andhra Pradesh',
    addressCountry: rawAddress.addressCountry || fallback.address.addressCountry || 'IN',
    ...rawAddress,
    '@type': 'PostalAddress',
  };

  if (!address.postalCode) {
    address.postalCode =
      extractPostalCodeFromText(pick(job, 'location')) ||
      extractPostalCodeFromText(pick(job, 'description')) ||
      VIZAG_DEFAULT_POSTAL_CODE;
  }

  if (!address.streetAddress && fallback.address.streetAddress) {
    address.streetAddress = fallback.address.streetAddress;
  }

  return {
    '@type': 'Place',
    ...base,
    address,
  };
};

const isPastIso = (value) => {
  const iso = toIsoDate(value);
  if (!iso) {
    return false;
  }
  return new Date(iso).getTime() <= Date.now();
};

/**
 * Google flags published jobs whose validThrough is in the past while JobPosting
 * markup remains live ("Expired jobs are still live"). For active listings without
 * an explicit expires_at, keep validThrough in the future at render time.
 */
export const resolveValidThrough = (storedValidThrough, job) => {
  const explicitExpiry = toIsoDate(pick(job, 'expiresAt', 'expires_at'));
  if (explicitExpiry) {
    return explicitExpiry;
  }

  const storedIso = toIsoDate(storedValidThrough);
  if (storedIso && !isPastIso(storedIso)) {
    return storedIso;
  }

  return buildValidThrough(job);
};

const finalizeJobPostingSchema = (schema, job) => {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (schema.jobLocationType !== 'TELECOMMUTE') {
    schema.jobLocation = enrichJobLocation(schema.jobLocation, job);
  } else if (schema.jobLocation) {
    schema.jobLocation = enrichJobLocation(schema.jobLocation, job);
  }

  if (!schema.baseSalary) {
    const resolved = resolveBaseSalary(job, schema.description);
    if (resolved) {
      schema.baseSalary = resolved;
    }
  }

  schema.validThrough = resolveValidThrough(schema.validThrough, job);

  return schema;
};

const toIsoDate = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

const addDays = (isoDate, days) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

export const buildValidThrough = (job) => {
  const expiresAt = pick(job, 'expiresAt', 'expires_at');
  const expiresIso = toIsoDate(expiresAt);
  if (expiresIso) {
    return expiresIso;
  }

  const postedAt = pick(job, 'postedAt', 'posted_at');
  const postedIso = toIsoDate(postedAt);
  if (postedIso) {
    const postedPlusWindow = addDays(postedIso, DEFAULT_VALID_DAYS);
    if (postedPlusWindow && !isPastIso(postedPlusWindow)) {
      return postedPlusWindow;
    }
  }

  return addDays(new Date().toISOString(), DEFAULT_VALID_DAYS);
};

const isRemoteWorkMode = (job) => {
  const workMode = normalizeText(pick(job, 'workMode', 'work_mode'));
  const location = normalizeText(pick(job, 'location'));
  return REMOTE_PATTERN.test(workMode) || REMOTE_PATTERN.test(location);
};

const buildJobLocation = (job) => {
  const location = normalizeText(pick(job, 'location'), 'Visakhapatnam');
  const locality =
    /vizag|visakhapatnam/i.test(location) ? 'Visakhapatnam' : location.split(',')[0]?.trim() || 'Visakhapatnam';

  return {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      streetAddress: locality,
      addressLocality: locality,
      addressRegion: 'Andhra Pradesh',
      addressCountry: 'IN',
      postalCode:
        extractPostalCodeFromText(location) ||
        extractPostalCodeFromText(pick(job, 'description')) ||
        VIZAG_DEFAULT_POSTAL_CODE,
    },
  };
};

const buildHiringOrganization = (job, siteUrl) => {
  const company = displayCompanyName(pick(job, 'company'));
  const logo = pick(job, 'companyLogoUrl', 'company_logo_url', 'companyLogo');
  const sourceUrl = pick(job, 'sourceUrl', 'source_url');

  const org = {
    '@type': 'Organization',
    name: company,
  };

  if (logo) {
    org.logo = /^https?:\/\//i.test(logo)
      ? logo
      : `${String(siteUrl).replace(/\/+$/, '')}${logo.startsWith('/') ? logo : `/${logo}`}`;
  }

  if (sourceUrl && /^https?:\/\//i.test(sourceUrl)) {
    org.sameAs = sourceUrl;
  } else if (siteUrl) {
    org.sameAs = siteUrl;
  }

  return org;
};

const buildDescriptionHtml = (job) => {
  const description = pick(job, 'description');
  const shortDescription = pick(job, 'shortDescription', 'short_description');
  const responsibilities = pick(job, 'responsibilities');
  const eligibility = pick(job, 'eligibility');
  const skills = pick(job, 'skills');
  const company = displayCompanyName(pick(job, 'company'));
  const title = normalizeText(pick(job, 'title'), 'Job opening');
  const location = displayLocation(pick(job, 'location'));
  const experience = resolveJobExperienceForDisplay(job);
  const jobType = displayJobType(pick(job, 'jobType', 'job_type'));

  const escape = (s) =>
    String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&(?!(amp|lt|gt|quot);)/g, '&amp;');

  const splitList = (value) => {
    if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean);
    return String(value || '')
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
  };

  const main = stripMarkdownForPlainText(description, 8000);
  const short = stripMarkdownForPlainText(shortDescription, 1000);

  const parts = [];
  if (main) parts.push(`<p>${escape(main)}</p>`);
  if (short && short !== main) parts.push(`<p>${escape(short)}</p>`);

  const respList = splitList(responsibilities);
  if (respList.length > 0) {
    parts.push(
      `<h3>Key Responsibilities</h3><ul>${respList
        .map((r) => `<li>${escape(r)}</li>`)
        .join('')}</ul>`,
    );
  }

  const eligList = splitList(eligibility);
  if (eligList.length > 0) {
    parts.push(
      `<h3>Who Can Apply</h3><ul>${eligList
        .map((r) => `<li>${escape(r)}</li>`)
        .join('')}</ul>`,
    );
  }

  const skillList = splitList(skills);
  if (skillList.length > 0) {
    parts.push(
      `<h3>Skills</h3><p>${skillList.map(escape).join(', ')}</p>`,
    );
  }

  const total = parts.join('');
  if (visibleTextLength(total) >= 50) {
    return total;
  }

  const fallbackBits = [
    `${title} at ${company} in ${location}, Andhra Pradesh, India.`,
    experience ? `Experience required: ${experience}.` : '',
    jobType ? `Employment type: ${jobType}.` : '',
    'Apply now via Vizag Jobs to find more job opportunities in Visakhapatnam.',
  ].filter(Boolean);

  const fallbackHtml = `<p>${escape(fallbackBits.join(' '))}</p>`;
  const combined = `${total}${fallbackHtml}`;
  if (visibleTextLength(combined) >= 50) {
    return combined;
  }

  return null;
};

const buildIdentifier = (job) => {
  const company = displayCompanyName(pick(job, 'company'));
  const slug = normalizeText(pick(job, 'slug'));
  const id = pick(job, 'id');

  return {
    '@type': 'PropertyValue',
    name: company,
    value: slug || id || company,
  };
};

const mergeStoredJsonLd = (stored, job, { siteUrl, canonicalUrl }) => {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return null;
  }

  const title = normalizeText(stored.title || pick(job, 'title'));
  const description =
    normalizeText(stored.description) || buildDescriptionHtml(job) || normalizeText(pick(job, 'shortDescription', 'short_description'));

  if (!title || !description) {
    return null;
  }

  const merged = {
    '@context': SCHEMA_CONTEXT,
    '@type': 'JobPosting',
    ...stored,
    title,
    description,
    datePosted: toIsoDate(stored.datePosted || pick(job, 'postedAt', 'posted_at')) || new Date().toISOString(),
    validThrough: resolveValidThrough(stored.validThrough, job),
    employmentType: stored.employmentType || mapEmploymentType(pick(job, 'jobType', 'job_type')),
    hiringOrganization: stored.hiringOrganization || buildHiringOrganization(job, siteUrl),
    jobLocation: stored.jobLocation || buildJobLocation(job),
    identifier: stored.identifier || buildIdentifier(job),
    url: canonicalUrl,
    directApply: Boolean(pick(job, 'applyLink', 'apply_link')),
  };

  if (isRemoteWorkMode(job)) {
    merged.jobLocationType = stored.jobLocationType || 'TELECOMMUTE';
    merged.applicantLocationRequirements = stored.applicantLocationRequirements || {
      '@type': 'Country',
      name: 'India',
    };
  }

  return sanitizeJsonLdJobPosting(finalizeJobPostingSchema(merged, job), job);
};

const buildFromColumns = (job, { siteUrl, canonicalUrl }) => {
  const title = normalizeText(pick(job, 'title'));
  const description = buildDescriptionHtml(job);

  if (!title || !description) {
    return null;
  }

  const schema = {
    '@context': SCHEMA_CONTEXT,
    '@type': 'JobPosting',
    title,
    description,
    datePosted: toIsoDate(pick(job, 'postedAt', 'posted_at')) || new Date().toISOString(),
    validThrough: buildValidThrough(job),
    employmentType: mapEmploymentType(pick(job, 'jobType', 'job_type')),
    hiringOrganization: buildHiringOrganization(job, siteUrl),
    jobLocation: buildJobLocation(job),
    identifier: buildIdentifier(job),
    url: canonicalUrl,
    directApply: Boolean(normalizeText(pick(job, 'applyLink', 'apply_link'))),
  };

  if (isRemoteWorkMode(job)) {
    schema.jobLocationType = 'TELECOMMUTE';
    schema.applicantLocationRequirements = {
      '@type': 'Country',
      name: 'India',
    };
  }

  return sanitizeJsonLdJobPosting(finalizeJobPostingSchema(schema, job), job);
};

/**
 * Build a Google-compliant JobPosting JSON-LD object.
 * Prefers persisted Gemini output (jsonLd / json_ld), else builds from job columns.
 */
export const buildJobPostingSchema = (job, options = {}) => {
  if (!job || typeof job !== 'object') {
    return null;
  }

  const siteUrl = options.siteUrl || DEFAULT_SITE_URL;
  const canonicalPath = options.canonicalPath || getJobDetailPath(job);
  const canonicalUrl = options.canonicalUrl || buildAbsoluteUrl(canonicalPath, siteUrl);

  const stored = pick(job, 'jsonLd', 'json_ld');
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    const merged = mergeStoredJsonLd(stored, job, { siteUrl, canonicalUrl });
    if (merged) {
      return merged;
    }
  }

  return buildFromColumns(job, { siteUrl, canonicalUrl });
};

export const isJobExpired = (job) => {
  const expiresAt = pick(job, 'expiresAt', 'expires_at');
  if (!expiresAt) {
    return false;
  }
  const expires = new Date(expiresAt);
  return !Number.isNaN(expires.getTime()) && expires.getTime() < Date.now();
};
