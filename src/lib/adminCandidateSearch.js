import { studentSearchBlob } from './adminStudentProfile.js';
import { evaluateJobEligibility, normalizeCandidateLocation } from './candidateEligibility.js';
import { formatSkillLabel } from './studentProfileOptions.js';
import { studentRoleLabels, roleKey } from './studentRoles.js';
import { skillMatchKey } from './skillMatching.js';
import { formatAvailabilityLabel, formatJobCategoryLabel, formatRoleExperienceLabel } from './studentCareerPreferences.js';

const text = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
export const candidateSkillKey = skillMatchKey;
export const qualificationKey = value => text(value).replace(/[.\s]+/g, '');
const unique = (values, key = text) => [...new Map(values.filter(Boolean).map(value => [key(value), value])).values()];
export const candidateSkills = student => unique(student.skills || [], candidateSkillKey);

export const EMPTY_CANDIDATE_FILTERS = {
  search: '', skills: [], skillMode: 'all', degrees: [], roleQuery: '', role: '',
  category: '', branch: '', year: '', experience: '', college: '', hasResume: 'all',
  city: '', area: '', preferredLocation: '', educationStatus: '', relocation: '',
  availability: '', certification: '', accountStatus: 'active', dataStatus: '',
  job: '', jobStatus: 'eligible', sort: 'relevance', talentPool: '',
};

export const TALENT_POOL_OPTIONS = [
  { value: 'delivery', label: '🛵 Delivery Boys & Executives', shortLabel: '🛵 Delivery' },
  { value: 'telecaller', label: '📞 Telecallers & BPO Voice', shortLabel: '📞 Telecaller' },
  { value: 'teacher', label: '👨‍🏫 Teachers & Education', shortLabel: '👨‍🏫 Teachers' },
  { value: 'it_freshers', label: '💻 IT & Software Freshers', shortLabel: '💻 IT Freshers' },
  { value: 'accounts', label: '🏢 Accounts & Office Finance', shortLabel: '🏢 Accounts' },
];

export const MISSING_CANDIDATE_FACTS = {
  missing_skills: 'Skills', missing_role: 'Desired role', missing_qualification: 'Qualification',
  missing_city: 'Current city', missing_education: 'Education status',
  missing_experience: 'Experience', missing_availability: 'Joining availability',
};

export const readCandidateFilters = params => {
  const filters = { ...EMPTY_CANDIDATE_FILTERS, skills: [], degrees: [] };
  for (const field of Object.keys(filters)) {
    if (field === 'skills' || field === 'degrees') continue;
    const value = params.get(field);
    if (value !== null) filters[field] = value;
  }
  filters.search = params.get('search') || params.get('q') || '';
  filters.skills = unique([...params.getAll('skills'), ...params.getAll('skill')].flatMap(value => value.split(',')), candidateSkillKey);
  filters.degrees = unique([...params.getAll('degrees'), ...params.getAll('degree')].flatMap(value => value.split(',')), qualificationKey);
  filters.roleQuery = params.get('roleQuery') || '';
  filters.year = params.get('year') || params.get('batch') || '';
  filters.experience = params.get('experience') || params.get('fresher') || params.get('exp') || '';
  filters.college = params.get('college') || params.get('institution') || '';
  filters.hasResume = params.get('hasResume') || params.get('resume') || 'all';
  if (!['all', 'yes', 'no'].includes(filters.hasResume)) filters.hasResume = 'all';
  filters.city = params.get('city') || params.get('currentCity') || '';
  filters.preferredLocation = params.get('preferredLocation') || params.get('prefLocation') || params.get('workLocation') || '';
  filters.talentPool = params.get('talentPool') || params.get('pool') || '';
  if (!['active', 'inactive', 'all'].includes(filters.accountStatus)) filters.accountStatus = 'active';
  if (!['all', 'any'].includes(filters.skillMode)) filters.skillMode = 'all';
  if (!['eligible', 'needs_information', 'ineligible', 'unverified', 'all'].includes(filters.jobStatus)) filters.jobStatus = 'eligible';
  if (!['relevance', 'newest', 'oldest', 'name'].includes(filters.sort)) filters.sort = 'relevance';
  if (!['', 'missing', 'ready', ...Object.keys(MISSING_CANDIDATE_FACTS)].includes(filters.dataStatus)) filters.dataStatus = '';
  return filters;
};

