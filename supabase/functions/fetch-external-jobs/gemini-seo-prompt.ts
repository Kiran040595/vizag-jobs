/**
 * Gemini Make SEO prompts — Vizag / Visakhapatnam job portal (Tasks 1–8).
 */

export type SeoGeminiPayload = {
  title?: string;
  slug?: string;
  short_description?: string;
  description?: string;
  responsibilities?: string[];
  eligibility?: string[];
  skills?: string[];
  category?: string;
  /** Task 9 — hiring employer name from listing facts. */
  company?: string;
  job_type?: string;
  work_mode?: string | null;
  /** Task 9 — hiring employer name from listing facts. */
  company?: string;
  /** Task 9 — true when role targets fresh graduates / 0-year experience. */
  is_fresher?: boolean;
  /** Task 9 — normalized experience label from listing facts. */
  experience?: string;
  /** Task 6 — schema.org JobPosting object (facts from input only). */
  json_ld?: Record<string, unknown> | null;
  /** Task 7 — trending hashtags (with #). */
  hashtags?: string[];
  /** Task 8 — top keywords with occurrence counts in description. */
  keyword_density?: { keyword?: string; count?: number }[];
};

export type SeoGeminiExtras = {
  json_ld: Record<string, unknown> | null;
  hashtags: string[];
  keyword_density: { keyword: string; count: number }[];
};

import { GEMINI_CATEGORY_LIST_TEXT } from '../_shared/jobCategoryTaxonomy.ts';

const SEO_ROLE =
  'You are an expert SEO content writer specializing in job listings for Indian job portals and Google for Jobs.';

const SEO_LOCATION_RULES =
  'Target Vizag and Visakhapatnam job seekers across multiple engineering branches (Mechanical, ECE, EEE, Civil, IT, etc.). Facts only — do NOT invent salary, benefits, phone, email, or requirements not present in the raw listing. Preserve apply_link and source_url from input.';

const TASK_KEYWORDS_BLOCK = `TASK 5 — Keywords to include naturally in the body (use only those relevant to this job; do not stuff):

Location: Vizag jobs, Visakhapatnam jobs, Jobs in Andhra Pradesh, Immediate joining jobs Vizag, Fresher and experienced jobs Vizag

Role (when relevant): Pipeline engineer jobs in Vizag, Oil and Gas jobs in Visakhapatnam, Operations and Maintenance jobs Vizag, O&M engineer jobs Visakhapatnam, Cross country pipeline jobs India

Branch / qualification (when relevant): Mechanical engineer jobs in Vizag, ECE jobs in Visakhapatnam, EEE jobs in Vizag, Civil engineer jobs Vizag, B.Tech jobs in Visakhapatnam, B.E jobs in Vizag, Mechanical engineering jobs Andhra Pradesh, Electrical engineering jobs Vizag, Electronics and communication jobs Vizag

Experience (when relevant): 2 years experience jobs Vizag, Experienced engineer jobs Visakhapatnam, Oil and Gas experienced jobs Andhra Pradesh, Refinery jobs Visakhapatnam, Power plant jobs Vizag, Petrochemical jobs Andhra Pradesh`;

