/**
 * Extra Make SEO instructions applied by automation when the admin did not set
 * custom instructions. Keeps Gemini titles/companies within publish quality gates
 * even before the Edge Function prompt is redeployed.
 */
export const SEO_PUBLISH_SAFE_INSTRUCTIONS = [
  'TITLE RULES (override Task 1 if it conflicts): Write a specific role title under 70 characters.',
  'Do NOT put both "Vizag" and "Visakhapatnam" in the title.',
  'Do NOT use aggregate phrasing like "Jobs in Vizag", "Jobs in Visakhapatnam", or "X Jobs in Y".',
  'Put location SEO in the description, FAQs, and hashtags only.',
  'Good titles: "Pipeline Engineer — Oil & Gas | SINCLUS", "Graduate Engineer Trainee", "Sales Executive (Vizag)".',
  'COMPANY RULES: Preserve the real employer from the input listing.',
  'If no employer is stated, leave company empty — never invent "Employer name shared during interview", "Unknown", or "Confidential".',
].join(' ');