export const writeCandidateFilters = filters => {
  const params = new URLSearchParams();
  for (const [field, value] of Object.entries(filters)) {
    if (Array.isArray(value)) value.forEach(item => params.append(field, item));
    else if (value && value !== EMPTY_CANDIDATE_FILTERS[field]) params.set(field, value);
  }
  return params;
};

/** Recruiting facts, distinct from the account/consent completeness flag. Never infer missing facts. */
export const candidateMissingFacts = student => [
  !text(student.degree) && 'Qualification',
  !candidateSkills(student).length && 'Skills',
  !studentRoleLabels(student).length && 'Desired role',
  !text(student.roleExperienceLevel) && typeof student.isFresher !== 'boolean' && 'Experience',
  !text(student.currentCity) && 'Current city',
  !text(student.educationStatus) && 'Education status',
  !text(student.availability) && 'Joining availability',
].filter(Boolean);

const queryTerms = query => [...text(query).matchAll(/"([^"]+)"|(\S+)/g)].map(match => match[1] || match[2]);
const matchingDesiredRoles = (student, filters) => {
  const terms = queryTerms(filters.roleQuery);
  return studentRoleLabels(student).filter(role =>
    (!filters.role || roleKey(role) === roleKey(filters.role)) &&
    terms.every(term => roleKey(role).includes(term)));
};
export const candidateMatchesSearch = (student, query) => {
  if (!text(query)) return true;
  const skills = candidateSkills(student).map(candidateSkillKey);
  const location = [student.currentCity, student.currentArea, ...(student.preferredLocations || [])].join(' ');
  const cityAliases = /vizag|visakhapatnam|vishakhapatnam/i.test(location) ? 'vizag visakhapatnam vishakhapatnam' : '';
  const blob = `${studentSearchBlob(student)} ${qualificationKey(student.degree)} ${skills.join(' ')} ${cityAliases}`;
  return queryTerms(query).every(term => blob.includes(term) || skills.includes(candidateSkillKey(term)) || qualificationKey(student.degree) === qualificationKey(term));
};

export const candidateMatchesExperience = (student, value) => {
  if (!value) return true;
  const isFresher = typeof student.isFresher === 'boolean' ? student.isFresher
    : student.roleExperienceLevel ? student.roleExperienceLevel === 'fresher' : null;
  if (value === 'fresher') return isFresher === true;
  if (value === 'experienced') return isFresher === false;
  return student.roleExperienceLevel === value;
};

export const candidateMatchesTalentPool = (student, pool) => {
  if (!pool) return true;
  const categories = student.targetJobCategories || [];
  const roles = studentRoleLabels(student).map((r) => String(r || '').toLowerCase());
  const skills = candidateSkills(student).map((s) => String(s || '').toLowerCase());
  const degree = String(student.degree || '').toLowerCase();
  const certs = String(student.certificationsText || '').toLowerCase();

  if (pool === 'delivery') {
    return (
      categories.includes('delivery_logistics') ||
      roles.some((r) => /delivery|rider|courier|boy/i.test(r)) ||
      skills.some((s) => /delivery|two wheeler|driving|route|parcel|food delivery/i.test(s)) ||
      /driving license/i.test(certs)
    );
  }

  if (pool === 'telecaller') {
    return (
      categories.includes('telecaller_bpo') ||
      roles.some((r) => /telecaller|calling|bpo|voice|customer support/i.test(r)) ||
      skills.some((s) => /telecalling|inbound|outbound|voice process|customer support|telugu fluency/i.test(s))
    );
  }

  if (pool === 'teacher') {
    return (
      categories.includes('teaching_training') ||
      roles.some((r) => /teacher|lecturer|tutor|professor|faculty|instructor/i.test(r)) ||
      skills.some((s) => /teaching|tutoring|lesson planning|classroom/i.test(s)) ||
      /b\.?ed|tet|net|set/i.test(certs)
    );
  }

  if (pool === 'it_freshers') {
    const isTechDegree = /b\.?tech|b\.?e|mca|bca|b\.?sc|m\.?tech/i.test(degree);
    const isFresher = student.isFresher === true || student.roleExperienceLevel === 'fresher';
    const isTechCategory = categories.some((c) => /software|testing|data_analytics/i.test(c));
    const isTechRole = roles.some((r) => /developer|software|engineer|programmer|tester|analyst/i.test(r));
    return (isTechDegree && isFresher) || (isTechCategory && isFresher) || (isTechRole && isFresher);
  }

  if (pool === 'accounts') {
    return (
      categories.includes('accounting_finance') ||
      roles.some((r) => /accountant|tally|finance|audit|billing/i.test(r)) ||
      skills.some((s) => /tally|excel|accounting|gst|finance/i.test(s)) ||
      /b\.?com|bba|mba/i.test(degree)
    );
  }

  return true;
};

