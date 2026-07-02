/**
 * Canonical job categories — edge function copy.
 * Keep in sync with src/lib/jobCategoryTaxonomy.js
 */

import { enrichJobCompanyAndExperience, inferExperienceFromJob, isUsableCompanyName } from './jobRecordInference.ts';

export type JobCategoryDef = {
  id: string;
  value: string;
  label: string;
  aliases: string[];
};

export const JOB_CATEGORIES: JobCategoryDef[] = [
  { id: 'it', value: 'IT & Software', label: 'IT & Software', aliases: ['it', 'software', 'information technology', 'tech', 'developer', 'programming'] },
  { id: 'civil', value: 'Civil Engineering', label: 'Civil Engineering', aliases: ['civil', 'construction', 'structural', 'site engineer'] },
  { id: 'mechanical', value: 'Mechanical Engineering', label: 'Mechanical Engineering', aliases: ['mechanical', 'production', 'manufacturing', 'plant', 'hvac'] },
  { id: 'electrical', value: 'Electrical / EEE', label: 'Electrical / EEE', aliases: ['electrical', 'eee', 'power', 'substation'] },
  { id: 'ece', value: 'ECE / Electronics', label: 'ECE / Electronics', aliases: ['ece', 'electronics', 'embedded', 'communication', 'vlsi', 'telecom'] },
  { id: 'banking', value: 'Banking & Finance', label: 'Banking & Finance', aliases: ['banking', 'finance', 'accountant', 'accounts', 'nbfc', 'insurance'] },
  { id: 'bpo', value: 'BPO / Customer Support', label: 'BPO / Customer Support', aliases: ['bpo', 'customer support', 'call center', 'voice process', 'telecaller'] },
  { id: 'sales', value: 'Sales & Marketing', label: 'Sales & Marketing', aliases: ['sales', 'marketing', 'business development', 'bde', 'digital marketing'] },
  { id: 'hr', value: 'HR & Admin', label: 'HR & Admin', aliases: ['human resources', 'recruitment', 'admin', 'office assistant', 'back office'] },
  { id: 'healthcare', value: 'Healthcare', label: 'Healthcare', aliases: ['healthcare', 'medical', 'nurse', 'pharma', 'hospital', 'lab technician'] },
  { id: 'education', value: 'Education', label: 'Education', aliases: ['education', 'teacher', 'faculty', 'tutor', 'teaching'] },
  { id: 'hospitality', value: 'Hospitality & Retail', label: 'Hospitality & Retail', aliases: ['hospitality', 'hotel', 'retail', 'store', 'restaurant', 'front office'] },
  { id: 'logistics', value: 'Logistics & Supply Chain', label: 'Logistics & Supply Chain', aliases: ['logistics', 'supply chain', 'warehouse', 'delivery', 'driver', 'fleet'] },
  { id: 'general', value: 'General', label: 'General', aliases: ['general', 'other', 'misc'] },
];

export const JOB_CATEGORY_VALUES = JOB_CATEGORIES.map((c) => c.value);
export const GEMINI_CATEGORY_LIST_TEXT = JOB_CATEGORY_VALUES.filter((v) => v !== 'General').join(' | ');

const CATEGORY_BY_VALUE = new Map(JOB_CATEGORIES.map((c) => [c.value.toLowerCase(), c.value]));

const normalize = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const joinList = (value: unknown): string =>
  Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value || '');

type ClassifyInput = {
  title?: string;
  category?: string;
  job_type?: string;
  jobType?: string;
  skills?: string | string[];
  short_description?: string;
  shortDescription?: string;
  description?: string;
  experience?: string;
  eligibility?: string[];
  responsibilities?: string[];
  is_fresher?: boolean;
  isFresher?: boolean | string;
};

