import {
  formatSkillLabel,
  isAllowedBranch,
  isAllowedDegree,
  isAllowedGraduationYear,
  normalizeSkillValue,
  parseSkillSelection,
} from './studentProfileOptions.js';
import { isValidStudentPhone, normalizeStudentPhone } from './studentPhoneAuth.js';

const PLACEHOLDER_NAME = 'your name';

export const mapStudentProfileRow = (row) => {
  if (!row) return null;

  const fullName = String(row.full_name || '').trim();
  const college = String(row.college || '').trim();
  const degree = String(row.degree || '').trim();
  const branch = String(row.branch || '').trim();
  const graduationYear = row.graduation_year ?? null;
  const phone = String(row.phone || '').trim();
  const skills = Array.isArray(row.skills)
    ? row.skills.map(normalizeSkillValue).filter(Boolean)
    : [];
  const certifications = Array.isArray(row.certifications)
    ? row.certifications.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const certificationsText = certifications.join('; ');
  const isFresher = row.is_fresher !== false;

  const profileComplete =
    Boolean(fullName) &&
    fullName.toLowerCase() !== PLACEHOLDER_NAME &&
    Boolean(college) &&
    isAllowedDegree(degree) &&
    isAllowedBranch(branch) &&
    isAllowedGraduationYear(graduationYear ? String(graduationYear) : '') &&
    isValidStudentPhone(phone) &&
    skills.length > 0 &&
    certifications.length > 0 &&
    typeof row.is_fresher === 'boolean';

  return {
    userId: row.user_id,
    fullName,
    college,
    degree,
    branch,
    graduationYear,
    contactEmail: row.contact_email || '',
    phone,
    skills,
    skillLabels: skills.map(formatSkillLabel),
    certifications,
    certificationsText,
    isFresher,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    profileComplete,
  };
};

export const studentSearchBlob = (student) =>
  [
    student.fullName,
    student.college,
    student.degree,
    student.branch,
    student.contactEmail,
    student.phone,
    student.skillLabels?.join(' ') || student.skills?.join(' '),
    student.certificationsText,
    student.userId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const formatStudentRegisteredAt = (value) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

export { parseSkillSelection };