const TASKS_CORE = `${SEO_ROLE}
${SEO_LOCATION_RULES}

Rewrite the raw job listing below into 100% SEO-optimized content for jobsinvizag.in.

TASK 1 — SEO Title
Write an SEO title under 60 characters. Put location first. Include both "Vizag" and "Visakhapatnam".
Example: Pipeline Engineer Jobs in Visakhapatnam (Vizag) | Oil & Gas | SINCLUS

TASK 2 — Meta Description
Write exactly 150–160 characters. Must include: Vizag, Visakhapatnam, job role, qualification, experience, and a call to action.

TASK 3 — URL Slug
Short SEO-friendly slug under 60 characters, hyphen-separated, lowercase, no special characters.
Example: pipeline-engineer-jobs-visakhapatnam-vizag-sinclus

TASK 4 — Full Job Description
Rewrite in Markdown:
- One H1 (#) for the main job title with location
- H2 (##) sections: About the Role, Skills Required (if applicable), Key Responsibilities, Who Can Apply, How to Apply
- Short paragraphs (3–4 lines max)
- Bullet lists for responsibilities and eligibility
- Naturally weave in relevant Task 5 keywords
- End with ## FAQs — at least 4 Q&As using long-tail phrases job seekers search on Google
- Include 1–2 internal Markdown links when relevant: [Latest Jobs in Vizag](/jobs-in-vizag), [Fresher Jobs in Vizag](/fresher-jobs-in-vizag), [IT Jobs in Vizag](/it-jobs-in-vizag)

${TASK_KEYWORDS_BLOCK}

TASK 6 — JSON-LD JobPosting
Return a complete schema.org JobPosting object in field json_ld (not a string). Use only facts from input:
title, description (2–3 line summary), datePosted, validThrough, employmentType (default FULL_TIME if unknown),
hiringOrganization (name, sameAs URL if known),
jobLocation with PostalAddress: addressLocality Visakhapatnam, addressRegion Andhra Pradesh, addressCountry IN, postalCode (use pin from listing or 530001),
baseSalary as MonetaryAmount (currency INR, value QuantitativeValue with minValue/maxValue or value and unitText YEAR/MONTH when salary/CTC/LPA is known),
experienceRequirements, educationRequirements, applicationContact (email/phone only if in input),
identifier (company + job id or slug). Omit unknown optional fields rather than guessing salary numbers.

TASK 7 — Hashtags
Return exactly 15 trending hashtags in hashtags[] (with #). Mix branch-specific (#MechanicalJobs #ECEJobs #EEEJobs #CivilJobs #BTechJobs), role-specific (#PipelineJobs #OilandGasJobs #OMJobs #EngineeringJobs), and location-specific (#VizagJobs #VisakhapatnamJobs #AndhraPradeshJobs).

TASK 8 — Keyword density
Return keyword_density as an array of { "keyword": string, "count": number } for the top 10 keywords in the description.
Ensure "Vizag" and "Visakhapatnam" each appear at least 4–5 times in the description body.

TASK 9 — Job classification (facts from input only — title, experience, eligibility[], skills[], scraped_source, description)
1. company — hiring employer name exactly as stated (Posted by, Company line, employer in post). Never use Naukri or LinkedIn as the company. If no employer is mentioned, use exactly: "Employer name shared during interview" (never "Unknown", "N/A", or blank).
2. category — MUST be exactly one of these values (copy verbatim): ${GEMINI_CATEGORY_LIST_TEXT} | General
   Use education/branch in eligibility (B.Tech Civil, B.E Mechanical, MBA, B.Com, etc.), job title, skills, and department to pick the best match.
   Examples: Civil site engineer → Civil Engineering; Java developer → IT & Software; telecaller → BPO / Customer Support; bank teller → Banking & Finance.
3. is_fresher — boolean. true when experience is 0 years, role says fresher/trainee/intern/GET, or eligibility targets fresh graduates / 2024–2025 passout / 0–1 years only.
   false when minimum 2+ years experience is clearly required.
4. experience — short normalized label from facts only, e.g. "Fresher", "0-1 years", "2-4 years", "5-8 years". Omit or leave empty when not stated in the listing (never use generic placeholders).
5. job_type — if missing, use "Employment type confirmed during interview".
6. work_mode — if missing, use "Work arrangement discussed during interview".
Never output Unknown, N/A, Not specified, Not disclosed, or empty strings for company, experience, job_type, or work_mode.`;

export const GEMINI_SEO_JSON_OUTPUT_RULES = `OUTPUT: Return valid JSON only (no markdown fences). Escape newlines inside strings as \\n.
Required fields: title, slug, short_description, description, responsibilities[], eligibility[], skills[], company, category, job_type, work_mode, is_fresher, experience, json_ld, hashtags[], keyword_density[].
Map Task 2 → short_description. Map Task 4 → description. Map Task 1 → title. Map Task 3 → slug. Map Task 9 → company, category, is_fresher, experience.`;

export const GEMINI_SEO_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    slug: { type: 'STRING' },
    short_description: { type: 'STRING' },
    description: { type: 'STRING' },
    responsibilities: { type: 'ARRAY', items: { type: 'STRING' } },
    eligibility: { type: 'ARRAY', items: { type: 'STRING' } },
    skills: { type: 'ARRAY', items: { type: 'STRING' } },
    company: { type: 'STRING' },
    category: { type: 'STRING' },
    job_type: { type: 'STRING' },
    work_mode: { type: 'STRING' },
    is_fresher: { type: 'BOOLEAN' },
    experience: { type: 'STRING' },
    json_ld: { type: 'OBJECT' },
    hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
    keyword_density: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          keyword: { type: 'STRING' },
          count: { type: 'INTEGER' },
        },
      },
    },
  },
  required: ['title', 'slug', 'short_description', 'description'],
};

export const MAX_SEO_CUSTOM_INSTRUCTIONS_CHARS = 1_200;

export function appendSeoCustomInstructions(prompt: string, customInstructions?: string): string {
  const trimmed =
    typeof customInstructions === 'string'
      ? customInstructions.trim().slice(0, MAX_SEO_CUSTOM_INSTRUCTIONS_CHARS)
      : '';
  if (!trimmed) {
    return prompt;
  }
  return `${prompt}\n\nADMIN_EXTRA_INSTRUCTIONS (follow in addition to all tasks above):\n${trimmed}\n`;
}

