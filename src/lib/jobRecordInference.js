/**
 * Infer/normalize company and experience from job listing fields.
 */

import { PUBLIC_JOB_DISPLAY, isPlaceholderJobValue } from './jobDisplayLabels.js';

const INVALID_COMPANY =
  /^(unknown|naukri|linkedin|confidential|not disclosed|na|n\/a|none|company|employer|hiring)$/i;

const joinList = (value) =>
  Array.isArray(value) ? value.filter(Boolean).join('\n') : String(value || '');

const jobTextBlob = (job = {}) =>
  [
    job.title,
    job.category,
    job.jobType ?? job.job_type,
    job.skills,
    job.shortDescription ?? job.short_description,
    job.description,
    job.experience,
    joinList(job.eligibility),
    joinList(job.responsibilities),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const isUsableCompanyName = (name) => {
  const text = String(name ?? '').trim();
  if (text.length < 2 || text.length > 120) return false;
  if (INVALID_COMPANY.test(text)) return false;
  if (/^posted by\s+/i.test(text)) return false;
  return true;
};

const cleanCompanyCandidate = (raw) => {
  let name = String(raw ?? '').trim();
  name = name.replace(/^posted by\s+/i, '').trim();
  name = name.replace(/\s*\|.*$/, '').trim();
  name = name.replace(/\s*-\s*jobs?.*$/i, '').trim();
  return name;
};

const looksFresher = (job = {}) => {
  const experience = String(job.experience ?? '').trim().toLowerCase();
  const title = String(job.title ?? '').toLowerCase();
  const hay = jobTextBlob(job);

  if (job.is_fresher === true || job.isFresher === true) return true;
  if (/\bfresher\b|\btrainee\b|\bintern\b/.test(experience)) return true;
  if (/\bfresher\b|\btrainee\b|\bintern\b/.test(title)) return true;
  if (/\b0\s*[-–]\s*\d+\s*(?:yr|yrs|year|years)\b/.test(hay)) return true;
  if (/\b0\s*(?:yr|yrs|year|years)\b/.test(hay)) return true;
  if (/\b2024 passout\b|\b2025 passout\b|\bfresh graduate\b/.test(hay)) return true;
  return false;
};

/**
 * @param {object} job
 * @returns {string}
 */
export const inferCompanyFromJob = (job = {}) => {
  const current = cleanCompanyCandidate(job.company);
  if (isUsableCompanyName(current)) return current;

  const jsonLdOrg = job.json_ld?.hiringOrganization;
  const jsonName =
    typeof jsonLdOrg === 'object' && jsonLdOrg && !Array.isArray(jsonLdOrg)
      ? jsonLdOrg.name
      : null;
  if (isUsableCompanyName(jsonName)) return cleanCompanyCandidate(jsonName);

  const sources = [
    job.description,
    job.short_description ?? job.shortDescription,
    job.linkedin_post_text,
    joinList(job.eligibility),
    joinList(job.responsibilities),
  ]
    .filter(Boolean)
    .join('\n');

  const linePatterns = [
    /\[Posted by ([^\]]{2,120})\]/i,
    /(?:^|\n)\*?\*?Company:?\*?\*?\s*([^\n|]+)/i,
    /(?:^|\n)####\s+(.+?)\s*$/m,
    /(?:^|\n)\*\*Company:\*\*\s*([^\n*]+)/i,
    /(?:^|\n)Employer:?\s*([^\n|]+)/i,
    /(?:^|\n)Hiring (?:Company|Organisation|Organization):?\s*([^\n|]+)/i,
    /🏢\s*([^\n#|]+)/,
  ];

  for (const pattern of linePatterns) {
    const match = sources.match(pattern);
    const candidate = cleanCompanyCandidate(match?.[1]);
    if (isUsableCompanyName(candidate)) return candidate;
  }

  for (const match of sources.matchAll(
    /\[([^\]]{2,120})\]\(https:\/\/www\.naukri\.com\/(?!naukri)[a-z0-9-]+-jobs-careers/gi,
  )) {
    const candidate = cleanCompanyCandidate(match[1]);
    if (isUsableCompanyName(candidate)) return candidate;
  }

  return isUsableCompanyName(current) ? current : PUBLIC_JOB_DISPLAY.company;
};

/**
 * @param {string} raw
 * @param {object} [job]
 * @returns {string}
 */
export const normalizeExperienceLabel = (raw, job = {}) => {
  const text = String(raw ?? '').trim();
  if (!text || isPlaceholderJobValue(text)) {
    return inferExperienceFromJob(job);
  }

  if (/\bfresher\b/i.test(text) || /\b0\s*yr/i.test(text) || /^0\s*[-–]/i.test(text)) {
    return 'Fresher';
  }

  const range = text.match(/^(\d+)\s*[-–]\s*(\d+)\s*(?:\+)?\s*(?:yr|yrs|year|years)?\.?$/i);
  if (range) return `${range[1]}-${range[2]} years`;

  const plus = text.match(/^(\d+)\s*\+\s*(?:yr|yrs|year|years)?\.?$/i);
  if (plus) return `${plus[1]}+ years`;

  const single = text.match(/^(\d+)\s*(?:yr|yrs|year|years)\.?$/i);
  if (single) return `${single[1]} years`;

  const min = text.match(/(?:min(?:imum)?\.?)\s*(\d+)\s*(?:\+)?\s*(?:yr|yrs|year|years)/i);
  if (min) return `${min[1]}+ years`;

  return text;
};

/**
 * @param {object} job
 * @returns {string}
 */
export const inferExperienceFromJob = (job = {}) => {
  const current = String(job.experience ?? '').trim();
  if (current && !isPlaceholderJobValue(current)) {
    return normalizeExperienceLabel(current, job);
  }

  if (looksFresher(job)) return 'Fresher';

  const hay = jobTextBlob(job);

  const minExp = hay.match(/\b(?:minimum|min\.?)\s*(\d+)\s*\+?\s*(?:yr|yrs|year|years)\b/i);
  if (minExp) return `${minExp[1]}+ years`;

  const range = hay.match(/\b(\d+)\s*[-–]\s*(\d+)\s*(?:\+)?\s*(?:yr|yrs|year|years)\b/i);
  if (range) return `${range[1]}-${range[2]} years`;

  const experienceLine = hay.match(/(?:^|\s)experience:\s*([^\n.;|]{3,40})/i)?.[1];
  if (experienceLine && /\d/.test(experienceLine)) {
    const normalized = normalizeExperienceLabel(experienceLine, job);
    if (!isPlaceholderJobValue(normalized)) return normalized;
  }

  const single = hay.match(/\b(\d+)\s*\+\s*(?:yr|yrs|year|years)\b/i);
  if (single) return `${single[1]}+ years`;

  const singlePlain = hay.match(/\b(\d+)\s*(?:yr|yrs|year|years)\b/i);
  if (singlePlain) return `${singlePlain[1]} years`;

  if (/\bnot disclosed\b/i.test(hay)) return PUBLIC_JOB_DISPLAY.experience;

  return PUBLIC_JOB_DISPLAY.experience;
};

/**
 * @param {object} record
 * @returns {{ company: string, experience: string }}
 */
export const enrichJobCompanyAndExperience = (record = {}) => {
  const company = inferCompanyFromJob(record);
  const experience = inferExperienceFromJob({ ...record, company });
  return { company, experience };
};