export const matchesCandidateRequirements = (student, filters) => {
  if (filters.accountStatus === 'active' && !student.isActive) return false;
  if (filters.accountStatus === 'inactive' && student.isActive) return false;
  if (filters.talentPool && !candidateMatchesTalentPool(student, filters.talentPool)) return false;
  if (!candidateMatchesSearch(student, filters.search)) return false;
  if ((filters.role || filters.roleQuery) && !matchingDesiredRoles(student, filters).length) return false;
  if (filters.category && !student.targetJobCategories?.includes(filters.category)) return false;
  if (filters.degrees.length && !filters.degrees.some(value => qualificationKey(student.degree) === qualificationKey(value))) return false;
  if (filters.branch && text(student.branch) !== text(filters.branch)) return false;
  if (filters.year && String(student.graduationYear || '') !== filters.year) return false;
  if (filters.college && (!text(student.college) || !text(student.college).includes(text(filters.college)))) return false;
  if (filters.hasResume === 'yes' && !student.resumePath) return false;
  if (filters.hasResume === 'no' && student.resumePath) return false;
  if (!candidateMatchesExperience(student, filters.experience)) return false;
  const skills = new Set(candidateSkills(student).map(candidateSkillKey));
  if (filters.skills.length) {
    const matches = filters.skills.map(value => skills.has(candidateSkillKey(value)));
    if (filters.skillMode === 'any' ? !matches.some(Boolean) : !matches.every(Boolean)) return false;
  }
  // Current residence and preferred work locations are different facts.
  if (filters.city && (!text(student.currentCity) || !normalizeCandidateLocation(student.currentCity).includes(normalizeCandidateLocation(filters.city)))) return false;
  if (filters.area && (!text(student.currentArea) || !normalizeCandidateLocation(student.currentArea).includes(normalizeCandidateLocation(filters.area)))) return false;
  if (filters.preferredLocation && (!student.preferredLocations || !student.preferredLocations.some(loc => normalizeCandidateLocation(loc).includes(normalizeCandidateLocation(filters.preferredLocation))))) return false;
  if (filters.educationStatus && student.educationStatus !== filters.educationStatus) return false;
  if (filters.relocation && String(student.willingToRelocate ?? '') !== filters.relocation) return false;
  if (filters.availability && student.availability !== filters.availability) return false;
  if (filters.certification && !queryTerms(filters.certification).every(term => text(student.certificationsText).includes(term))) return false;
  if (filters.dataStatus) {
    const missing = candidateMissingFacts(student);
    if (filters.dataStatus === 'missing' && !missing.length) return false;
    if (filters.dataStatus === 'ready' && missing.length) return false;
    if (MISSING_CANDIDATE_FACTS[filters.dataStatus] && !missing.includes(MISSING_CANDIDATE_FACTS[filters.dataStatus])) return false;
  }
  return true;
};