/** Shown in admin UI — manual follow-ups if a field is missing from Gemini output. */
export const SEO_ADMIN_FOLLOW_UP_HINTS = [
  'You skipped Task 6. Now give me the complete JSON-LD schema code block only.',
  'Rewrite the job description again but make sure Vizag and Visakhapatnam appear at least 5 times each.',
  'Now suggest 5 more long-tail FAQ questions that mechanical and ECE engineers in Vizag would search on Google.',
].join('\n');

function buildRawListingSection(jobInput: Record<string, unknown>): string {
  return `Now here is the raw job listing to rewrite:\n${JSON.stringify(jobInput)}`;
}

export function buildGeminiSeoSingleJobPrompt(
  jobInput: Record<string, unknown>,
  customInstructions?: string,
): string {
  const base = `${TASKS_CORE}\n\n${GEMINI_SEO_JSON_OUTPUT_RULES}\n\n${buildRawListingSection(jobInput)}`;
  return appendSeoCustomInstructions(base, customInstructions);
}

const LINKEDIN_POST_COMPACT_TASKS = `${SEO_ROLE}
${SEO_LOCATION_RULES}

Rewrite a casual LinkedIn HIRING POST for jobsinvizag.in. Facts from linkedin_post_text / scraped_source only.
If many cities are listed, focus on Vizag/Visakhapatnam when mentioned; preserve WhatsApp/phone/apply links from the post.

TASK 1 — SEO title under 60 chars (Vizag + Visakhapatnam).
TASK 2 — short_description 150–160 chars (meta).
TASK 3 — slug hyphenated lowercase.
TASK 4 — Markdown description under 1200 chars: H1, ## About the Role, ## Key Responsibilities, ## How to Apply, ## FAQs (3 Q&As).
TASK 6 — json_ld JobPosting object (input facts only).
TASK 7 — hashtags[] with 10 items (include #).
TASK 8 — keyword_density top 5 { keyword, count }.
TASK 9 — company, category (exact taxonomy value), is_fresher boolean, experience label — facts from input only.
If company is missing use "Employer name shared during interview". Omit experience when not stated in the listing. Never use Unknown, N/A, Not specified, or generic interview placeholders for experience.

Use relevant Vizag job keywords naturally; do not invent salary or contact details.`;

export function buildGeminiSeoLinkedInPostPrompt(
  jobInput: Record<string, unknown>,
  compact = false,
  customInstructions?: string,
): string {
  const linkedInNote =
    'Input is a casual LinkedIn HIRING POST. Extract facts from linkedin_post_text / scraped_source only. ' +
    'If many cities are listed, focus on Visakhapatnam/Vizag only when Vizag is mentioned; otherwise use "multiple locations" without inventing Vizag-only details. ' +
    'Preserve apply_link (WhatsApp/phone/URL from post).';
  const tasks = compact ? LINKEDIN_POST_COMPACT_TASKS : TASKS_CORE;
  const descNote = compact
    ? 'Keep description under 1200 characters.'
    : 'Description may be up to 2000 characters.';
  const base = `${tasks}\n\n${linkedInNote}\n${descNote}\n\n${GEMINI_SEO_JSON_OUTPUT_RULES}\n\n${buildRawListingSection(jobInput)}`;
  return appendSeoCustomInstructions(base, customInstructions);
}

export function buildGeminiSeoEditorPrompt(jobsForPrompt: unknown): string {
  return (
    `${TASKS_CORE}\n\n` +
    `BATCH MODE: Process each job in INPUT_JOBS independently. Use suggested main_keyword and supporting_keywords as hints.\n` +
    `${GEMINI_SEO_JSON_OUTPUT_RULES}\n\n` +
    `Return JSON: { "jobs": [ { "index": number, ...all fields above per job } ] } with one object per input index.\n\n` +
    `INPUT_JOBS:\n${JSON.stringify(jobsForPrompt)}`
  );
}

export function extractSeoExtrasFromPayload(payload: SeoGeminiPayload): SeoGeminiExtras {
  let json_ld: Record<string, unknown> | null = null;
  if (payload.json_ld && typeof payload.json_ld === 'object' && !Array.isArray(payload.json_ld)) {
    json_ld = payload.json_ld;
  }

  const hashtags = Array.isArray(payload.hashtags)
    ? payload.hashtags
        .map((t) => String(t ?? '').trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const keyword_density = Array.isArray(payload.keyword_density)
    ? payload.keyword_density
        .map((row) => ({
          keyword: String(row?.keyword ?? '').trim(),
          count: Math.max(0, Number(row?.count) || 0),
        }))
        .filter((row) => row.keyword.length > 0)
        .slice(0, 15)
    : [];

  return { json_ld, hashtags, keyword_density };
}
