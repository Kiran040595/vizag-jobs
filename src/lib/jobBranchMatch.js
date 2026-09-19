/**
 * Branch / discipline detection for processed jobs (processJobData in jobs.js).
 * Used by homepage filters and engineering landing pages.
 */

import { containsToken, hasEceRoleEvidence } from './jobCategoryTaxonomy.js';

const jobTextBlob = (job) =>
  [job.title, job.category, job.jobType, job.skills, job.shortDescription, job.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const matchesAny = (hay, keywords) => keywords.some((kw) => containsToken(hay, kw));

const categoryIncludes = (job, fragments) => {
  const cat = (job.category || '').toLowerCase();
  return fragments.some((f) => containsToken(cat, f));
};

export const isCivilRelatedJob = (job) => {
  if (categoryIncludes(job, ['civil', 'construction', 'structural'])) return true;
  const hay = jobTextBlob(job);
  return matchesAny(hay, [
    'civil engineer',
    'civil engineering',
    'structural engineer',
    'construction engineer',
    'site engineer',
    'estimation engineer',
    'quantity survey',
    'autocad civil',
  ]);
};

export const isMechanicalRelatedJob = (job) => {
  if (categoryIncludes(job, ['mechanical', 'production', 'manufacturing'])) return true;
  const hay = jobTextBlob(job);
  return matchesAny(hay, [
    'mechanical engineer',
    'mechanical engineering',
    'hvac engineer',
    'piping engineer',
    'maintenance engineer',
    'production engineer',
    'tool design',
    'autocad mechanical',
    'cnc operator',
    'plant engineer',
  ]);
};

export const isElectricalRelatedJob = (job) => {
  if (categoryIncludes(job, ['electrical', 'eee'])) return true;
  const hay = jobTextBlob(job);
  return matchesAny(hay, [
    'electrical engineer',
    'electrical engineering',
    'eee engineer',
    'power plant',
    'substation',
    'switchgear',
    'plc scada',
    'electrical maintenance',
  ]);
};

export const isEceRelatedJob = (job) => {
  // Soft-skill "communication" and substring "ece" (recently/necessary) must not qualify.
  // A stored "ECE / Electronics" label alone is not enough — historical false
  // positives left that label on unrelated jobs.
  return hasEceRoleEvidence(job);
};

export const isEngineeringRelatedJob = (job) =>
  isCivilRelatedJob(job) ||
  isMechanicalRelatedJob(job) ||
  isElectricalRelatedJob(job) ||
  isEceRelatedJob(job) ||
  matchesAny(jobTextBlob(job), [
    'diploma engineer',
    'graduate engineer trainee',
    'get engineer',
    'instrumentation engineer',
    'project engineer',
    'design engineer',
  ]);

/** @type {Record<string, (job: object) => boolean>} */
export const BRANCH_CATEGORY_MATCHERS = {
  civil: isCivilRelatedJob,
  mechanical: isMechanicalRelatedJob,
  electrical: isElectricalRelatedJob,
  ece: isEceRelatedJob,
  engineering: isEngineeringRelatedJob,
};