/** Explain selected matching facts. This is a discovery aid, never an automatic hiring decision. */
export const candidateMatchReasons = (student, filters, job) => {
  const skills = new Set(candidateSkills(student).map(candidateSkillKey));
  const selectedSkills = filters.skills.filter(value => skills.has(candidateSkillKey(value)));
  const reasons = selectedSkills.map(value => `Skill: ${formatSkillLabel(value)}`);
  if (filters.search) reasons.push(`All search terms found: ${filters.search}`);
  if (filters.degrees.length) reasons.push(`Qualification: ${student.degree}`);
  if (filters.role || filters.roleQuery) reasons.push(`Role: ${matchingDesiredRoles(student, filters).join(', ')}`);
  if (filters.college) reasons.push(`College: ${student.college}`);
  if (filters.hasResume === 'yes') reasons.push('Resume attached');
  if (filters.city || filters.area) reasons.push(`Current location: ${[student.currentCity, student.currentArea].filter(Boolean).join(', ')}`);
  if (filters.preferredLocation) reasons.push(`Preferred work location: ${filters.preferredLocation}`);
  if (filters.experience) reasons.push(`Experience: ${student.roleExperienceLabel || (student.isFresher === true ? 'Fresher' : student.isFresher === false ? 'Experienced' : 'Not provided')}`);
  if (filters.availability) reasons.push(`Joining: ${student.availabilityLabel}`);
  if (filters.educationStatus) reasons.push(`Education: ${student.educationStatus}`);
  if (filters.certification) reasons.push(`Certification: ${filters.certification}`);
  if (filters.talentPool) {
    const poolOpt = TALENT_POOL_OPTIONS.find((p) => p.value === filters.talentPool);
    if (poolOpt) reasons.push(`Talent Pool: ${poolOpt.label}`);
  }
  const preferred = unique(job?.preferred_skills || [], candidateSkillKey).filter(value => skills.has(candidateSkillKey(value)));
  for (const skill of preferred) reasons.push(`Preferred job skill: ${formatSkillLabel(skill)}`);
  return { reasons, score: selectedSkills.length + preferred.length };
};

export const findAdminCandidates = (students, filters, job = null) => {
  const jobCounts = { eligible: 0, needs_information: 0, ineligible: 0, unverified: 0 };
  const entries = [];
  for (const student of students) {
    if (!matchesCandidateRequirements(student, filters)) continue;
    const eligibility = filters.job && job ? evaluateJobEligibility(job, student) : null;
    if (eligibility) jobCounts[eligibility.status] += 1;
    if (filters.job && !job) continue;
    if (eligibility && filters.jobStatus !== 'all' && eligibility.status !== filters.jobStatus) continue;
    const match = candidateMatchReasons(student, filters, job);
    entries.push({ student, ...match, eligibility, missingFacts: candidateMissingFacts(student) });
  }
  const time = student => Date.parse(student.createdAt) || 0;
  entries.sort((a, b) => {
    if (filters.sort === 'name') return a.student.fullName.localeCompare(b.student.fullName) || String(a.student.userId).localeCompare(String(b.student.userId));
    if (filters.sort === 'relevance' && a.score !== b.score) return b.score - a.score;
    const byDate = filters.sort === 'oldest' ? time(a.student) - time(b.student) : time(b.student) - time(a.student);
    return byDate || String(a.student.userId).localeCompare(String(b.student.userId));
  });
  return { entries, jobCounts };
};

export const candidateFilterLabels = filters => {
  const labels = [];
  if (filters.talentPool) {
    const poolOpt = TALENT_POOL_OPTIONS.find((p) => p.value === filters.talentPool);
    if (poolOpt) labels.push(`Talent Pool: ${poolOpt.label}`);
  }
  if (filters.search) labels.push(`Search: ${filters.search}`);
  if (filters.skills.length) labels.push(`${filters.skillMode === 'any' ? 'Any' : 'All'} skills: ${filters.skills.map(formatSkillLabel).join(', ')}`);
  if (filters.degrees.length) labels.push(`Qualification: ${filters.degrees.join(' or ')}`);
  for (const [field, label] of [
    ['roleQuery', 'Role contains'], ['role', 'Exact role'], ['category', 'Sector'],
    ['branch', 'Branch'], ['year', 'Batch'], ['college', 'College'],
    ['hasResume', 'Resume'], ['experience', 'Experience'], ['preferredLocation', 'Work location'],
    ['city', 'Current city'], ['area', 'Area'], ['educationStatus', 'Education'],
    ['relocation', 'Relocation'], ['availability', 'Joining'], ['certification', 'Certification'],
    ['dataStatus', 'Profile facts'],
  ]) {
    if (filters[field] && filters[field] !== EMPTY_CANDIDATE_FILTERS[field]) {
      const value = field === 'experience' ? (filters[field] === 'experienced' ? 'Experienced' : formatRoleExperienceLabel(filters[field]))
        : field === 'hasResume' ? (filters[field] === 'yes' ? 'Attached only' : 'Without resume')
        : field === 'availability' ? formatAvailabilityLabel(filters[field])
          : field === 'category' ? formatJobCategoryLabel(filters[field])
            : field === 'relocation' ? filters[field] === 'true' ? 'Yes' : 'No'
              : field === 'dataStatus' ? MISSING_CANDIDATE_FACTS[filters[field]] ? `Missing ${MISSING_CANDIDATE_FACTS[filters[field]]}` : filters[field] === 'missing' ? 'Missing matching details' : 'Matching facts provided'
                : field === 'educationStatus' ? filters[field] === 'studying' ? 'Currently studying' : 'Completed'
                  : filters[field];
      labels.push(`${label}: ${value}`);
    }
  }
  if (filters.accountStatus !== 'active') labels.push(`Accounts: ${filters.accountStatus}`);
  return labels;
};

