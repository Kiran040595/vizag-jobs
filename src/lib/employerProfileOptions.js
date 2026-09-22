export const EMPLOYER_INDUSTRY_OPTIONS = [
  'IT & Software / Tech',
  'Manufacturing & Industrial / Steel',
  'Pharma, Biotech & Healthcare',
  'Shipping, Port & Logistics',
  'Banking, Financial Services & Insurance (BFSI)',
  'Construction, Architecture & Real Estate',
  'Education, Training & EdTech',
  'Retail, E-commerce & FMCG',
  'Hospitality, Travel & Tourism',
  'BPO, KPO & Customer Operations',
  'Consulting & Professional Services',
  'Other',
];

export const EMPLOYER_LOCATION_OPTIONS = [
  'Rushikonda IT SEZ / Madhurawada',
  'Dwaraka Nagar / RTC Complex',
  'Siripuram / VIP Road',
  'Gajuwaka / Auto Nagar',
  'MVP Colony / Beach Road',
  'Daba Gardens / Jagadamba',
  'Kurmannapalem / Steel Plant area',
  'Atchutapuram / SEZ',
  'Anakapalle',
  'Pendurthi',
  'Other (Visakhapatnam)',
];

/** Check if phone is a valid 10-digit Indian mobile number or international. */
export const isValidEmployerPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length === 10 || (digits.length >= 11 && digits.length <= 13);
};

/** Normalize phone to 10 standard digits or full E.164. */
export const normalizeEmployerPhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.startsWith('91') && digits.length === 12) return digits.slice(2);
  return digits;
};
