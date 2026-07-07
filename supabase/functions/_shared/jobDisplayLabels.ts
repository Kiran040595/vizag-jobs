/**
 * User-friendly labels for missing job metadata — edge function copy.
 * Keep in sync with src/lib/jobDisplayLabels.js
 */

const PLACEHOLDER_PATTERN =
  /^(n\/a|na|unknown|not specified|not disclosed|none|negotiable|as per (?:company )?norms?|—|-+|\.)$/i;

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
} as const;

export function isPlaceholderJobValue(value: unknown): boolean {
  const text = String(value ?? '').trim();
  if (!text) return true;
  if (PLACEHOLDER_PATTERN.test(text)) return true;
  if (/^not\s+disclosed$/i.test(text)) return true;
  if (/^experience criteria discussed during interview$/i.test(text)) return true;
  return false;
}

const withFallback = (value: unknown, fallback: string): string =>
  isPlaceholderJobValue(value) ? fallback : String(value).trim();

export const displayCompanyName = (value: unknown): string =>
  withFallback(value, PUBLIC_JOB_DISPLAY.company);

export const displayJobCategory = (value: unknown): string =>
  withFallback(value, PUBLIC_JOB_DISPLAY.category);

export const displayJobType = (value: unknown): string =>
  withFallback(value, PUBLIC_JOB_DISPLAY.jobType);

export const displayWorkMode = (value: unknown): string | null => {
  if (isPlaceholderJobValue(value)) return null;
  const text = String(value ?? '').trim();
  if (!text || text === PUBLIC_JOB_DISPLAY.workMode) return null;
  if (/discussed during interview|confirmed during interview/i.test(text)) return null;
  if (/^at interview$/i.test(text)) return null;
  return text;
};

export const displaySalary = (value: unknown): string =>
  withFallback(value, PUBLIC_JOB_DISPLAY.salary);

export const companyNameForSlug = (value: unknown): string => {
  const text = String(value ?? '').trim();
  if (!text || isPlaceholderJobValue(text)) return '';
  if (text === PUBLIC_JOB_DISPLAY.company) return '';
  return text;
};

const readOrgName = (org: unknown): string => {
  if (!org || typeof org !== 'object' || Array.isArray(org)) return '';
  return String((org as { name?: string }).name ?? '');
};

export function sanitizeJsonLdJobPosting(
  jsonLd: unknown,
  job: Record<string, unknown> = {},
): Record<string, unknown> | null | undefined {
  if (!jsonLd || typeof jsonLd !== 'object' || Array.isArray(jsonLd)) {
    return jsonLd as Record<string, unknown> | null | undefined;
  }

  const out = { ...(jsonLd as Record<string, unknown>) };
  const company = displayCompanyName(readOrgName(out.hiringOrganization) || job.company);

  if (out.hiringOrganization && typeof out.hiringOrganization === 'object') {
    out.hiringOrganization = { ...(out.hiringOrganization as Record<string, unknown>), name: company };
  }

  if (out.identifier && typeof out.identifier === 'object') {
    out.identifier = { ...(out.identifier as Record<string, unknown>), name: company };
  }

  if (isPlaceholderJobValue(out.experienceRequirements)) {
    delete out.experienceRequirements;
  } else {
    const experience = job.experience;
    if (experience && !isPlaceholderJobValue(experience)) {
      out.experienceRequirements = experience;
    } else {
      delete out.experienceRequirements;
    }
  }

  return out;
}

type JobRecord = Record<string, unknown>;

export function sanitizeJobSeoRecord(record: JobRecord = {}): JobRecord {
  const out: JobRecord = { ...record };
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
    const displayed = withFallback(workMode, PUBLIC_JOB_DISPLAY.workMode);
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

  if (record.seo_meta && typeof record.seo_meta === 'object') {
    out.seo_meta = { ...(record.seo_meta as Record<string, unknown>) };
    const meta = record.seo_meta as { json_ld?: unknown };
    if (meta.json_ld) {
      (out.seo_meta as Record<string, unknown>).json_ld = sanitizeJsonLdJobPosting(meta.json_ld, out);
    }
  }

  return out;
}
