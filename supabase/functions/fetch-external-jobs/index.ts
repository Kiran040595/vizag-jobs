import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

type RawHit = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
  content?: string;
};

type ExtractedJob = {
  title: string;
  company: string;
  experience: string;
  location?: string | null;
  apply_url?: string | null;
  posted_at?: string | null;
  summary?: string | null;
  source_url: string;
  source_name?: string | null;
  description_markdown?: string | null;
  scrape_chars?: number;
  scraped_at?: string;
};

type FetchSummary = {
  total: number;
  with_posted_at_within_24h: number;
  without_usable_date: number;
  filtered_out_older_than_24h: number;
};

/** Matches `public.jobs` / admin `serializeJobForm` shape for import preview. */
type SiteJobRecord = {
  slug: string;
  title: string;
  company: string;
  location: string;
  category: string;
  job_type: string;
  work_mode: string | null;
  experience: string;
  is_fresher: boolean;
  salary: string | null;
  apply_link: string;
  short_description: string;
  description: string;
  responsibilities: string[];
  eligibility: string[];
  warning: string;
  posted_at: string | null;
  expires_at: string | null;
  source_name: string;
  source_url: string;
  skills: string[];
  company_logo_url: string | null;
  status: 'draft';
  is_featured: boolean;
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-fetch-jobs-cron-secret',
  'Access-Control-Max-Age': '86400',
};

const FIRECRAWL_SEARCH_URL = 'https://api.firecrawl.dev/v1/search';
const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v1/scrape';
const SCRAPFLY_SCRAPE_URL = 'https://api.scrapfly.io/scrape';
/** Only LinkedIn + Naukri (filtered again by hostname after search). */
/** Firecrawl searches aimed at single-job URLs (not city hubs). */
const DETAIL_SEARCH_QUERIES = [
  'site:in.linkedin.com/jobs/view Visakhapatnam',
  'site:in.linkedin.com/jobs/view Vizag',
  'site:www.naukri.com/job-listings Visakhapatnam',
  'site:www.naukri.com/job-listings Vizag',
];

const DEFAULT_SEARCH_QUERIES = [
  ...DETAIL_SEARCH_QUERIES,
  'site:in.linkedin.com jobs Visakhapatnam',
  'site:www.naukri.com jobs-in-visakhapatnam',
];

const MAX_GEMINI_CHUNK_CHARS = 36_000;
/** Max listing URLs to fully scrape (full markdown beats SERP snippets for extracting individual roles). */
const DEFAULT_SCRAPE_PAGE_LIMIT = 10;
/** Max Gemini calls per request (each processes one chunk of pages). */
const DEFAULT_MAX_GEMINI_CHUNKS = 4;
const MS_24H = 24 * 60 * 60 * 1000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePostedAt(value?: string | null): number | null {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function isLinkedInOrNaukriUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, '').toLowerCase();
    return h.endsWith('linkedin.com') || h.endsWith('naukri.com');
  } catch {
    return false;
  }
}

/** Real job posting detail URLs only (exclude city hub pages). */
function looksLikeIndividualJobApplyUrl(applyUrl: string | null | undefined): boolean {
  if (!applyUrl?.trim()) {
    return false;
  }
  try {
    const u = new URL(applyUrl.trim());
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const path = u.pathname;

    if (host.endsWith('linkedin.com')) {
      return /\/jobs\/view\//i.test(path);
    }
    if (host.endsWith('naukri.com')) {
      const low = path.toLowerCase();
      if (/^\/jobs-in-visakhapatnam\/?$/i.test(low)) {
        return false;
      }
      if (/^\/jobs-in-[^/]+\/?$/i.test(low) && !low.includes('job-listings')) {
        return false;
      }
      return low.includes('job-listings');
    }
    return false;
  } catch {
    return false;
  }
}

