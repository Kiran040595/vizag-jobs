/**
 * Branch / discipline detection for processed jobs (processJobData in jobs.js).
 * Used by homepage filters and engineering landing pages.
 */

const jobTextBlob = (job) =>
  [job.title, job.category, job.jobType, job.skills, job.shortDescription, job.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const matchesAny = (hay, keywords) => keywords.some((kw) => hay.includes(kw));

const categoryIncludes = (job, fragments) => {
  const cat = (job.category || '').toLowerCase();
  return fragments.some((f) => cat.includes(f));
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
  if (categoryIncludes(job, ['electrical', 'eee', 'power'])) return true;
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
  if (categoryIncludes(job, ['ece', 'electronics', 'communication', 'embedded'])) return true;
  const hay = jobTextBlob(job);
  if (/\bece\b/.test(hay)) return true;
  return matchesAny(hay, [
    'electronics engineer',
    'electronics and communication',
    'embedded engineer',
    'vlsi',
    'fpga',
    'pcb design',
    'telecom engineer',
  ]);
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