/** Formats a candidate list into a clean, ready-to-share message for company HR via WhatsApp or Email without requiring company registration. */
export const formatCandidateListForEmployer = (students, title = 'Vizag Jobs - Candidate Shortlist') => {
  if (!students || students.length === 0) return '';
  const header = `📋 ${title}\nTotal Candidates: ${students.length}\n`;
  const items = students.map((s, index) => {
    const qual = [s.degree, s.branch, s.graduationYear ? `Batch ${s.graduationYear}` : ''].filter(Boolean).join(' · ');
    const college = s.college ? ` at ${s.college}` : '';
    const exp = s.roleExperienceLabel || (s.isFresher === true ? 'Fresher' : s.isFresher === false ? 'Experienced' : '');
    const skills = s.skillLabels?.length ? s.skillLabels.join(', ') : (s.skills || []).join(', ');
    const loc = [s.currentCity, s.currentArea].filter(Boolean).join(', ');
    const prefLoc = s.preferredLocations?.length ? s.preferredLocations.join(', ') : '';
    const phoneDigits = s.phone ? s.phone.replace(/\D/g, '') : '';
    const allSkills = (s.skills || []).map((sk) => String(sk).toLowerCase());
    const certsText = String(s.certificationsText || '').toLowerCase();
    const hasBike = allSkills.some((sk) => sk.includes('two wheeler') || sk.includes('driving'));
    const hasLicense = allSkills.some((sk) => sk.includes('license')) || certsText.includes('license');
    const assetStr = [hasBike ? '🛵 Has Two-Wheeler / Bike' : null, hasLicense ? '🪪 Has Driving License' : null].filter(Boolean).join(' | ');
    const lines = [
      `${index + 1}. ${s.fullName || 'Candidate'}${exp ? ` (${exp})` : ''}`,
      `   • Seeking: ${s.primaryTargetRole || 'Not specified'}`,
      qual ? `   • Qualification: ${qual}${college}` : null,
      assetStr ? `   • Vehicle & License: ${assetStr}` : null,
      skills ? `   • Key Skills: ${skills}` : null,
      loc ? `   • Location: ${loc}${prefLoc ? ` (Prefers: ${prefLoc})` : ''}` : (prefLoc ? `   • Preferred Work Location: ${prefLoc}` : null),
      s.availabilityLabel ? `   • Joining: ${s.availabilityLabel}` : null,
      s.expectedSalaryMin || s.expectedSalaryMax ? `   • Expected Salary: ₹${[s.expectedSalaryMin, s.expectedSalaryMax].filter(Boolean).join(' - ₹')}/mo` : null,
      s.phone ? `   • Phone: +91 ${s.phone}` : null,
      phoneDigits ? `   • WhatsApp: https://wa.me/91${phoneDigits}` : null,
      s.resumePath ? '   • 📄 Resume: Available' : '   • 📄 Resume: Not attached',
    ].filter(Boolean);
    return lines.join('\n');
  });
  return `${header}\n${items.join('\n\n')}\n\nShared via Jobs in Vizag (https://vizagjobs.com)`;
};

