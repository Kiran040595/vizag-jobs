import { isPlaceholderJobValue, PUBLIC_JOB_DISPLAY } from './jobDisplayLabels.js';
import { buildBaseSalary } from './jobPostingSchema.js';

const SEO_FALLBACK_VALUES = new Set(Object.values(PUBLIC_JOB_DISPLAY));

const VAGUE_INTERVIEW_PHRASE = /discussed during interview|confirmed during interview/i;

/** True when we have a real value to show on listing cards (not SEO placeholders). */
export const isRealCardValue = (value) => {
  const text = String(value ?? '').trim();
  if (!text || isPlaceholderJobValue(text)) return false;
  if (SEO_FALLBACK_VALUES.has(text)) return false;
  if (VAGUE_INTERVIEW_PHRASE.test(text)) return false;
  return true;
};

/** True when salary text has a concrete amount (CTC/LPA/₹), not a generic placeholder. */
export const hasProperSalaryInfo = (value) => {
  const text = String(value ?? '').trim();
  if (!isRealCardValue(text)) return false;
  return Boolean(buildBaseSalary(text));
};

export const cardCompanyName = (value) =>
  isRealCardValue(value) ? String(value).trim() : null;

export const cardSalary = (value) => {
  const text = String(value ?? '').trim();
  return hasProperSalaryInfo(text) ? text : null;
};

export const cardLocation = (value) => {
  const text = String(value ?? '').trim();
  if (!text || isPlaceholderJobValue(text)) return null;
  if (/vizag|visakhapatnam/i.test(text)) return 'Visakhapatnam';
  const locality = text.split(',')[0]?.trim();
  return locality || null;
};

export const cardCategory = (value) => {
  const text = String(value ?? '').trim();
  if (!isRealCardValue(text) || text === 'General') return null;
  return text;
};

export const cardJobType = (value) =>
  isRealCardValue(value) ? String(value).trim() : null;

export const cardWorkMode = (value) => {
  const text = String(value ?? '').trim();
  if (!isRealCardValue(text)) return null;
  if (/^at interview$/i.test(text)) return null;
  return text;
};

export const cardFresher = (value) => {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'yes' || text === 'true') return 'Yes';
  if (text === 'no' || text === 'false') return 'No';
  return null;
};

/**
 * Key job facts for listing cards — only fields with clear, real values.
 * @param {object} job
 * @returns {Array<{ key: string, label: string, value: string }>}
 */
export const buildCardHighlightItems = ({
  category,
  jobType,
  experience,
  isFresher,
  salary,
  workMode,
} = {}) => {
  const items = [];

  const categoryValue = cardCategory(category);
  const jobTypeValue = cardJobType(jobType);
  const experienceText = experience ? String(experience).trim() : '';
  const experienceValue =
    experienceText && isRealCardValue(experienceText) ? experienceText : null;
  const fresherValue = cardFresher(isFresher);
  const salaryValue = cardSalary(salary);
  const workModeValue = cardWorkMode(workMode);

  if (categoryValue) items.push({ key: 'category', label: 'Category', value: categoryValue });
  if (jobTypeValue) items.push({ key: 'jobType', label: 'Job type', value: jobTypeValue });
  if (experienceValue) items.push({ key: 'experience', label: 'Experience', value: experienceValue });
  if (fresherValue) items.push({ key: 'fresher', label: 'Fresher', value: fresherValue });
  if (salaryValue) items.push({ key: 'salary', label: 'Salary', value: salaryValue });
  if (workModeValue) items.push({ key: 'workMode', label: 'Work mode', value: workModeValue });

  return items;
};
