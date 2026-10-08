import { isAllowedBranch, isAllowedDegree, parseSkillSelection, resolveSkillToken } from './studentProfileOptions.js';
import { normalizeCareerText } from './studentCareerPreferences.js';

export const EDUCATION_STATUSES = ['studying', 'completed'];
export const GENDER_OPTIONS = ['female', 'male', 'other', 'prefer_not_to_say'];
export const listValues = (value) => [...new Set((Array.isArray(value) ? value : String(value || '').split(/[,;\n]/)).map(v => String(v).trim()).filter(Boolean))].slice(0, 16);
export const normalizeCandidateDetails = (profile = {}) => {
  const education_status = profile.education_status || null;
  const gender = profile.gender || null;
  if (education_status && !EDUCATION_STATUSES.includes(education_status)) throw new Error('Select a valid education status.');
  if (gender && !GENDER_OPTIONS.includes(gender)) throw new Error('Select a valid gender option.');
  if (profile.willing_to_relocate != null && typeof profile.willing_to_relocate !== 'boolean') throw new Error('Select a valid relocation preference.');
  return {
    current_city: normalizeCareerText(profile.current_city, 64) || null,
    current_area: normalizeCareerText(profile.current_area, 64) || null,
    education_status, gender,
    willing_to_relocate: profile.willing_to_relocate ?? null,
    interested_roles: listValues(profile.interested_roles).map(v => normalizeCareerText(v, 64)),
  };
};
const requirementSkills = (value) => {
  const raw = listValues(value);
  if (raw.some(skill => !resolveSkillToken(skill))) {
    throw new Error('Each required or preferred skill must be a valid skill (up to 48 characters).');
  }
  return parseSkillSelection(raw);
};

export const normalizeJobRequirements = (values = {}) => {
  const accepted_degrees = listValues(values.accepted_degrees);
  const accepted_branches = listValues(values.accepted_branches);
  if (accepted_degrees.some(v => !isAllowedDegree(v))) throw new Error('Select accepted qualifications from the list.');
  if (accepted_branches.some(v => !isAllowedBranch(v))) throw new Error('Select accepted branches from the list.');
  const required_education_status = values.required_education_status || null;
  if (required_education_status && !EDUCATION_STATUSES.includes(required_education_status)) throw new Error('Select a valid required education status.');
  const experienceLevels = ['fresher', 'experienced'];
  const required_experience = values.required_experience || null;
  if (required_experience && !experienceLevels.includes(required_experience)) throw new Error('Select a valid experience requirement.');
  return {
    accepted_degrees, accepted_branches, required_education_status, required_experience,
    required_skills: requirementSkills(values.required_skills),
    preferred_skills: requirementSkills(values.preferred_skills),
    required_candidate_locations: listValues(values.required_candidate_locations),
    accepts_relocation: values.accepts_relocation === true,
    requirements_verified: values.requirements_verified === true,
  };
};
export const normalizeCandidateLocation = value => String(value || '').trim().toLowerCase().replace(/vish?akhapatnam/g, 'vizag').replace(/[^a-z0-9]+/g, ' ').trim();
const key = value => String(value || '').trim().toLowerCase();
export const evaluateJobEligibility = (job, profile = {}) => {
  const req = normalizeJobRequirements(job);
  if (!req.requirements_verified) return { status: 'unverified', reasons: ['Eligibility not verified'], missing: [] };
  const reasons = [], missing = [];
  const check = (actual, allowed, label) => {
    if (!allowed.length) return;
    if (!actual) missing.push(label);
    else if (!allowed.some(v => key(v) === key(actual))) reasons.push(`${label} does not meet requirements`);
  };
  check(profile.degree, req.accepted_degrees, 'Qualification');
  check(profile.branch, req.accepted_branches, 'Branch / trade');
  check(profile.education_status ?? profile.educationStatus, req.required_education_status ? [req.required_education_status] : [], 'Education status');
  const fresher = profile.is_fresher ?? profile.isFresher;
  check(typeof fresher === 'boolean' ? (fresher ? 'fresher' : 'experienced') : '', req.required_experience ? [req.required_experience] : [], 'Experience');
  const skills = parseSkillSelection(profile.skills);
  if (req.required_skills.length && !skills.length) missing.push('Skills');
  else for (const skill of req.required_skills) if (!skills.includes(skill)) reasons.push(`Required skill: ${skill}`);
  if (req.required_candidate_locations.length) {
    const city = profile.current_city ?? profile.currentCity;
    const area = profile.current_area ?? profile.currentArea;
    const matches = req.required_candidate_locations.some(v => [city, area].filter(Boolean).some(actual => normalizeCandidateLocation(v) === normalizeCandidateLocation(actual)));
    const relocation = profile.willing_to_relocate ?? profile.willingToRelocate;
    if (!matches && !(req.accepts_relocation && relocation === true)) {
      if (!city || (req.accepts_relocation && relocation == null)) missing.push('Current location / relocation preference');
      else reasons.push('Candidate location does not meet requirements');
    }
  }
  return { status: reasons.length ? 'ineligible' : missing.length ? 'needs_information' : 'eligible', reasons, missing };
};

/** Additional admin filters; demographic filters are not used by job eligibility. */
export const matchesCandidateFilters = (student, filters) =>
  Object.entries(filters).every(([field, value]) => {
    if (!value) return true;
    if (field === 'currentCity' || field === 'currentArea') {
      return normalizeCandidateLocation(student[field]).includes(normalizeCandidateLocation(value));
    }
    return String(student[field] ?? '') === value;
  });
