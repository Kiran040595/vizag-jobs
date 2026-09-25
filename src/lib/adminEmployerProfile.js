export const buildJobStatsMap = (rows = []) => {
  const statsByUser = {};

  for (const row of rows) {
    const userId = row.created_by;
    if (!userId) continue;

    if (!statsByUser[userId]) {
      statsByUser[userId] = { total: 0, pending: 0, published: 0 };
    }

    statsByUser[userId].total += 1;
    if (row.status === 'pending') statsByUser[userId].pending += 1;
    if (row.status === 'published') statsByUser[userId].published += 1;
  }

  return statsByUser;
};

export const mapEmployerProfileRow = (row, jobStats = null) => {
  if (!row) return null;

  const companyName = String(row.company_name || '').trim();
  const stats = jobStats || { total: 0, pending: 0, published: 0 };

  return {
    userId: row.user_id,
    companyName,
    contactName: row.contact_name || '',
    contactEmail: row.contact_email || '',
    phone: row.phone || '',
    website: row.website || '',
    companyLogoUrl: row.company_logo_url || '',
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    profileComplete: Boolean(companyName) && companyName.toLowerCase() !== 'your company',
    jobStats: stats,
  };
};

export const employerSearchBlob = (employer) =>
  [
    employer.companyName,
    employer.contactName,
    employer.contactEmail,
    employer.phone,
    employer.website,
    employer.userId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const formatEmployerRegisteredAt = (value) => {
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
