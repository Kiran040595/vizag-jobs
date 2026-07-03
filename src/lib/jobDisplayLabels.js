/**
 * User-friendly labels for missing job metadata on public pages.
 * Raw DB values are unchanged; use these only for display.
 */

const PLACEHOLDER_PATTERN =
  /^(n\/a|na|unknown|not specified|not disclosed|none|negotiable|as per (?:company )?norms?|—|-+|\.)$/i;

export const isPlaceholderJobValue = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return true;
  if (PLACEHOLDER_PATTERN.test(text)) return true;
  if (/^not\s+disclosed$/i.test(text)) return true;
  if (/^experience criteria discussed during interview$/i.test(text)) return true;
  return false;
};

export const PUBLIC_JOB_DISPLAY = {
  company: 'Employer name shared during interview',
  category: 'See role details in the description below',
  jobType: 'Employment type confirmed during interview',
  workMode: 'Work arrangement discussed during interview',
  salary: 'Salary discussed during interview',
  fresherYes: 'Yes — suitable for fresh graduates',
  fresherNo: 'No — prior experience preferred',
  fresherUnset: 'Check eligibility in the job description',
  postedAt: 'Recently posted',
  location: 'Visakhapatnam',
};

const withFallback = (value, fallback) =>
  isPlaceholderJobValue(value) ? fallback : String(value).trim();

export const displayCompanyName = (value) =>
  withFallback(value, PUBLIC_JOB_DISPLAY.company);

export const displayJobCategory = (value) =>
  withFallback(value, PUBLIC_JOB_DISPLAY.category);

export const displayJobType = (value) =>
  withFallback(value, PUBLIC_JOB_DISPLAY.jobType);

export const displayWorkMode = (value) =>
  withFallback(value, PUBLIC_JOB_DISPLAY.workMode);

/** Returns experience text or null — never a generic interview placeholder. */
export const displayExperience = (value) => {
  if (isPlaceholderJobValue(value)) return null;
  const text = String(value ?? '').trim();
  return text || null;
};

export const displaySalary = (value) =>
  withFallback(value, PUBLIC_JOB_DISPLAY.salary);

export const displayLocation = (value) =>
  withFallback(value, PUBLIC_JOB_DISPLAY.location);

export const displayFresher = (value) => {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'yes' || text === 'true') return PUBLIC_JOB_DISPLAY.fresherYes;
  if (text === 'no' || text === 'false') return PUBLIC_JOB_DISPLAY.fresherNo;
  return PUBLIC_JOB_DISPLAY.fresherUnset;
};

export const displayPostedAt = (value, relativeLabel) => {
  if (relativeLabel && !isPlaceholderJobValue(relativeLabel)) return relativeLabel;
  if (value && !isPlaceholderJobValue(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  }
  return PUBLIC_JOB_DISPLAY.postedAt;
};

/** Company name safe for URL slugs — omits placeholders and SEO fallback text. */
export const companyNameForSlug = (value) => {
  const text = String(value ?? '').trim();
  if (!text || isPlaceholderJobValue(text)) return '';
  if (text === PUBLIC_JOB_DISPLAY.company) return '';
  return text;
};

const readOrgName = (org) => {
  if (!org || typeof org !== 'object' || Array.isArray(org)) return '';
  return org.name;
};

/** Normalize JSON-LD JobPosting fields for public SEO output. */
export const sanitizeJsonLdJobPosting = (jsonLd, job = {}) => {
  if (!jsonLd || typeof jsonLd !== 'object' || Array.isArray(jsonLd)) {
    return jsonLd;
  }

  const out = { ...jsonLd };
  const company = displayCompanyName(readOrgName(out.hiringOrganization) || job.company);

  if (out.hiringOrganization && typeof out.hiringOrganization === 'object') {
    out.hiringOrganization = { ...out.hiringOrganization, name: company };
  }

  if (out.identifier && typeof out.identifier === 'object') {
    out.identifier = { ...out.identifier, name: company };
  }

  const experience = job.experience;
  if (isPlaceholderJobValue(out.experienceRequirements)) {
    delete out.experienceRequirements;
  } else if (experience && !isPlaceholderJobValue(experience)) {
    out.experienceRequirements = experience;
  }

  return out;
};

/** Replace N/A-style placeholders in stored job + SEO fields before publish/display. */
export const sanitizeJobSeoRecord = (record = {}) => {
  const out = { ...record };
  out.company = displayCompanyName(record.company);

  if ('category' in record) {
    out.category = displayJobCategory(record.category);
  }

  const jobType = record.job_type ?? record.jobType;
  if (jobType !== undefined) {
    const displayed = displayJobType(jobType);
    if ('job_type' in record) out.job_type = displayed;
    if ('jobType' in record) out.jobType = displayed;
  }

  const workMode = record.work_mode ?? record.workMode;
  if (record.work_mode === null) {
    out.work_mode = null;
    if ('workMode' in record) out.workMode = null;
  } else if (workMode !== undefined) {
    const displayed = displayWorkMode(workMode);
    if ('work_mode' in record) out.work_mode = displayed;
    if ('workMode' in record) out.workMode = displayed;
  }

  out.experience = isPlaceholderJobValue(record.experience)
    ? ''
    : String(record.experience ?? '').trim();

  if (record.salary != null && record.salary !== '') {
    out.salary = displaySalary(record.salary);
  }

  if (record.json_ld) {
    out.json_ld = sanitizeJsonLdJobPosting(record.json_ld, out);
  }

  if (record.jsonLd) {
    out.jsonLd = sanitizeJsonLdJobPosting(record.jsonLd, out);
  }

  if (record.seo_meta && typeof record.seo_meta === 'object') {
    out.seo_meta = { ...record.seo_meta };
    if (record.seo_meta.json_ld) {
      out.seo_meta.json_ld = sanitizeJsonLdJobPosting(record.seo_meta.json_ld, out);
    }
  }

  return out;
};
