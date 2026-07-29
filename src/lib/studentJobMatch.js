import { normalizeSkillValue } from './studentProfileOptions.js';
import {
  parsePreferredLocations,
  parseTargetJobCategories,
  slugifyRoleText,
} from './studentCareerPreferences.js';

/** Max jobs returned by personalized ranking. */
export const JOBS_FOR_YOU_LIMIT = 8;

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const normalizeLocationToken = (value) =>
  normalizeText(value)
    .replace(/visakhapatnam/g, 'vizag')
    .replace(/vishakhapatnam/g, 'vizag')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const LOCATION_ALIASES = {
  vizag: ['vizag', 'visakhapatnam', 'vishakhapatnam'],
  remote: ['remote', 'work from home', 'wfh', 'hybrid'],
};

/** Expand preferred location chips into match tokens. */
export const expandLocationTokens = (locations = []) => {
  const tokens = new Set();
  for (const location of locations) {
    const normalized = normalizeLocationToken(location);
    if (!normalized) continue;
    tokens.add(normalized);
    for (const [key, aliases] of Object.entries(LOCATION_ALIASES)) {
      if (normalized.includes(key) || aliases.some((alias) => normalized.includes(alias))) {
        aliases.forEach((alias) => tokens.add(alias));
      }
    }
  }
  return [...tokens];
};

const toJobSkillTokens = (job) => {
  const fromSkills = String(job?.skills || '')
    .split(/[,|/]/)
    .map((item) => normalizeSkillValue(item))
    .filter(Boolean);

  const haystack = [
    job?.title,
    job?.shortDescription,
    job?.description,
    job?.summary,
  ]
    .map(normalizeText)
    .join(' ');

  const tokens = new Set(fromSkills);
  for (const skill of fromSkills) {
    if (skill && haystack.includes(skill)) {
      tokens.add(skill);
    }
  }
  return tokens;
};

const isJobFresherFriendly = (job) => {
  const value = job?.isFresher;
  if (typeof value === 'boolean') return value;
  const text = normalizeText(value);
  if (text === 'yes' || text === 'true') return true;
  if (text === 'no' || text === 'false') return false;
  return null;
};

const jobRoleSlug = (job) =>
  slugifyRoleText(job?.role || job?.Role || '') || slugifyRoleText(job?.title || '');

const countTokenOverlap = (needle, haystack) => {
  const role = normalizeText(needle);
  if (!role || role.length < 3) {
    return 0;
  }
  const title = normalizeText(haystack);
  if (!title) {
    return 0;
  }
  const roleTokens = role.split(/\s+/).filter((token) => token.length >= 3);
  return roleTokens.filter((token) => title.includes(token)).length;
};

/**
 * Normalize either a DB row (snake_case) or mapped admin profile (camelCase).
 */
export const normalizeStudentMatchProfile = (profile) => {
  if (!profile) {
    return null;
  }

  const skills = Array.isArray(profile.skills)
    ? profile.skills.map(normalizeSkillValue).filter(Boolean)
    : [];

  const targetJobCategories = parseTargetJobCategories(
    profile.target_job_categories ?? profile.targetJobCategories,
  );

  const preferredLocations = parsePreferredLocations(
    profile.preferred_locations ?? profile.preferredLocations,
  );

  const primaryTargetRole = String(
    profile.primary_target_role ?? profile.primaryTargetRole ?? '',
  ).trim();

  const isFresher =
    typeof profile.is_fresher === 'boolean'
      ? profile.is_fresher
      : typeof profile.isFresher === 'boolean'
        ? profile.isFresher
        : null;

  return {
    skills,
    targetJobCategories,
    preferredLocations,
    primaryTargetRole,
    isFresher,
  };
};

/**
 * Score how well a published job fits a student profile.
 * Role matching uses jobs.role (slug) with title-token fallback for legacy data.
 * @returns {{ score: number, reasons: string[] }}
 */
export const scoreJobForStudent = (job, profileInput) => {
  const profile = normalizeStudentMatchProfile(profileInput);
  if (!job || !profile) {
    return { score: 0, reasons: [] };
  }

  let score = 0;
  const reasons = [];

  const roleSlug = jobRoleSlug(job);
  const titleHaystack = [job.title, job.company, job.shortDescription].filter(Boolean).join(' ');

  const primaryRole = profile.primaryTargetRole;
  const primarySlug = slugifyRoleText(primaryRole);
  if (primarySlug && roleSlug && primarySlug === roleSlug) {
    score += 10;
    reasons.push('Primary role match');
  } else if (primaryRole) {
    const roleHits = countTokenOverlap(primaryRole, titleHaystack || job.title);
    if (roleHits > 0) {
      score += Math.min(roleHits, 3);
      reasons.push('Role match');
    }
  }

  let targetExactPoints = 0;
  let targetRelatedPoints = 0;
  for (const target of profile.targetJobCategories) {
    const targetSlug = slugifyRoleText(target);
    if (!targetSlug) continue;

    if (roleSlug && targetSlug === roleSlug) {
      targetExactPoints += 6;
      continue;
    }

    const label = target.replace(/[_-]+/g, ' ');
    const relatedHits = countTokenOverlap(label, titleHaystack || job.title);
    if (relatedHits > 0) {
      targetRelatedPoints += Math.min(relatedHits, 2);
    }
  }

  if (targetExactPoints > 0) {
    const applied = Math.min(targetExactPoints, 12);
    score += applied;
    reasons.push('Target role match');
  } else if (targetRelatedPoints > 0) {
    const applied = Math.min(targetRelatedPoints, 4);
    score += applied;
    reasons.push('Related role match');
  }

  const studentSkills = new Set(profile.skills);
  const jobSkills = toJobSkillTokens(job);
  const skillHaystack = normalizeText(titleHaystack);
  let skillHits = 0;
  for (const skill of studentSkills) {
    if (jobSkills.has(skill) || skillHaystack.includes(skill)) {
      skillHits += 1;
    }
  }
  if (skillHits > 0) {
    score += skillHits * 3;
    reasons.push(skillHits === 1 ? '1 skill match' : `${skillHits} skills match`);
  }

  if (profile.isFresher === true) {
    const fresher = isJobFresherFriendly(job);
    if (fresher === true) {
      score += 3;
      reasons.push('Fresher-friendly');
    } else if (fresher === false) {
      score -= 1;
    }
  }

  const locationTokens = expandLocationTokens(profile.preferredLocations);
  const jobLocation = normalizeLocationToken(job.location);
  if (locationTokens.length > 0 && jobLocation) {
    const locationHit = locationTokens.some(
      (token) => jobLocation.includes(token) || token.includes(jobLocation),
    );
    if (locationHit) {
      score += 2;
      reasons.push('Location match');
    }
  }

  return { score, reasons };
};

/**
 * Rank jobs for a student. Drops zero-score jobs, highest score first.
 * @returns {{ job: object, score: number, reasons: string[] }[]}
 */
export const rankJobsForStudent = (jobs = [], profileInput, limit = JOBS_FOR_YOU_LIMIT) => {
  const profile = normalizeStudentMatchProfile(profileInput);
  if (!profile || !Array.isArray(jobs) || jobs.length === 0) {
    return [];
  }

  return jobs
    .map((job) => {
      const { score, reasons } = scoreJobForStudent(job, profile);
      return { job, score, reasons };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aPosted = Date.parse(a.job?.postedAt || a.job?.posted_at || 0) || 0;
      const bPosted = Date.parse(b.job?.postedAt || b.job?.posted_at || 0) || 0;
      return bPosted - aPosted;
    })
    .slice(0, Math.max(1, limit));
};
