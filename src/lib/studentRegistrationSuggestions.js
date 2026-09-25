import {
  STUDENT_JOB_CATEGORY_OPTIONS,
  resolveTargetJobCategoryToken,
} from './studentCareerPreferences.js';
import { resolveSkillToken } from './studentProfileOptions.js';

const STORAGE_KEY_CUSTOM_SECTORS = 'vizag_custom_job_categories';
const STORAGE_KEY_CUSTOM_SKILLS = 'vizag_custom_skills';
const STORAGE_KEY_CUSTOM_CERTS = 'vizag_custom_certifications';
const STORAGE_KEY_CUSTOM_ROLES = 'vizag_custom_job_roles';

export const POPULAR_CERTIFICATIONS = [
  'AWS Cloud Practitioner / Solutions Architect',
  'Java Full Stack Development',
  'Python for Data Science',
  'React & Node.js Web Development',
  'Tally Prime & GST',
  'Digital Marketing (Google / Meta)',
  'AutoCAD / Drafting',
  'CCNA Networking',
  'Microsoft Azure Fundamentals',
  'Medical Coding & Billing',
  'Data Analytics & Power BI',
  'PLC & Automation',
  'DevOps & Docker',
  'Cyber Security Fundamentals',
];

export const POPULAR_VIZAG_ROLES = [
  'Java Developer',
  'Frontend Developer',
  'Full Stack Developer',
  'Python Developer',
  'React Developer',
  'Software Engineer',
  'Data Analyst',
  'QA / Manual Tester',
  'Automation Tester',
  'UI/UX Designer',
  'DevOps Engineer',
  'Cloud Engineer',
  'Network Engineer',
  'System Administrator',
  'Technical Support Executive',
  'Telecaller / BPO Executive',
  'Customer Support Associate',
  'Business Development Executive',
  'Field Sales Executive',
  'Digital Marketing Specialist',
  'SEO Executive',
  'Content Writer',
  'HR Recruiter',
  'Operations Executive',
  'Mechanical Engineer',
  'Civil Site Engineer',
  'Electrical Engineer',
  'AutoCAD Draughtsman',
  'Quality Control (QC) Inspector',
  'Production Supervisor',
  'Accountant',
  'Tally Operator',
  'Store Incharge',
  'Pharmacist',
  'Medical Representative (MR)',
  'Lab Technician',
  'Medical Coding Specialist',
];

const safeGetItem = (key) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = (key, value) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or private browsing errors
  }
};

/** Load saved custom sectors from storage */
export const loadSavedCustomSectors = () => {
  const raw = safeGetItem(STORAGE_KEY_CUSTOM_SECTORS);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && typeof item.value === 'string' && typeof item.label === 'string')
      .slice(0, 30);
  } catch {
    return [];
  }
};

/** Save a newly added custom sector so future students see it */
export const saveCustomSector = (labelText) => {
  const cleanLabel = String(labelText || '').trim().replace(/\s+/g, ' ');
  if (!cleanLabel || cleanLabel.length < 2) return loadSavedCustomSectors();

  const token = resolveTargetJobCategoryToken(cleanLabel, STUDENT_JOB_CATEGORY_OPTIONS);
  if (!token) return loadSavedCustomSectors();

  // If already in standard preset, no need to store as custom
  if (STUDENT_JOB_CATEGORY_OPTIONS.some((o) => o.value === token)) {
    return loadSavedCustomSectors();
  }

  const existing = loadSavedCustomSectors();
  const filtered = existing.filter((item) => item.value !== token);
  const updated = [{ value: token, label: cleanLabel }, ...filtered].slice(0, 30);

  safeSetItem(STORAGE_KEY_CUSTOM_SECTORS, JSON.stringify(updated));
  return updated;
};

/** Load saved custom skills from storage */
export const loadSavedCustomSkills = () => {
  const raw = safeGetItem(STORAGE_KEY_CUSTOM_SKILLS);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((item) => typeof item === 'string' && item.trim().length > 0).slice(0, 50);
  } catch {
    return [];
  }
};

/** Save a newly added custom skill so future students see it */
export const saveCustomSkill = (rawSkill) => {
  const token = resolveSkillToken(rawSkill);
  if (!token || token.length < 2) return loadSavedCustomSkills();

  const existing = loadSavedCustomSkills();
  const filtered = existing.filter((s) => s !== token);
  const updated = [token, ...filtered].slice(0, 50);

  safeSetItem(STORAGE_KEY_CUSTOM_SKILLS, JSON.stringify(updated));
  return updated;
};

/** Load saved custom certifications from storage */
export const loadSavedCustomCertifications = () => {
  const raw = safeGetItem(STORAGE_KEY_CUSTOM_CERTS);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((item) => typeof item === 'string' && item.trim().length > 0).slice(0, 40);
  } catch {
    return [];
  }
};

/** Save a newly added certification so future students see it */
export const saveCustomCertification = (certName) => {
  const clean = String(certName || '').trim().replace(/\s+/g, ' ');
  if (!clean || clean.length < 2 || clean.toLowerCase() === 'none') {
    return loadSavedCustomCertifications();
  }

  const existing = loadSavedCustomCertifications();
  const filtered = existing.filter((c) => c.toLowerCase() !== clean.toLowerCase());
  const updated = [clean, ...filtered].slice(0, 40);

  safeSetItem(STORAGE_KEY_CUSTOM_CERTS, JSON.stringify(updated));
  return updated;
};

/** Load saved custom roles from storage */
export const loadSavedCustomRoles = () => {
  const raw = safeGetItem(STORAGE_KEY_CUSTOM_ROLES);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((item) => typeof item === 'string' && item.trim().length > 0).slice(0, 40);
  } catch {
    return [];
  }
};

/** Save a newly typed role so future students see it */
export const saveCustomRole = (roleName) => {
  const clean = String(roleName || '').trim().replace(/\s+/g, ' ');
  if (!clean || clean.length < 2) return loadSavedCustomRoles();

  const existing = loadSavedCustomRoles();
  const filtered = existing.filter((r) => r.toLowerCase() !== clean.toLowerCase());
  const updated = [clean, ...filtered].slice(0, 40);

  safeSetItem(STORAGE_KEY_CUSTOM_ROLES, JSON.stringify(updated));
  return updated;
};

/**
 * Filter suggestions with query ranking (prefix matches first, then substring matches).
 */
export const filterSuggestions = (query, items, maxResults = 8) => {
  const cleanQuery = String(query || '').trim().toLowerCase();
  if (!cleanQuery) return [];

  const prefixMatches = [];
  const substringMatches = [];

  for (const item of items) {
    if (!item) continue;
    const text = typeof item === 'string' ? item : item.label || item.role || item.value || '';
    const lower = text.toLowerCase();

    if (lower === cleanQuery) continue; // exact match already typed

    if (lower.startsWith(cleanQuery)) {
      prefixMatches.push(text);
    } else if (lower.includes(cleanQuery)) {
      substringMatches.push(text);
    }

    if (prefixMatches.length + substringMatches.length >= maxResults * 2) {
      break;
    }
  }

  return [...new Set([...prefixMatches, ...substringMatches])].slice(0, maxResults);
};