function humanizeSlugPart(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Normalize LinkedIn/Naukri URL slugs (unicode dashes, stray punctuation). */
function normalizeJobSlug(slug: string): string {
  return slug
    .replace(/[\u2010-\u2015\u2212\u00ad]/g, '-')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const PARSER_VERSION = 'site-record-v1';

const DEFAULT_JOB_WARNING =
  'Verify job details on the employer site before sharing personal documents or payments. Never pay a fee to apply.';

function slugify(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function createJobSlug(title: string, company: string, postedAt?: string | null): string {
  const baseSlug =
    [title, company]
      .map(slugify)
      .filter(Boolean)
      .join('-') || 'vizag-job';
  const suffix = postedAt ? slugify(postedAt.split('T')[0]) : '';
  return suffix ? `${baseSlug}-${suffix}` : baseSlug;
}

function parseRelativePostedAt(phrase: string | null | undefined, referenceIso: string): string | null {
  if (!phrase?.trim()) {
    return null;
  }
  const ref = new Date(referenceIso);
  if (Number.isNaN(ref.getTime())) {
    return null;
  }
  const low = phrase.trim().toLowerCase();
  const msDay = 86_400_000;

  if (/\bjust now\b|\btoday\b/i.test(low)) {
    return ref.toISOString();
  }
  if (/\byesterday\b/i.test(low)) {
    return new Date(ref.getTime() - msDay).toISOString();
  }
  const days = low.match(/(\d+)\s*days?\s*ago/i);
  if (days) {
    return new Date(ref.getTime() - Number(days[1]) * msDay).toISOString();
  }
  const weeks = low.match(/(\d+)\s*weeks?\s*ago/i);
  if (weeks) {
    return new Date(ref.getTime() - Number(weeks[1]) * 7 * msDay).toISOString();
  }
  if (/\b1\s*week\s*ago\b/i.test(low)) {
    return new Date(ref.getTime() - 7 * msDay).toISOString();
  }
  const hours = low.match(/(\d+)\s*hours?\s*ago/i);
  if (hours) {
    return new Date(ref.getTime() - Number(hours[1]) * 3_600_000).toISOString();
  }
  return null;
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkdownBlocks(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractMarkdownSection(md: string, heading: string): string {
  const pattern = new RegExp(
    `##\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
    'i',
  );
  const match = md.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function extractPostedPhrase(md: string, summary: string | null | undefined): string | null {
  const blob = `${summary ?? ''}\n${md}`;
  const posted =
    blob.match(/Posted:\s*([^O\n]+?)(?:Openings:|Applicants:|Register to apply|$)/i)?.[1]?.trim() ??
    blob.match(/\bPosted\s+(\d+\s+Days?\s+Ago|Just\s+Now|Today|Yesterday)\b/i)?.[1]?.trim();
  return posted ?? null;
}

function inferCategory(md: string): string {
  const department = md.match(/Department:\s*\[([^\]]+)\]/i)?.[1]?.trim();
  if (department) {
    return department;
  }
  const industry = md.match(/Industry Type:\s*\[([^\]]+)\]/i)?.[1]?.trim();
  if (industry) {
    return industry;
  }
  const roleCategory = md.match(/Role Category:\s*([^\n]+)/i)?.[1]?.trim();
  if (roleCategory) {
    return roleCategory;
  }
  return 'General';
}

function inferJobType(md: string): string {
  const employment = md.match(/Employment Type:\s*([^\n]+)/i)?.[1]?.trim();
  if (!employment) {
    return 'Full-time';
  }
  const low = employment.toLowerCase();
  if (low.includes('part')) {
    return 'Part-time';
  }
  if (low.includes('intern')) {
    return 'Internship';
  }
  if (low.includes('contract')) {
    return 'Contract';
  }
  return 'Full-time';
}

function inferWorkMode(md: string): string | null {
  const low = md.toLowerCase();
  if (/work location assignment:\s*on premise|on-site|on site\b/i.test(low)) {
    return 'On-site';
  }
  if (/\bhybrid\b/i.test(low)) {
    return 'Hybrid';
  }
  if (/\bremote\b|work from home|\bwfh\b/i.test(low)) {
    return 'Remote';
  }
  return null;
}

function extractNaukriSalary(md: string): string | null {
  const lacs = md.match(/(\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?)\s*Lacs?\s*P\.?A\.?/i);
  if (lacs) {
    return `${lacs[1].replace(/\s+/g, '')} LPA`;
  }
  const singleLac = md.match(/(\d+(?:\.\d+)?)\s*Lacs?\s*P\.?A\.?/i);
  if (singleLac) {
    return `${singleLac[1]} LPA`;
  }
  if (/\bNot Disclosed\b/i.test(md)) {
    return 'Not disclosed';
  }
  return null;
}

function extractNaukriSkills(md: string): string[] {
  const section =
    extractMarkdownSection(md, 'Key Skills') ||
    md.split(/##\s*Key Skills/i)[1]?.split(/\n##\s/)[0] ||
    '';
  const skills = new Set<string>();
  for (const match of section.matchAll(/\[([^\]]+)\]\(https:\/\/www\.naukri\.com\/[^)]+\)/gi)) {
    const skill = match[1]?.trim();
    if (skill && skill.length >= 2 && skill.length <= 60) {
      skills.add(skill);
    }
  }
  return [...skills].slice(0, 24);
}

function extractBulletPoints(block: string, max = 14): string[] {
  const lines = block.split(/\n/);
  const bullets: string[] = [];
  for (const line of lines) {
    const trimmed = line.replace(/^[-*•]\s+/, '').trim();
    if (trimmed.length >= 12 && trimmed.length <= 400 && !/^https?:\/\//i.test(trimmed)) {
      bullets.push(stripMarkdownInline(trimmed));
    }
  }
  return bullets.slice(0, max);
}

function extractNaukriEligibility(md: string): string[] {
  const items: string[] = [];
  const ug = md.match(/UG:\s*([^\n]+)/i)?.[1]?.trim();
  const pg = md.match(/PG:\s*([^\n]+)/i)?.[1]?.trim();
  if (ug) {
    items.push(`UG: ${ug}`);
  }
  if (pg) {
    items.push(`PG: ${pg}`);
  }
  const eduBlock = md.match(/Education\s*\n+([\s\S]*?)(?=\nread more|\nKey Skills|\n##\s)/i)?.[1];
  if (eduBlock) {
    for (const line of eduBlock.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && trimmed.length <= 120 && !/^education$/i.test(trimmed)) {
        items.push(stripMarkdownInline(trimmed));
      }
    }
  }
  return [...new Set(items)].slice(0, 10);
}

function buildNaukriDescription(md: string): string {
  let body = extractMarkdownSection(md, 'Job description');
  if (!body) {
    const idx = md.indexOf('## Job description');
    body = idx >= 0 ? md.slice(idx + '## Job description'.length) : md;
  }
  body =
    body.split(
      /\n(?:Role:|Key Skills|## Jobs you might be interested|## Similar jobs|## Pfizer|## TATA|## Paytm|Beware of imposters)/i,
    )[0] ?? body;
  return stripMarkdownBlocks(body).slice(0, 12_000);
}

function extractCompanyLogoUrl(md: string): string | null {
  const match =
    md.match(/!\[[^\]]*Company Logo[^\]]*\]\((https:\/\/img\.naukimg\.com[^)]+)\)/i) ??
    md.match(/!\[[^\]]*\]\((https:\/\/img\.naukimg\.com\/logo_images[^)]+)\)/i);
  return match?.[1] ?? null;
}

function cleanCompanyName(company: string, md: string): string {
  const postedBy = md.match(/\[Posted by ([^\]]+)\]/i)?.[1]?.trim();
  if (postedBy) {
    return postedBy;
  }
  let name = company.trim();
  if (/^posted by\s+/i.test(name)) {
    name = name.replace(/^posted by\s+/i, '').trim();
  }
  if (name.length > 80) {
    const linkName = md.match(
      /\[([^\]]{2,80})\]\(https:\/\/www\.naukri\.com\/(?!naukri)[a-z0-9-]+-jobs-careers/gi,
    )?.[1];
    if (linkName && isUsableCompanyName(linkName)) {
      return linkName.trim();
    }
  }
  return name || 'Unknown';
}

function inferDisplayTitle(raw: ExtractedJob, md: string): string {
  const role = md.match(/Role:\s*\[([^\]]{2,160})\]/i)?.[1]?.trim();
  if (role && isUsableJobTitle(role)) {
    return role;
  }
  const designation =
    md.match(/\*\*Designation:\*\*\s*([^\n*]+)/i)?.[1]?.trim() ||
    md.match(/Designation\s*:\s*([^\n]+)/i)?.[1]?.trim();
  if (designation && isUsableJobTitle(designation)) {
    return designation;
  }
  return raw.title;
}

function inferIsFresher(experience: string, title: string, md: string): boolean {
  const exp = experience.toLowerCase();
  if (/^0\s*[-–]/.test(exp) || /\bfresher\b/i.test(exp) || /^0\s+to\s+/i.test(exp)) {
    return true;
  }
  if (/\bfresher\b|\btrainee\b|\bintern\b/i.test(title)) {
    return true;
  }
  const ug = md.match(/UG:\s*([^\n]+)/i)?.[1]?.toLowerCase() ?? '';
  if (ug.includes('2024') || ug.includes('2025 pass')) {
    return true;
  }
  return false;
}

function isBoilerplateSummary(summary: string | null | undefined): boolean {
  if (!summary?.trim()) {
    return true;
  }
  return (
    summary.includes('Naukri Logo') ||
    summary.includes('Search jobs here') ||
    summary.includes('For employers') ||
    summary.length < 50
  );
}

function buildShortDescription(description: string, title: string): string {
  const plain = description.replace(/\n+/g, ' ').trim();
  if (!plain) {
    return title;
  }
  if (plain.length <= 280) {
    return plain;
  }
  const cut = plain.slice(0, 280);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 120 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function toSiteJobRecord(raw: ExtractedJob, referenceIso: string): SiteJobRecord {
  const md = raw.description_markdown ?? '';
  const title = inferDisplayTitle(raw, md);
  const company = cleanCompanyName(raw.company, md);
  const postedPhrase = extractPostedPhrase(md, raw.summary);
  const postedAt =
    raw.posted_at ??
    parseRelativePostedAt(postedPhrase, referenceIso) ??
    parseRelativePostedAt(raw.summary, referenceIso) ??
    null;

  let description = buildNaukriDescription(md);
  if (!description && !isBoilerplateSummary(raw.summary)) {
    description = stripMarkdownBlocks(raw.summary ?? '').slice(0, 8000);
  }
  if (!description && md.length > 200) {
    description = stripMarkdownBlocks(md).slice(0, 8000);
  }

  const responsibilities = extractBulletPoints(description);
  const eligibility = extractNaukriEligibility(md);
  const sourceName = raw.source_name ?? (raw.source_url.includes('naukri.com') ? 'naukri.com' : 'linkedin.com');

  return {
    slug: createJobSlug(title, company, postedAt ?? referenceIso),
    title,
    company,
    location: raw.location?.trim() || 'Visakhapatnam',
    category: inferCategory(md),
    job_type: inferJobType(md),
    work_mode: inferWorkMode(md),
    experience: raw.experience?.trim() || 'Not specified',
    is_fresher: inferIsFresher(raw.experience ?? '', title, md),
    salary: extractNaukriSalary(md),
    apply_link: raw.apply_url?.trim() || raw.source_url,
    short_description: buildShortDescription(description, title),
    description,
    responsibilities: responsibilities.length > 0 ? responsibilities : [],
    eligibility,
    warning: DEFAULT_JOB_WARNING,
    posted_at: postedAt,
    expires_at: null,
    source_name: sourceName,
    source_url: raw.source_url,
    skills: extractNaukriSkills(md),
    company_logo_url: extractCompanyLogoUrl(md),
    status: 'draft',
    is_featured: false,
  };
}

function dedupeSiteJobs(jobs: SiteJobRecord[]): SiteJobRecord[] {
  const seen = new Set<string>();
  const out: SiteJobRecord[] = [];
  for (const job of jobs) {
    const key = (job.apply_link || job.source_url || job.slug).toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(job);
  }
  return out;
}

const NAUKRI_LOCATION_TOKENS = [
  'visakhapatnam',
  'vishakhapatnam',
  'vizag',
  'vijayawada',
  'guntur',
  'hyderabad',
  'rajahmundry',
  'khammam',
];

function parseNaukriJobListingUrl(url: string): Partial<ExtractedJob> | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('naukri.com')) {
      return null;
    }
    let body = u.pathname.replace(/^\//, '');
    if (!body.startsWith('job-listings-')) {
      return null;
    }
    body = body.slice('job-listings-'.length);

    const idMatch = body.match(/-(\d{9,})$/);
    if (!idMatch) {
      return null;
    }
    body = body.slice(0, -idMatch[0].length);

    let experience = 'Not specified';
    const expRange = body.match(/-(\d+)-to-(\d+)-years$/i);
    const expFresher = body.match(/-0-to-(\d+)-years$/i);
    if (expRange) {
      experience = `${expRange[1]} to ${expRange[2]} years`;
      body = body.slice(0, -expRange[0].length);
    } else if (expFresher) {
      experience = `0 to ${expFresher[1]} years`;
      body = body.slice(0, -expFresher[0].length);
    }

    const parts = body.split('-').filter(Boolean);
    let locIdx = -1;
    let locToken = 'visakhapatnam';
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i].toLowerCase();
      const hit = NAUKRI_LOCATION_TOKENS.find((k) => p.includes(k) || k.includes(p));
      if (hit) {
        locIdx = i;
        locToken = hit;
        break;
      }
    }

    let title = 'Job opening';
    let company = 'Unknown';
    const location =
      locToken === 'vizag' ? 'Vizag / Visakhapatnam' : humanizeSlugPart(locToken);

    if (locIdx >= 0) {
      const beforeLoc = parts.slice(0, locIdx);
      const split = splitNaukriTitleCompanyFromSlugParts(beforeLoc);
      title = split.title;
      company = split.company;
    } else if (parts.length > 0) {
      title = humanizeSlugPart(parts.slice(0, Math.min(5, parts.length)).join('-'));
      company = humanizeSlugPart(parts.slice(Math.min(5, parts.length)).join('-')) || company;
    }

    return {
      title,
      company,
      experience,
      location,
      apply_url: u.href,
      source_url: u.href,
      source_name: 'naukri.com',
    };
  } catch {
    return null;
  }
}

const NAUKRI_TITLE_BOUNDARY_WORDS = new Set([
  'associate',
  'executive',
  'engineer',
  'manager',
  'analyst',
  'officer',
  'specialist',
  'consultant',
  'developer',
  'lead',
  'head',
  'intern',
  'trainee',
  'representative',
  'supervisor',
  'coordinator',
  'iii',
  'ii',
  'iv',
  'i',
]);

const NAUKRI_COMPANY_SUFFIX_TOKENS = new Set([
  'llp',
  'ltd',
  'limited',
  'pvt',
  'private',
  'inc',
  'corp',
  'llc',
  'gmbh',
  'bank',
  'finance',
  'india',
  'services',
  'solutions',
  'technologies',
  'technology',
  'enterprises',
  'group',
  'pharma',
  'healthcare',
  'motors',
  'paints',
  'consultancy',
  'consulting',
]);

const GARBAGE_JOB_TITLES = new Set([
  'job opening',
  'job description',
  'search jobs here',
  'naukri logo',
  'login',
  'register',
]);

function splitNaukriTitleCompanyFromSlugParts(
  beforeLoc: string[],
): { title: string; company: string } {
  if (beforeLoc.length === 0) {
    return { title: 'Job opening', company: 'Unknown' };
  }

  let suffixIdx = -1;
  for (let i = beforeLoc.length - 1; i >= 0; i -= 1) {
    const p = beforeLoc[i].toLowerCase();
    if (NAUKRI_COMPANY_SUFFIX_TOKENS.has(p) || [...NAUKRI_COMPANY_SUFFIX_TOKENS].some((s) => p.includes(s))) {
      suffixIdx = i;
      break;
    }
  }

  if (suffixIdx >= 0) {
    let companyStart = suffixIdx;
    for (let j = suffixIdx - 1; j >= 0; j -= 1) {
      const p = beforeLoc[j].toLowerCase();
      if (NAUKRI_TITLE_BOUNDARY_WORDS.has(p)) {
        companyStart = j + 1;
        break;
      }
      companyStart = j;
    }
    return {
      title: humanizeSlugPart(beforeLoc.slice(0, companyStart).join('-')) || 'Job opening',
      company: humanizeSlugPart(beforeLoc.slice(companyStart).join('-')) || 'Unknown',
    };
  }

  const splitAt = Math.max(1, beforeLoc.length - 2);
  return {
    title: humanizeSlugPart(beforeLoc.slice(0, splitAt).join('-')) || 'Job opening',
    company: humanizeSlugPart(beforeLoc.slice(splitAt).join('-')) || 'Unknown',
  };
}

function parseLinkedInJobViewUrl(url: string): Partial<ExtractedJob> | null {
  try {
    const u = new URL(url);
    if (!u.hostname.replace(/^www\./, '').toLowerCase().endsWith('linkedin.com')) {
      return null;
    }
    if (!/\/jobs\/view\//i.test(u.pathname)) {
      return null;
    }

    const pathMatch = u.pathname.match(/\/jobs\/view\/(.+)$/i);
    if (!pathMatch?.[1]) {
      return null;
    }

    let slug = normalizeJobSlug(decodeURIComponent(pathMatch[1]).replace(/\/$/, ''));
    slug = slug.replace(/-(\d{8,})$/, '');

    let titleSlug = slug;
    let companySlug = '';
    const atIdx = slug.lastIndexOf('-at-');
    if (atIdx > 0) {
      titleSlug = slug.slice(0, atIdx);
      companySlug = slug.slice(atIdx + 4);
    }

    const title = humanizeSlugPart(titleSlug) || 'Job opening';
    const company = companySlug ? humanizeSlugPart(companySlug) : 'Unknown';

    const blob = `${title} ${company} ${slug}`.toLowerCase();
    const location = blob.includes('vizag') || blob.includes('visakhapatnam')
      ? 'Visakhapatnam / Vizag'
      : 'Visakhapatnam / Vizag';

    return {
      title,
      company,
      experience: 'Not specified',
      location,
      apply_url: u.href,
      source_url: u.href,
      source_name: 'linkedin.com',
    };
  } catch {
    return null;
  }
}

function isUsableJobTitle(value: string | null | undefined): boolean {
  if (!value?.trim()) {
    return false;
  }
  const low = value.trim().toLowerCase();
  if (GARBAGE_JOB_TITLES.has(low)) {
    return false;
  }
  if (low.length < 3 || low.length > 200) {
    return false;
  }
  if (/^https?:\/\//i.test(low) || low.includes('naukri.com')) {
    return false;
  }
  return true;
}

function isUsableCompanyName(value: string | null | undefined): boolean {
  if (!value?.trim()) {
    return false;
  }
  const low = value.trim().toLowerCase();
  return low !== 'unknown' && low !== 'job opening' && low.length >= 2;
}

function extractNaukriFieldsFromMarkdown(markdown: string): Partial<ExtractedJob> {
  const out: Partial<ExtractedJob> = {};

  const companyMatches = [
    ...markdown.matchAll(
      /\[([^\]]{2,120})\]\(https:\/\/www\.naukri\.com\/(?!naukri)[a-z0-9-]+-jobs-careers/gi,
    ),
  ];
  for (const match of companyMatches) {
    const name = match[1]?.trim();
    if (name && !/^naukri$/i.test(name) && isUsableCompanyName(name)) {
      out.company = name;
      break;
    }
  }

  const roleMatch = markdown.match(/Role:\s*\[([^\]]{2,160})\]/i);
  if (roleMatch?.[1] && isUsableJobTitle(roleMatch[1])) {
    out.title = roleMatch[1].trim();
  }

  const designationMatch =
    markdown.match(/\*\*Designation:\*\*\s*([^\n*]+)/i) ||
    markdown.match(/Designation\s*:\s*([^\n]+)/i);
  if (designationMatch?.[1] && isUsableJobTitle(designationMatch[1])) {
    out.title = designationMatch[1].trim();
  }

  const postedMatch = markdown.match(/Posted:\s*([^O\n]+?)(?:Openings:|Applicants:|$)/i);
  if (postedMatch?.[1]) {
    const phrase = postedMatch[1].trim();
    if (/ago|yesterday|today|just now/i.test(phrase)) {
      out.summary = `Posted: ${phrase}`;
    }
  }

  const expLine = markdown.match(/\n(\d+\s*-\s*\d+\s+years?)\n/i);
  if (expLine?.[1]) {
    out.experience = expLine[1].replace(/\s+/g, ' ').trim();
  }

  return out;
}

function parseJobFieldsFromUrl(url: string): Partial<ExtractedJob> | null {
  if (!looksLikeIndividualJobApplyUrl(url)) {
    return null;
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (host.endsWith('naukri.com')) {
      return parseNaukriJobListingUrl(url);
    }
    if (host.endsWith('linkedin.com')) {
      return parseLinkedInJobViewUrl(url);
    }
  } catch {
    return null;
  }
  return null;
}

function extractTitleFromMarkdown(markdown: string): string | null {
  const h1 = markdown.match(/^#\s+(.+)$/m);
  if (h1?.[1] && isUsableJobTitle(h1[1])) {
    return h1[1].trim().slice(0, 200);
  }
  const h2 = markdown.match(/^##\s+(.+)$/m);
  if (h2?.[1] && isUsableJobTitle(h2[1])) {
    return h2[1].trim().slice(0, 200);
  }
  return null;
}

function sortDetailUrlsForScrape(urls: string[]): string[] {
  const rank = (url: string): number => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes('naukri.com')) {
        return 0;
      }
      if (host.includes('linkedin.com')) {
        return 2;
      }
    } catch {
      return 1;
    }
    return 1;
  };
  return [...urls].sort((a, b) => rank(a) - rank(b));
}

function extractSummaryFromMarkdown(markdown: string): string | null {
  const cleaned = markdown.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 40) {
    return null;
  }
  return cleaned.slice(0, 400);
}

function mergeJobRecord(
  url: string,
  slugFields: Partial<ExtractedJob> | null,
  markdown: string,
  scrapedAt: string,
): ExtractedJob | null {
  const fromUrl = slugFields ?? parseJobFieldsFromUrl(url);
  if (!fromUrl) {
    return null;
  }

  const md = markdown.trim();
  const isNaukri = url.includes('naukri.com');
  const isLinkedIn = url.includes('linkedin.com');
  const naukriMd = isNaukri && md ? extractNaukriFieldsFromMarkdown(md) : {};
  const titleFromMd = md && !isNaukri ? extractTitleFromMarkdown(md) : null;
  const scrapeThin = md.length < 120;

  let title = fromUrl.title || 'Job opening';
  if (isLinkedIn) {
    if (isUsableJobTitle(fromUrl.title)) {
      title = fromUrl.title!;
    } else if (!scrapeThin && isUsableJobTitle(titleFromMd)) {
      title = titleFromMd!;
    }
  } else if (isNaukri) {
    if (isUsableJobTitle(fromUrl.title)) {
      title = fromUrl.title!;
    }
    if (isUsableJobTitle(naukriMd.title)) {
      title = naukriMd.title!;
    }
  } else if (isUsableJobTitle(titleFromMd)) {
    title = titleFromMd!;
  } else if (isUsableJobTitle(fromUrl.title)) {
    title = fromUrl.title!;
  }

  let company = fromUrl.company || 'Unknown';
  if (isLinkedIn) {
    if (isUsableCompanyName(fromUrl.company)) {
      company = fromUrl.company!;
    }
  } else if (isNaukri) {
    if (isUsableCompanyName(naukriMd.company)) {
      company = naukriMd.company!;
    } else if (isUsableCompanyName(fromUrl.company)) {
      company = fromUrl.company!;
    }
  } else if (isUsableCompanyName(fromUrl.company)) {
    company = fromUrl.company!;
  }

  let experience = fromUrl.experience || 'Not specified';
  if (naukriMd.experience?.trim()) {
    experience = naukriMd.experience;
  }

  const summaryFromMd = md ? extractSummaryFromMarkdown(md) : null;

  return {
    title,
    company,
    experience,
    location: fromUrl.location ?? 'Visakhapatnam / Vizag',
    apply_url: url,
    source_url: url,
    source_name: fromUrl.source_name ?? null,
    posted_at: fromUrl.posted_at ?? null,
    summary: naukriMd.summary || summaryFromMd || fromUrl.summary || null,
    description_markdown: md.length > 0 ? md : null,
    scrape_chars: md.length,
    scraped_at: scrapedAt,
  };
}

function buildJobRecordFromScrape(
  url: string,
  markdown: string,
  scrapedAt: string,
): ExtractedJob | null {
  return mergeJobRecord(url, parseJobFieldsFromUrl(url), markdown, scrapedAt);
}

function useGeminiEnrichment(): boolean {
  return Deno.env.get('FETCH_JOB_USE_GEMINI')?.trim().toLowerCase() === 'true';
}

function scrapedJobsToHits(jobs: ExtractedJob[]): RawHit[] {
  return jobs.map((job) => ({
    url: job.source_url,
    title: job.title,
    markdown: job.description_markdown ?? job.summary ?? '',
  }));
}

function mergeGeminiIntoScrapedJobs(scraped: ExtractedJob[], gemini: ExtractedJob[]): ExtractedJob[] {
  const byUrl = new Map<string, ExtractedJob>();
  for (const row of gemini) {
    const keys = [row.apply_url, row.source_url].filter(Boolean).map((u) => String(u).toLowerCase());
    for (const key of keys) {
      byUrl.set(key, row);
    }
  }

  return scraped.map((job) => {
    const lookup = (job.apply_url ?? job.source_url ?? '').toLowerCase();
    const enriched = lookup ? byUrl.get(lookup) : undefined;
    if (!enriched) {
      return job;
    }
    return {
      ...job,
      title:
        enriched.title && enriched.title !== 'Job opening' && job.title === 'Job opening'
          ? enriched.title
          : job.title,
      company:
        enriched.company && enriched.company !== 'Unknown' && job.company === 'Unknown'
          ? enriched.company
          : job.company,
      experience:
        enriched.experience && enriched.experience !== 'Not specified' && job.experience === 'Not specified'
          ? enriched.experience
          : job.experience,
      location: enriched.location ?? job.location,
      posted_at: enriched.posted_at ?? job.posted_at,
      summary: enriched.summary ?? job.summary,
      description_markdown:
        !job.description_markdown?.trim() && enriched.summary?.trim()
          ? enriched.summary
          : job.description_markdown,
    };
  });
}

async function searchDetailUrlsOnly(apiKey: string): Promise<string[]> {
  const limitPerQuery = Number(Deno.env.get('FETCH_JOB_DETAIL_SEARCH_LIMIT') ?? '8') || 8;
  const found = new Set<string>();
  for (const query of DETAIL_SEARCH_QUERIES) {
    const rows = await firecrawlSearch(query, limitPerQuery, apiKey);
    for (const row of rows) {
      const normalized = normalizeExtractedJobUrl(row.url);
      if (normalized && looksLikeIndividualJobApplyUrl(normalized) && isLinkedInOrNaukriUrl(normalized)) {
        found.add(normalized);
      }
    }
  }
  return [...found];
}

function discoverDetailUrlsFromHits(hits: RawHit[]): string[] {
  const corpus = hits
    .map((h) => [h.markdown, h.content, h.description, h.title, h.url].filter(Boolean).join('\n'))
    .join('\n\n');
  const fromMarkdown = extractIndividualJobUrlsFromText(corpus);
  const fromHits = hits
    .map((h) => normalizeExtractedJobUrl(h.url))
    .filter((u): u is string => Boolean(u && looksLikeIndividualJobApplyUrl(u)));
  return [...new Set([...fromHits, ...fromMarkdown])];
}

async function discoverAllDetailUrls(apiKey: string): Promise<string[]> {
  const { hits } = await collectViaFirecrawl(apiKey);
  const fromHits = discoverDetailUrlsFromHits(hits);
  const fromSearch = await searchDetailUrlsOnly(apiKey);
  return [...new Set([...fromHits, ...fromSearch])];
}

async function scrapeDetailUrlsToJobs(
  urls: string[],
  apiKey: string,
  scrapedAt: string,
): Promise<{
  jobs: ExtractedJob[];
  failed_urls: string[];
  stats: { attempted: number; succeeded: number; failed: number };
}> {
  const jobs: ExtractedJob[] = [];
  const failed_urls: string[] = [];

  for (const url of urls) {
    const md = await firecrawlScrapeUrl(url, apiKey);
    const slugFields = parseJobFieldsFromUrl(url);
    let record = mergeJobRecord(url, slugFields, md, scrapedAt);

    if (!record) {
      failed_urls.push(url);
      continue;
    }

    const scrapeOk = (record.scrape_chars ?? 0) > 80;
    const slugOk = Boolean(slugFields);

    if (!scrapeOk && slugOk) {
      record = mergeJobRecord(url, slugFields, '', scrapedAt) ?? record;
    }

    const linkedInSlugOk =
      url.includes('linkedin.com') &&
      isUsableJobTitle(record.title) &&
      record.title !== 'Job opening';
    const hasUsefulFields =
      scrapeOk ||
      (slugOk && isUsableJobTitle(record.title)) ||
      linkedInSlugOk;

    if (hasUsefulFields) {
      jobs.push(record);
    } else {
      failed_urls.push(url);
    }
  }

  return {
    jobs: dedupeJobs(jobs),
    failed_urls,
    stats: {
      attempted: urls.length,
      succeeded: jobs.length,
      failed: failed_urls.length,
    },
  };
}

function mentionsVizagContext(job: ExtractedJob): boolean {
  const blob = [job.title, job.company, job.location ?? '', job.summary ?? '', job.source_url, job.apply_url ?? '']
    .join(' ')
    .toLowerCase();
  return (
    blob.includes('visakhapatnam') ||
    blob.includes('vishakhapatnam') ||
    blob.includes('vizag') ||
    blob.includes('andhra pradesh') ||
    blob.includes('andhra')
  );
}

/** Pull concrete job URLs out of hub SERP/list markdown (often the only place they appear). */
function normalizeExtractedJobUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (!host.endsWith('linkedin.com') && !host.endsWith('naukri.com')) {
      return null;
    }
    u.hash = '';
    if (host.endsWith('linkedin.com')) {
      u.search = '';
    }
    return u.href;
  } catch {
    return null;
  }
}

function extractIndividualJobUrlsFromText(text: string): string[] {
  const found = new Set<string>();

  const liMatches = text.matchAll(
    /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/jobs\/view\/(\d{7,})(?:\/[^\s"'<>)\]]*)?(?:\?[^\s"'<>)\]]*)?/gi,
  );
  for (const m of liMatches) {
    const n = normalizeExtractedJobUrl(m[0]);
    if (n) {
      found.add(n);
    }
  }

  const nkMatches = text.matchAll(
    /https?:\/\/(?:www\.)?naukri\.com\/job-listings-[a-z0-9\-]+(?:\.html)?(?:\?[^\s"'<>)\]]*)?/gi,
  );
  for (const m of nkMatches) {
    const n = normalizeExtractedJobUrl(m[0]);
    if (n) {
      found.add(n);
    }
  }

  return [...found];
}

/**
 * Hub pages rarely yield structured rows. Mine markdown for /jobs/view/ and job-listings URLs, scrape those pages.
 */
async function expandHitsWithIndividualJobPages(
  hits: RawHit[],
  apiKey: string,
): Promise<{ hits: RawHit[]; urls_discovered: number; detail_pages_scraped: number }> {
  const maxDetail = Math.min(
    Math.max(4, Number(Deno.env.get('FETCH_JOB_DETAIL_SCRAPE_LIMIT') ?? '24') || 24),
    45,
  );

  const corpus = hits
    .map((h) => [h.markdown, h.content, h.description, h.title].filter(Boolean).join('\n'))
    .join('\n\n');

  const fromHitUrls: string[] = [];
  for (const h of hits) {
    const n = normalizeExtractedJobUrl(h.url);
    if (n && looksLikeIndividualJobApplyUrl(n)) {
      fromHitUrls.push(n);
    }
  }

  const fromMarkdown = extractIndividualJobUrlsFromText(corpus);
  const discoveredList = [...new Set([...fromHitUrls, ...fromMarkdown])];
  const slice = discoveredList.slice(0, maxDetail);

  if (slice.length === 0) {
    return { hits, urls_discovered: 0, detail_pages_scraped: 0 };
  }

  const detailHits: RawHit[] = [];
  for (const url of slice) {
    const md = await firecrawlScrapeUrl(url, apiKey);
    if (typeof md === 'string' && md.length > 120) {
      detailHits.push({ url, title: url, markdown: md });
    }
  }

  if (detailHits.length === 0) {
    return { hits, urls_discovered: discoveredList.length, detail_pages_scraped: 0 };
  }

  return {
    hits: detailHits,
    urls_discovered: discoveredList.length,
    detail_pages_scraped: detailHits.length,
  };
}

/** When hub markdown has no /jobs/view/ links, search Firecrawl for detail URLs directly. */
async function searchAndScrapeDetailPages(
  apiKey: string,
): Promise<{ hits: RawHit[]; urls_from_search: number; pages_scraped: number }> {
  const limitPerQuery = Number(Deno.env.get('FETCH_JOB_DETAIL_SEARCH_LIMIT') ?? '8') || 8;
  const maxScrape = Math.min(
    Math.max(4, Number(Deno.env.get('FETCH_JOB_DETAIL_SCRAPE_LIMIT') ?? '24') || 24),
    45,
  );

  const urlMap = new Map<string, RawHit>();
  for (const query of DETAIL_SEARCH_QUERIES) {
    const rows = await firecrawlSearch(query, limitPerQuery, apiKey);
    for (const row of rows) {
      const normalized = normalizeExtractedJobUrl(row.url);
      if (normalized && looksLikeIndividualJobApplyUrl(normalized) && isLinkedInOrNaukriUrl(normalized)) {
        urlMap.set(normalized, { ...row, url: normalized });
      }
    }
  }

  const detailHits: RawHit[] = [];
  for (const [url, meta] of [...urlMap.entries()].slice(0, maxScrape)) {
    const md = await firecrawlScrapeUrl(url, apiKey);
    if (typeof md === 'string' && md.length > 120) {
      detailHits.push({
        url,
        title: meta.title,
        description: meta.description,
        markdown: md,
      });
    }
  }

  return { hits: detailHits, urls_from_search: urlMap.size, pages_scraped: detailHits.length };
}

/** Last resort: parse role lines from Firecrawl search snippets (title + description). */
async function geminiExtractFromSearchSnippets(
  hits: RawHit[],
  apiKey: string,
  referenceTimeUtc: string,
): Promise<ExtractedJob[]> {
  const snippetHits = hits
    .filter((h) => isLinkedInOrNaukriUrl(h.url))
    .filter((h) => (h.description?.trim().length ?? 0) > 30 || (h.title?.trim().length ?? 0) > 15)
    .slice(0, 25);

  if (snippetHits.length === 0) {
    return [];
  }

  const blob = snippetHits
    .map(
      (h, i) =>
        `--- SNIPPET ${i + 1} ---\nLISTING_PAGE: ${h.url}\nTITLE: ${h.title ?? ''}\nTEXT: ${h.description ?? ''}\n`,
    )
    .join('\n');

  const instruction =
    `Extract INDIVIDUAL job roles from these search snippets (LinkedIn/Naukri, Visakhapatnam/Vizag area).\n` +
    `Each bullet or "Role · Company" line in TEXT should become one job object.\n` +
    `Do NOT emit rows for the LISTING_PAGE title alone (e.g. "2328 vacancies").\n` +
    `apply_url: copy a full https URL from TEXT if it is linkedin.com/jobs/view/… or naukri.com/job-listings-…; else null.\n` +
    `source_url: LISTING_PAGE.\n` +
    `experience, company, title as visible. posted_at from TEXT vs REFERENCE_TIME_UTC ${referenceTimeUtc} or null.\n\n` +
    blob;

  return geminiExtractJobs(instruction, apiKey, referenceTimeUtc);
}

function summarizeJobs(jobs: { posted_at?: string | null }[], cutoff: number): FetchSummary {
  let within = 0;
  let undated = 0;
  let older = 0;

  for (const job of jobs) {
    const ts = parsePostedAt(job.posted_at ?? null);
    if (ts === null) {
      undated += 1;
    } else if (ts >= cutoff) {
      within += 1;
    } else {
      older += 1;
    }
  }

  return {
    total: jobs.length,
    with_posted_at_within_24h: within,
    without_usable_date: undated,
    filtered_out_older_than_24h: older,
  };
}

async function assertAuthorized(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const cronSecret = Deno.env.get('FETCH_JOBS_CRON_SECRET');
  const altCron = req.headers.get('x-fetch-jobs-cron-secret');
  if (cronSecret && altCron === cronSecret) {
    return { ok: true };
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearer = match?.[1]?.trim() ?? '';

  if (!bearer) {
    return { ok: false, status: 401, message: 'Missing Authorization bearer token.' };
  }

  if (cronSecret && bearer === cronSecret) {
    return { ok: true };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(bearer);
  if (userError || !userData?.user?.id) {
    return { ok: false, status: 401, message: 'Invalid or expired session.' };
  }

  const { data: adminRow, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (adminError) {
    return { ok: false, status: 500, message: 'Could not verify admin access.' };
  }
  if (!adminRow?.user_id) {
    return { ok: false, status: 403, message: 'Admin access required.' };
  }

  return { ok: true };
}

async function firecrawlSearch(query: string, limit: number, apiKey: string): Promise<RawHit[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(FIRECRAWL_SEARCH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, limit }),
      signal: controller.signal,
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: string }).error)
          : res.statusText;
      throw new Error(`Firecrawl search failed (${res.status}): ${msg}`);
    }

    const data = payload?.data ?? payload?.results ?? payload?.web ?? [];
    const list = Array.isArray(data) ? data : [];
    return list.map((item: Record<string, unknown>) => ({
      url: String(item.url ?? item.link ?? ''),
      title: item.title ? String(item.title) : undefined,
      description: item.description ? String(item.description) : undefined,
      markdown: item.markdown ? String(item.markdown) : undefined,
      content: item.content ? String(item.content) : undefined,
    })).filter((h: RawHit) => Boolean(h.url));
  } finally {
    clearTimeout(timeout);
  }
}

async function firecrawlScrapeUrl(url: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(FIRECRAWL_SCRAPE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      return '';
    }
    const data = payload?.data ?? payload;
    const md = data?.markdown ?? data?.content ?? '';
    return typeof md === 'string' ? md : '';
  } finally {
    clearTimeout(timeout);
  }
}

async function scrapflyScrapeUrl(url: string, apiKey: string): Promise<string> {
  const endpoint = new URL(SCRAPFLY_SCRAPE_URL);
  endpoint.searchParams.set('key', apiKey);
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('render_js', 'true');
  endpoint.searchParams.set('asp', 'true');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(endpoint.toString(), { signal: controller.signal });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      return '';
    }
    const html = payload?.result?.content ?? '';
    return typeof html === 'string' ? stripHtml(html) : '';
  } finally {
    clearTimeout(timeout);
  }
}

function parseQueriesEnv(): string[] {
  const raw = Deno.env.get('FETCH_JOB_SEARCH_QUERIES');
  if (!raw?.trim()) {
    return DEFAULT_SEARCH_QUERIES;
  }
  return raw
    .split(',')
    .map((q) => q.trim())
    .filter(Boolean);
}

function parseScrapflyUrlsEnv(): string[] {
  const raw = Deno.env.get('SCRAPFLY_SCRAPE_URLS');
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
}

async function collectViaFirecrawl(apiKey: string): Promise<{ hits: RawHit[]; provider: 'firecrawl' }> {
  const queries = parseQueriesEnv();
  const limitPerQuery = Number(Deno.env.get('FETCH_JOB_SEARCH_LIMIT') ?? '6') || 6;
  const scrapeLimit = Math.min(
    Math.max(1, Number(Deno.env.get('FETCH_JOB_SCRAPE_PAGE_LIMIT') ?? String(DEFAULT_SCRAPE_PAGE_LIMIT)) || DEFAULT_SCRAPE_PAGE_LIMIT),
    20,
  );

  const merged = new Map<string, RawHit>();
  for (const query of queries) {
    const rows = await firecrawlSearch(query, limitPerQuery, apiKey);
    for (const row of rows) {
      if (!merged.has(row.url)) {
        merged.set(row.url, row);
      }
    }
  }

  const ordered = [...merged.values()]
    .filter((hit) => isLinkedInOrNaukriUrl(hit.url))
    .sort((a, b) => {
      const aDetail = looksLikeIndividualJobApplyUrl(a.url) ? 0 : 1;
      const bDetail = looksLikeIndividualJobApplyUrl(b.url) ? 0 : 1;
      return aDetail - bDetail;
    });

  const detailFromSearch = ordered.filter((h) => looksLikeIndividualJobApplyUrl(h.url));
  const hubFromSearch = ordered.filter((h) => !looksLikeIndividualJobApplyUrl(h.url));
  const maxDetailFromSearch = Math.min(detailFromSearch.length, 15);
  const enriched: RawHit[] = [];

  for (const hit of detailFromSearch.slice(0, maxDetailFromSearch)) {
    const md = await firecrawlScrapeUrl(hit.url, apiKey);
    enriched.push({
      ...hit,
      markdown: md || hit.markdown || hit.content || hit.description || '',
    });
  }

  for (let i = 0; i < Math.min(hubFromSearch.length, scrapeLimit); i += 1) {
    const hit = hubFromSearch[i];
    const md = await firecrawlScrapeUrl(hit.url, apiKey);
    enriched.push({
      ...hit,
      markdown: md || hit.markdown || hit.content || hit.description || '',
    });
  }

  for (let i = scrapeLimit; i < hubFromSearch.length; i += 1) {
    const hit = hubFromSearch[i];
    enriched.push({
      ...hit,
      markdown: hit.markdown ?? hit.content ?? hit.description ?? '',
    });
  }

  return { hits: enriched, provider: 'firecrawl' };
}

async function collectViaScrapfly(apiKey: string): Promise<{ hits: RawHit[]; provider: 'scrapfly' }> {
  const urls = parseScrapflyUrlsEnv().filter((u) => isLinkedInOrNaukriUrl(u));
  if (urls.length === 0) {
    throw new Error(
      'SCRAPFLY_SCRAPE_URLS must include at least one linkedin.com or naukri.com URL for this pipeline.',
    );
  }

  const hits: RawHit[] = [];
  for (const url of urls.slice(0, 12)) {
    const text = await scrapflyScrapeUrl(url, apiKey);
    hits.push({
      url,
      title: url,
      markdown: text ? `# Source\n${url}\n\n${text}` : '',
    });
  }

  return { hits, provider: 'scrapfly' };
}

function hitsToContextBlob(hits: RawHit[], startIndex = 0): string {
  const chunks = hits.map((hit, index) => {
    const head = [hit.title, hit.description].filter(Boolean).join('\n');
    const body = hit.markdown ?? hit.content ?? '';
    return `--- SOURCE ${startIndex + index + 1} ---\nPAGE_URL: ${hit.url}\n${head}\n\n${body}`;
  });
  return chunks.join('\n\n');
}

/** Split scraped pages into chunks so each Gemini call stays within limits and focuses on fewer URLs at once. */
function chunkHitsForGemini(hits: RawHit[], maxCharsPerChunk: number): RawHit[][] {
  const chunks: RawHit[][] = [];
  let current: RawHit[] = [];
  let size = 0;

  for (const hit of hits) {
    const one = hitsToContextBlob([hit], 0);
    const needBreak = current.length > 0 && size + one.length > maxCharsPerChunk;
    if (needBreak) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(hit);
    size += one.length;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks.length > 0 ? chunks : [[]];
}

function dedupeJobs(jobs: ExtractedJob[]): ExtractedJob[] {
  const seen = new Set<string>();
  const out: ExtractedJob[] = [];
  for (const j of jobs) {
    const title = j.title.trim().toLowerCase();
    const company = (j.company ?? '').trim().toLowerCase();
    const link = (j.apply_url ?? j.source_url ?? '').trim().toLowerCase();
    const key = `${title}|${company}|${link}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(j);
  }
  return out;
}

/** SERP-style portal headings that list aggregate counts (not one role). */
function isLikelyPortalAggregate(job: ExtractedJob): boolean {
  const lower = job.title.toLowerCase();
  if (/^\d+\s+job vacancies\b/i.test(lower)) {
    return true;
  }
  if (/^\d+\s+\w+\s+jobs in\b/i.test(lower) && lower.includes('linkedin')) {
    return true;
  }
  if (/vacancies in visakhapatnam/i.test(lower) && (lower.includes('naukri') || lower.includes('indeed'))) {
    return true;
  }
  if (/jobs in visakhapatnam:\s*latest/i.test(lower)) {
    return true;
  }
  return false;
}

function filterAggregatePortalJobs(jobs: ExtractedJob[]): { kept: ExtractedJob[]; removed_count: number } {
  const kept = jobs.filter((j) => !isLikelyPortalAggregate(j));
  return { kept, removed_count: jobs.length - kept.length };
}

async function geminiExtractJobs(markdown: string, apiKey: string, referenceTimeUtc: string): Promise<ExtractedJob[]> {
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const instruction =
    `SOURCE RULES: Content comes ONLY from LinkedIn or Naukri pages about roles in/near Visakhapatnam (Vizag), Andhra Pradesh, India.\n` +
    `OUTPUT: Each array item is ONE real job posting — never a whole city landing page.\n\n` +
    `REQUIRED FIELDS:\n` +
    `- title: Job role name only (e.g. "Software Engineer", "Medical coder").\n` +
    `- company: Hiring employer name when visible; use "Unknown" only if truly absent.\n` +
    `- experience: Years or level text from the listing (e.g. "2–5 yrs", "Fresher", "3+ years"); use "Not specified" if missing.\n` +
    `- location: City/region line when stated.\n` +
    `- apply_url: Absolute HTTPS URL for THAT job's detail/apply page ONLY:\n` +
    `  LinkedIn must contain "/jobs/view/" in the path.\n` +
    `  Naukri must be a job-listings detail URL (path contains "job-listings"), NOT /jobs-in-visakhapatnam hub.\n` +
    `  Copy URLs verbatim from markdown links when present; use null only if no individual job URL exists.\n` +
    `- posted_at: ISO 8601 UTC when stated OR infer from relative phrases ("5 hours ago", "Posted yesterday", "2 days ago") using REFERENCE_TIME.\n` +
    `  REFERENCE_TIME_UTC: ${referenceTimeUtc}\n` +
    `  If age cannot be estimated, use null.\n` +
    `- summary: One short line (skills, salary, employment type) optional.\n` +
    `- source_url: PAGE_URL from the chunk for where this row was found.\n` +
    `- If PAGE_URL itself is already a single job page (/jobs/view/… or …/job-listings-…), produce ONE row for that page and set apply_url to that same URL when no separate apply link exists.\n\n` +
    `FORBIDDEN ROWS (omit entirely):\n` +
    `- Titles like "2328 Job Vacancies In Visakhapatnam - Naukri.com", "472 Visakhapatnam jobs - LinkedIn".\n` +
    `- Rows whose apply_url would be only a city/search hub.\n` +
    `- Non–LinkedIn/Naukri URLs.\n\n` +
    `If no individual postings exist in the text, return {"jobs":[]}.\n\n` +
    `--- CONTENT ---\n${markdown}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: instruction }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          jobs: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                company: { type: 'STRING' },
                experience: { type: 'STRING' },
                location: { type: 'STRING' },
                apply_url: { type: 'STRING' },
                posted_at: { type: 'STRING' },
                summary: { type: 'STRING' },
                source_url: { type: 'STRING' },
                source_name: { type: 'STRING' },
              },
              required: ['title', 'company', 'experience', 'source_url'],
            },
          },
        },
        required: ['jobs'],
      },
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = payload?.error?.message ?? res.statusText;
      throw new Error(`Gemini request failed (${res.status}): ${msg}`);
    }

    const text =
      payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ??
      '';

    if (!text.trim()) {
      throw new Error('Gemini returned no text.');
    }

    const parsed = JSON.parse(text) as { jobs?: ExtractedJob[] };
    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
    return jobs
      .filter((j) => j && typeof j.title === 'string' && typeof j.source_url === 'string')
      .map((j) => {
        const applyRaw = typeof j.apply_url === 'string' ? j.apply_url.trim() : '';
        let applyUrl = applyRaw.length > 0 ? applyRaw : null;
        const src = String(j.source_url);
        if (!applyUrl && looksLikeIndividualJobApplyUrl(src)) {
          applyUrl = src;
        }
        return {
          title: String(j.title),
          company: typeof j.company === 'string' && j.company.trim() ? j.company : 'Unknown',
          experience:
            typeof j.experience === 'string' && j.experience.trim()
              ? j.experience.trim()
              : 'Not specified',
          location: j.location ?? null,
          apply_url: applyUrl,
          posted_at: j.posted_at ?? null,
          summary: j.summary ?? null,
          source_url: src,
          source_name: j.source_name ?? null,
        };
      });
  } finally {
    clearTimeout(timeout);
  }
}

async function geminiExtractJobsChunked(hits: RawHit[], apiKey: string, referenceTimeUtc: string): Promise<ExtractedJob[]> {
  const maxChunks = Math.min(
    Math.max(1, Number(Deno.env.get('FETCH_JOB_MAX_GEMINI_CHUNKS') ?? String(DEFAULT_MAX_GEMINI_CHUNKS)) ||
      DEFAULT_MAX_GEMINI_CHUNKS),
    8,
  );
  const chunks = chunkHitsForGemini(hits, MAX_GEMINI_CHUNK_CHARS).slice(0, maxChunks);
  const merged: ExtractedJob[] = [];

  for (const chunk of chunks) {
    if (chunk.length === 0) {
      continue;
    }
    const blob = hitsToContextBlob(chunk, 0);
    const extracted = await geminiExtractJobs(blob, apiKey, referenceTimeUtc);
    merged.push(...extracted);
  }

  return dedupeJobs(merged);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ ok: false, error: 'Supabase server configuration missing.' }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auth = await assertAuthorized(req, supabaseAdmin);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.message }, auth.status);
  }

  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')?.trim();
  const scrapflyKey = Deno.env.get('SCRAPFLY_API_KEY')?.trim();
  const geminiKey = Deno.env.get('GEMINI_API_KEY')?.trim();

  try {
    const fetchInstant = new Date().toISOString();
    const cutoff = Date.now() - MS_24H;

    if (!firecrawlKey && !scrapflyKey) {
      return jsonResponse(
        {
          ok: false,
          error:
            'No crawler configured. Set FIRECRAWL_API_KEY or SCRAPFLY_API_KEY + SCRAPFLY_SCRAPE_URLS as Edge Function secrets.',
        },
        501,
      );
    }

    let provider: 'firecrawl' | 'scrapfly' = firecrawlKey ? 'firecrawl' : 'scrapfly';
    let detailUrls: string[] = [];

    if (firecrawlKey) {
      detailUrls = await discoverAllDetailUrls(firecrawlKey);
    } else {
      detailUrls = parseScrapflyUrlsEnv().filter(
        (u) => isLinkedInOrNaukriUrl(u) && looksLikeIndividualJobApplyUrl(u),
      );
    }

    const maxScrape = Math.min(
      Math.max(4, Number(Deno.env.get('FETCH_JOB_DETAIL_SCRAPE_LIMIT') ?? '24') || 24),
      45,
    );
    const naukriUrls = detailUrls.filter((u) => u.includes('naukri.com') && u.includes('job-listings'));
    const otherUrls = detailUrls.filter((u) => !naukriUrls.includes(u));
    const urlsToScrape = [...sortDetailUrlsForScrape(naukriUrls), ...sortDetailUrlsForScrape(otherUrls)].slice(
      0,
      maxScrape,
    );

    let jobs: ExtractedJob[] = [];
    let failed_urls: string[] = [];
    let scrape_stats = { attempted: 0, succeeded: 0, failed: 0 };

    if (firecrawlKey) {
      const scraped = await scrapeDetailUrlsToJobs(urlsToScrape, firecrawlKey, fetchInstant);
      jobs = scraped.jobs;
      failed_urls = scraped.failed_urls;
      scrape_stats = scraped.stats;
    } else if (scrapflyKey) {
      for (const url of urlsToScrape) {
        const text = await scrapflyScrapeUrl(url, scrapflyKey);
        const record = buildJobRecordFromScrape(url, text, fetchInstant);
        if (record) {
          jobs.push(record);
        } else {
          failed_urls.push(url);
        }
      }
      jobs = dedupeJobs(jobs);
      scrape_stats = {
        attempted: urlsToScrape.length,
        succeeded: jobs.length,
        failed: failed_urls.length,
      };
    }

    jobs = jobs.filter(
      (j) =>
        mentionsVizagContext(j) ||
        looksLikeIndividualJobApplyUrl(j.apply_url ?? j.source_url ?? ''),
    );

    let gemini_status: 'skipped' | 'ok' | 'failed' = 'skipped';
    let gemini_error: string | null = null;

    if (useGeminiEnrichment()) {
      if (!geminiKey) {
        gemini_status = 'failed';
        gemini_error = 'FETCH_JOB_USE_GEMINI is true but GEMINI_API_KEY is not set.';
      } else if (jobs.length > 0) {
        try {
          const geminiRows = await geminiExtractJobsChunked(scrapedJobsToHits(jobs), geminiKey, fetchInstant);
          jobs = mergeGeminiIntoScrapedJobs(jobs, geminiRows);
          gemini_status = 'ok';
        } catch (e) {
          gemini_status = 'failed';
          gemini_error = e instanceof Error ? e.message : 'Gemini enrichment failed.';
        }
      }
    }

    const rawJobs = jobs;
    const siteJobs = dedupeSiteJobs(rawJobs.map((j) => toSiteJobRecord(j, fetchInstant)));

    const jobs_last_24h = siteJobs.filter((j) => {
      const ts = parsePostedAt(j.posted_at ?? null);
      return ts !== null && ts >= cutoff;
    });

    const jobs_undated = siteJobs.filter((j) => {
      const ts = parsePostedAt(j.posted_at ?? null);
      return ts === null || ts < cutoff;
    });

    const summary = summarizeJobs(siteJobs, cutoff);

    const extraction_debug = {
      parser_version: PARSER_VERSION,
      linkedin_count: rawJobs.filter((j) => j.source_name === 'linkedin.com').length,
      linkedin_empty_scrape: rawJobs.filter(
        (j) => j.source_name === 'linkedin.com' && (j.scrape_chars ?? 0) === 0,
      ).length,
      linkedin_unknown_company: rawJobs.filter(
        (j) => j.source_name === 'linkedin.com' && j.company === 'Unknown',
      ).length,
      naukri_count: rawJobs.filter((j) => j.source_name === 'naukri.com').length,
      naukri_bad_title: rawJobs.filter(
        (j) =>
          j.source_name === 'naukri.com' &&
          (j.title === 'Job description' || j.title === 'Job opening'),
      ).length,
      sample: siteJobs.slice(0, 8).map((j) => ({
        slug: j.slug,
        title: j.title,
        company: j.company,
        category: j.category,
        posted_at: j.posted_at,
        source: j.source_name,
      })),
    };

    return jsonResponse({
      ok: true,
      fetched_at: fetchInstant,
      provider_used: provider,
      extraction_mode: 'per_url_scrape',
      parser_version: PARSER_VERSION,
      extraction_debug,
      extraction_hint:
        'Each job URL is scraped with Firecrawl, then mapped to the site job schema (slug, category, description, skills, posted_at, etc.). jobs[] is import-ready with status draft. jobs_last_24h uses posted_at within 24h of fetch time.',
      filters_applied: {
        sources: ['linkedin.com', 'naukri.com'],
        location_context: ['Visakhapatnam', 'Vizag', 'Andhra Pradesh', 'Andhra'],
      },
      detail_job_urls_discovered: detailUrls.length,
      detail_job_pages_scraped: scrape_stats.succeeded,
      scrape_stats,
      scrape_failed_urls: failed_urls,
      gemini_status,
      gemini_error,
      jobs: siteJobs,
      jobs_last_24h,
      jobs_undated,
      summary,
      sources_scraped: siteJobs.map((j) => ({
        url: j.source_url,
        title: j.title,
        company: j.company,
        experience: j.experience,
        slug: j.slug,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Fetch failed.';
    return jsonResponse({ ok: false, error: message }, 502);
  }
});
