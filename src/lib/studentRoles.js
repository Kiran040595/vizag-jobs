/** Preserve punctuation (C++ and C# are different roles), normalize spacing/case. */
export const normalizeRoleLabel = value => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
export const roleKey = value => normalizeRoleLabel(value).toLowerCase();

export const studentRoleLabels = student => {
  const roles = new Map();
  for (const value of [student.primaryTargetRole, ...(student.interestedRoles || [])]) {
    const label = normalizeRoleLabel(value);
    if (label && !roles.has(roleKey(label))) roles.set(roleKey(label), label);
  }
  return [...roles.values()];
};

export const studentMatchesRole = (student, role) =>
  !roleKey(role) || studentRoleLabels(student).some(label => roleKey(label) === roleKey(role));

export const countStudentRoles = students => {
  const counts = new Map();
  for (const student of students) {
    for (const label of studentRoleLabels(student)) {
      const key = roleKey(label);
      const item = counts.get(key) || { value: label, count: 0 };
      item.count += 1;
      counts.set(key, item);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
};
