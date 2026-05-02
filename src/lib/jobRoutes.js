const normalizeValue = (value = '') => String(value).trim().toLowerCase();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasKeyword = (value, keyword) => {
  const normalizedKeyword = normalizeValue(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  if (/^[a-z0-9\s/-]+$/.test(normalizedKeyword)) {
    const pattern = normalizedKeyword
      .split(/\s+/)
      .map(escapeRegex)
      .join('[\\\\s/-]+');

    return new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`, 'i').test(value);
  }

  return value.includes(normalizedKeyword);
};

const includesAny = (value, keywords) => keywords.some((keyword) => hasKeyword(value, keyword));

const collectSearchText = (job = {}) =>
  [
    job.title,
    job.company,
    job.category,
    job.jobType,
    job.job_type,
    job.workMode,
    job.work_mode,
    job.description,
    job.shortDescription,
    job.short_description,
    job.skills,
    job.source,
    job.source_name,
  ]
    .filter(Boolean)
    .map(normalizeValue)
    .join(' ');

const isFresherJob = (job = {}) => {
  const isFresherValue = normalizeValue(job.isFresher || job.is_fresher);
  return (
    isFresherValue === 'yes' ||
    isFresherValue === 'true' ||
    isFresherValue === 't' ||
    job.is_fresher === true
  );
};

export const getJobCategorySegment = (job = {}) => {
  const text = collectSearchText(job);
  const fresher = isFresherJob(job);

  if (includesAny(text, ['bank', 'banking', 'bank po', 'bank clerk', 'clerk', 'relationship officer', 'loan officer'])) {
    return fresher ? 'bank-fresher' : 'bank';
  }

  if (includesAny(text, ['government', 'govt', 'sarkari', 'railway', 'police', 'psc', 'municipal', 'collectorate'])) {
    return fresher ? 'govt-fresher' : 'govt';
  }

  if (includesAny(text, ['part-time', 'part time', 'parttime'])) {
    return 'part-time';
  }

  if (includesAny(text, ['work from home', 'work-from-home', 'wfh', 'remote', 'hybrid'])) {
    return 'work-from-home';
  }

  if (includesAny(text, ['software', 'information technology', 'developer', 'java', 'python', 'react', 'angular', 'full stack', 'frontend', 'backend', 'dotnet', '.net', 'qa engineer', 'software testing', 'data analyst', 'ml engineer', 'ai engineer', 'enovia'])) {
    return fresher ? 'it-fresher' : 'it';
  }

  if (includesAny(text, ['teacher', 'teaching', 'faculty', 'lecturer', 'professor', 'tutor', 'school', 'educator'])) {
    return 'teaching';
  }

  if (includesAny(text, ['hospital', 'medical', 'nurse', 'clinic', 'healthcare', 'doctor', 'patient care'])) {
    return 'hospital';
  }

  if (includesAny(text, ['pharma', 'pharmaceutical', 'lab', 'laboratory', 'chemist', 'drug'])) {
    return 'pharma';
  }

  if (includesAny(text, ['account', 'accounts', 'accountant', 'finance', 'auditor', 'bookkeeper', 'book keeping', 'bookkeeping', 'gst', 'tax'])) {
    return 'accounts';
  }

  if (includesAny(text, ['sales', 'marketing', 'business development', 'telecaller', 'field executive', 'brand promoter'])) {
    return 'sales';
  }

  if (includesAny(text, ['bpo', 'call center', 'customer support', 'customer care', 'chat support', 'voice process', 'non voice'])) {
    return 'bpo';
  }

  if (includesAny(text, ['manufacturing', 'factory', 'production', 'plant', 'mechanical', 'operator', 'industrial'])) {
    return 'manufacturing';
  }

  if (includesAny(text, ['hotel', 'hospitality', 'restaurant', 'chef', 'kitchen', 'housekeeping', 'front office'])) {
    return 'hotel';
  }

  if (includesAny(text, ['logistics', 'warehouse', 'delivery', 'driver', 'supply chain', 'dispatch', 'inventory'])) {
    return 'logistics';
  }

  if (includesAny(text, ['real estate', 'property', 'realtor', 'real-estate'])) {
    return 'real-estate';
  }

  if (includesAny(text, ['ngo', 'non profit', 'non-profit', 'charity', 'foundation', 'social work'])) {
    return 'ngo';
  }

  if (fresher || includesAny(text, ['fresher', 'trainee', 'entry level', 'entry-level', '0 years', '0-1 years'])) {
    return 'fresher';
  }

  return 'general';
};

export const getJobDetailPath = (job = {}) => {
  const slug = job.slug || job.id;
  const segment = getJobCategorySegment(job);
  return `/jobs/${segment}/${slug}`;
};
