export const STUDENT_JOB_CATEGORY_OPTIONS = [
  { value: 'software_frontend', label: 'Software Frontend' },
  { value: 'software_backend', label: 'Software Backend' },
  { value: 'software_full_stack', label: 'Software Full Stack' },
  { value: 'data_analytics', label: 'Data / Analytics' },
  { value: 'testing_qa', label: 'Testing / QA' },
  { value: 'telecaller_bpo', label: 'Telecaller / BPO' },
  { value: 'customer_support', label: 'Customer Support' },
  { value: 'sales_marketing', label: 'Sales / Marketing' },
  { value: 'digital_marketing', label: 'Digital Marketing' },
  { value: 'accounting_finance', label: 'Accounting / Finance' },
  { value: 'mechanical_production', label: 'Mechanical / Production' },
  { value: 'electrical_electronics', label: 'Electrical / Electronics' },
  { value: 'civil_construction', label: 'Civil / Construction' },
  { value: 'medical_healthcare', label: 'Medical / Healthcare' },
  { value: 'pharma_lab', label: 'Pharma / Lab' },
  { value: 'delivery_logistics', label: 'Delivery / Logistics' },
  { value: 'operations_admin', label: 'Operations / Admin' },
  { value: 'teaching_training', label: 'Teaching / Training' },
  { value: 'retail_hospitality', label: 'Retail / Hospitality' },
  { value: 'other', label: 'Other' },
];

export const STUDENT_ROLE_EXPERIENCE_OPTIONS = [
  { value: 'fresher', label: 'Fresher' },
  { value: '0_6_months', label: '0-6 months' },
  { value: '6_12_months', label: '6-12 months' },
  { value: '1_2_years', label: '1-2 years' },
  { value: '2_4_years', label: '2-4 years' },
  { value: '4_plus_years', label: '4+ years' },
];

export const STUDENT_AVAILABILITY_OPTIONS = [
  { value: 'immediate', label: 'Immediate' },
  { value: 'within_15_days', label: 'Within 15 days' },
  { value: 'within_30_days', label: 'Within 30 days' },
  { value: 'more_than_30_days', label: 'More than 30 days' },
];

const CATEGORY_LABEL_BY_VALUE = new Map(
  STUDENT_JOB_CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
);
const EXPERIENCE_LABEL_BY_VALUE = new Map(
  STUDENT_ROLE_EXPERIENCE_OPTIONS.map((option) => [option.value, option.label]),
);
const AVAILABILITY_LABEL_BY_VALUE = new Map(
  STUDENT_AVAILABILITY_OPTIONS.map((option) => [option.value, option.label]),
);

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const normalizeCareerText = (value, maxLength = 120) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);

export const parseTargetJobCategories = (values) => {
  const allowed = new Set(STUDENT_JOB_CATEGORY_OPTIONS.map((option) => option.value));
  const list = Array.isArray(values) ? values : [];
  return [...new Set(list.map(normalizeToken).filter((item) => allowed.has(item)))].slice(0, 6);
};

export const parsePreferredLocations = (value) => {
  const list = Array.isArray(value)
    ? value
    : String(value || '').split(/[,;\n]/);
  return list
    .map((item) => normalizeCareerText(item, 64))
    .filter(Boolean)
    .slice(0, 8);
};

export const parseExpectedSalary = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(String(value).replace(/[^\d]/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.min(parsed, 10_000_000);
};

export const isAllowedRoleExperienceLevel = (value) =>
  STUDENT_ROLE_EXPERIENCE_OPTIONS.some((option) => option.value === String(value || '').trim());

export const isAllowedAvailability = (value) =>
  STUDENT_AVAILABILITY_OPTIONS.some((option) => option.value === String(value || '').trim());

export const formatJobCategoryLabel = (value) =>
  CATEGORY_LABEL_BY_VALUE.get(String(value || '').trim()) || String(value || '').trim();

export const formatRoleExperienceLabel = (value) =>
  EXPERIENCE_LABEL_BY_VALUE.get(String(value || '').trim()) || String(value || '').trim();

export const formatAvailabilityLabel = (value) =>
  AVAILABILITY_LABEL_BY_VALUE.get(String(value || '').trim()) || String(value || '').trim();