export function jobToTextBlob(job: ClassifyInput = {}): string {
  return [
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
}

export function normalizeJobCategory(raw: unknown): string | null {
  const text = normalize(raw);
  if (!text) return null;

  const exact = CATEGORY_BY_VALUE.get(text);
  if (exact) return exact;

  for (const cat of JOB_CATEGORIES) {
    if (cat.aliases.some((alias) => text === alias || text.includes(alias))) {
      return cat.value;
    }
  }

  for (const cat of JOB_CATEGORIES) {
    if (text.includes(cat.value.toLowerCase())) return cat.value;
  }

  return null;
}

const matchesAny = (hay: string, keywords: string[]) => keywords.some((kw) => hay.includes(kw));

const SENIOR_EXPERIENCE = /\b(?:[3-9]|[1-9]\d+)\s*\+?\s*(?:yr|yrs|year|years)\b/i;

const IT_KEYWORDS = [
  'software', 'developer', 'programmer', 'react', 'java', 'python', 'javascript',
  'full stack', 'devops', 'data engineer', 'data scientist', 'it support', 'system admin',
];

const CATEGORY_SIGNALS: { value: string; keywords: string[] }[] = [
  { value: 'Civil Engineering', keywords: ['civil engineer', 'civil engineering', 'structural engineer', 'construction engineer', 'site engineer'] },
  { value: 'Mechanical Engineering', keywords: ['mechanical engineer', 'mechanical engineering', 'hvac', 'piping engineer', 'production engineer', 'plant engineer'] },
  { value: 'Electrical / EEE', keywords: ['electrical engineer', 'eee', 'power plant', 'substation', 'switchgear', 'plc', 'scada'] },
  { value: 'ECE / Electronics', keywords: ['ece', 'electronics engineer', 'embedded', 'vlsi', 'fpga', 'telecom engineer', 'pcb'] },
  { value: 'IT & Software', keywords: IT_KEYWORDS },
  { value: 'Banking & Finance', keywords: ['bank', 'nbfc', 'accountant', 'finance executive', 'insurance', 'tally'] },
  { value: 'BPO / Customer Support', keywords: ['bpo', 'customer support', 'call center', 'voice process', 'telecaller'] },
  { value: 'Sales & Marketing', keywords: ['sales executive', 'marketing executive', 'business development', 'bde', 'field sales'] },
  { value: 'HR & Admin', keywords: ['hr executive', 'recruiter', 'talent acquisition', 'admin executive', 'back office'] },
  { value: 'Healthcare', keywords: ['nurse', 'pharmacist', 'lab technician', 'medical officer', 'hospital', 'healthcare'] },
  { value: 'Education', keywords: ['teacher', 'faculty', 'professor', 'tutor', 'academic', 'lecturer'] },
  { value: 'Hospitality & Retail', keywords: ['hotel', 'front office', 'retail', 'store manager', 'cashier', 'hospitality'] },
  { value: 'Logistics & Supply Chain', keywords: ['logistics', 'warehouse', 'supply chain', 'delivery executive', 'driver', 'fleet'] },
];

export function inferIsFresherFromJob(job: ClassifyInput = {}): boolean {
  const experience = String(job.experience ?? '').trim();
  const title = String(job.title ?? '');
  const hay = jobToTextBlob(job);

  if (SENIOR_EXPERIENCE.test(experience) && !/\b0\b/.test(experience)) {
    return false;
  }

  if (job.is_fresher === true) return true;
  const flag = normalize(job.isFresher ?? job.is_fresher);
  if (flag === 'yes' || flag === 'true' || flag === '1') return true;

  const expLow = experience.toLowerCase();
  if (
    /^0\s*[-–]/.test(expLow) ||
    /\bfresher\b/i.test(expLow) ||
    /^0\s+to\s+/i.test(expLow) ||
    /\b0\s*(?:yr|yrs|year|years)\b/i.test(expLow) ||
    /\bentry[\s-]?level\b/i.test(expLow) ||
    /\btrainee\b/i.test(expLow) ||
    /\bintern(?:ship)?\b/i.test(expLow)
  ) {
    return true;
  }

  if (/\bfresher\b|\btrainee\b|\bintern\b|\bgraduate trainee\b/i.test(title)) {
    return true;
  }

  if (
    matchesAny(hay, [
      'fresh graduate', 'freshers only', 'fresher candidate', '0-1 year', '0 to 1 year',
      '2024 passout', '2025 passout', 'no experience required', 'no prior experience',
    ])
  ) {
    return !matchesAny(hay, ['minimum 2 years', 'minimum 3 years', '3+ years', '5+ years', '2-5 years']);
  }

  return false;
}

export function inferJobCategoryFromSignals(job: ClassifyInput = {}): string {
  const fromField = normalizeJobCategory(job.category);
  if (fromField && fromField !== 'General') return fromField;

  const hay = jobToTextBlob(job);
  for (const signal of CATEGORY_SIGNALS) {
    if (matchesAny(hay, signal.keywords)) return signal.value;
  }

  return fromField || 'General';
}

export function classifyJobRecord(record: ClassifyInput = {}): {
  category: string;
  company: string;
  is_fresher: boolean;
  experience: string;
} {
  const geminiCategory = typeof record.category === 'string' ? normalizeJobCategory(record.category) : null;
  const category =
    (geminiCategory && geminiCategory !== 'General' ? geminiCategory : null) ||
    inferJobCategoryFromSignals(record);

  const geminiCompany =
    typeof record.company === 'string' && isUsableCompanyName(record.company)
      ? record.company.trim()
      : null;
  const { company: inferredCompany, experience: inferredExperience } =
    enrichJobCompanyAndExperience(record);
  const company = geminiCompany || inferredCompany;

  const experience =
    typeof record.experience === 'string' && record.experience.trim()
      ? inferExperienceFromJob({ ...record, company, experience: record.experience })
      : inferredExperience;

  const enriched = { ...record, category, company, experience };

  return {
    category,
    company,
    experience,
    is_fresher: inferIsFresherFromJob(enriched),
  };
}
