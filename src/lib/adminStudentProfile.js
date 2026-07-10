export const mapStudentProfileRow = (row) => {
  if (!row) return null;

  const fullName = String(row.full_name || '').trim();
  const skills = Array.isArray(row.skills) ? row.skills : [];

  return {
    userId: row.user_id,
    fullName,
    college: row.college || '',
    degree: row.degree || '',
    branch: row.branch || '',
    graduationYear: row.graduation_year ?? null,
    contactEmail: row.contact_email || '',
    phone: row.phone || '',
    skills,
    isFresher: row.is_fresher !== false,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    profileComplete:
      Boolean(fullName) &&
      fullName.toLowerCase() !== 'your name' &&
      Boolean(String(row.college || '').trim()),
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
    student.skills?.join(' '),
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
