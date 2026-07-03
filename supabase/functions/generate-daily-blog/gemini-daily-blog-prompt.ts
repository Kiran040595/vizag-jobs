/** Daily blog prompt builder — mirrored from src/lib/dailyBlogPrompt.js */

export const DAILY_BLOG_ARTICLE_ANGLES = [
  {
    id: 'market_pulse',
    label: 'Market pulse',
    headlineStyle: 'Daily hiring pulse',
    focus:
      'What changed in the Vizag job market today — volume, momentum, and which sectors moved.',
  },
  {
    id: 'sector_spotlight',
    label: 'Sector spotlight',
    headlineStyle: 'Sector deep-dive',
    focus: 'Pick the strongest category today and explain why that sector is active in Visakhapatnam.',
  },
  {
    id: 'employer_watch',
    label: 'Employer watch',
    headlineStyle: 'Who is hiring',
    focus: 'Employers and companies driving today’s listings — patterns, not a raw directory.',
  },
  {
    id: 'fresher_lens',
    label: 'Fresher & graduate lens',
    headlineStyle: 'Entry-level outlook',
    focus: 'Opportunities for freshers and early-career candidates in Vizag today.',
  },
  {
    id: 'work_mode_trends',
    label: 'Work mode trends',
    headlineStyle: 'On-site vs hybrid vs remote',
    focus: 'How work arrangements are shaping today’s openings in Visakhapatnam.',
  },
  {
    id: 'salary_experience',
    label: 'Salary & experience signals',
    headlineStyle: 'Compensation & seniority signals',
    focus: 'What experience bands and salary mentions today suggest about local demand.',
  },
  {
    id: 'regional_context',
    label: 'Regional context',
    headlineStyle: 'Vizag in the wider AP market',
    focus: 'How today’s local hiring fits Andhra Pradesh / east-coast industrial and IT trends.',
  },
] as const;

export type DailyBlogAngle = (typeof DAILY_BLOG_ARTICLE_ANGLES)[number];

export type DailyBlogJobInput = {
  title?: string | null;
  company?: string | null;
  category?: string | null;
  location?: string | null;
  work_mode?: string | null;
  workMode?: string | null;
  experience?: string | null;
  salary?: string | null;
  slug?: string | null;
  path?: string | null;
};

const INTERNAL_LINKS = [
  { label: 'All jobs in Vizag', path: '/jobs' },
  { label: 'IT jobs', path: '/jobs/it' },
  { label: 'Fresher jobs', path: '/jobs/fresher' },
  { label: 'Part-time jobs', path: '/jobs/part-time' },
  { label: 'Civil jobs', path: '/jobs/civil' },
  { label: 'Engineering jobs', path: '/jobs/engineering' },
  { label: 'Blog', path: '/blog' },
];

const formatIstDate = (dateInput: Date | string) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

const formatDisplayDate = (dateInput: Date | string) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

export const pickDailyBlogAngle = (dateInput: Date | string = new Date()): DailyBlogAngle => {
  const istDay = formatIstDate(dateInput);
  const dayNumber = Number(istDay.replace(/-/g, ''));
  const index = dayNumber % DAILY_BLOG_ARTICLE_ANGLES.length;
  return DAILY_BLOG_ARTICLE_ANGLES[index];
};

export const buildDailyBlogSlug = (dateInput: Date | string = new Date(), angleId = 'market_pulse') => {
  const istDate = formatIstDate(dateInput);
  const suffix = angleId.replace(/_/g, '-');
  return `vizag-jobs-${suffix}-${istDate}`;
};

const summarizeJobsForPrompt = (jobs: DailyBlogJobInput[] = []) => {
  const categoryCounts: Record<string, number> = {};
  const companies = new Set<string>();
  const workModes: Record<string, number> = {};
  const highlights: Record<string, unknown>[] = [];

  for (const job of jobs) {
    const category = String(job.category || 'General').trim() || 'General';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    if (job.company) companies.add(String(job.company).trim());
    const mode = String(job.work_mode || job.workMode || 'unspecified').trim() || 'unspecified';
    workModes[mode] = (workModes[mode] || 0) + 1;

    if (highlights.length < 12) {
      highlights.push({
        title: job.title,
        company: job.company,
        category: job.category,
        location: job.location,
        work_mode: job.work_mode || job.workMode,
        experience: job.experience,
        salary: job.salary,
        slug: job.slug,
        path:
          job.path ||
          (job.slug && job.category
            ? `/jobs/${String(job.category).toLowerCase().replace(/\s+/g, '-')}/${job.slug}`
            : null),
      });
    }
  }

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  return {
    total: jobs.length,
    uniqueCompanies: companies.size,
    topCategories,
    workModes,
    highlights,
    companySample: [...companies].slice(0, 20),
  };
};

export const buildDailyBlogGeminiPrompt = ({
  jobs = [],
  webContext = '',
  siteName = 'JobsInVizag.in',
  siteUrl = 'https://jobsinvizag.in',
  dateInput = new Date(),
  angle = pickDailyBlogAngle(dateInput),
}: {
  jobs?: DailyBlogJobInput[];
  webContext?: string;
  siteName?: string;
  siteUrl?: string;
  dateInput?: Date | string;
  angle?: DailyBlogAngle;
}) => {
  const digest = summarizeJobsForPrompt(jobs);
  const displayDate = formatDisplayDate(dateInput);
  const slug = buildDailyBlogSlug(dateInput, angle.id);
  const internalLinks = INTERNAL_LINKS.map((link) => `- [${link.label}](${link.path})`).join('\n');

  const webSection = webContext.trim()
    ? `## Live web context (use for regional/market colour — paraphrase, do not copy verbatim)\n${webContext.trim().slice(0, 6000)}`
    : '## Live web context\nNo external snippets were retrieved. Rely on job data and careful local labour-market reasoning for Visakhapatnam.';

  return `You are the editorial lead for ${siteName}, an independent regional job board for Visakhapatnam (Vizag), Andhra Pradesh, India.

Write ONE original blog article for Google AdSense approval standards and helpful job-seeker value.

## Editorial mission (AdSense / quality bar)
- Publish **original analysis**, not a thin scrape or duplicate job list.
- Sound like a knowledgeable local careers editor — trustworthy, specific, human.
- **Do NOT** keyword-stuff "jobs in Vizag". Use natural language and synonyms (Visakhapatnam, local hiring, Andhra Pradesh coast, etc.).
- **Maximum ~35%** of the article may be job examples; the rest must be interpretation, context, and guidance.
- Include practical advice job seekers can use today.
- Be honest about limitations: ${siteName} aggregates public listings; you are not the employer.
- No fabricated salaries, employers, or statistics not supported by the data below or web context.
- No legal/financial guarantees. No clickbait.

## Today's assignment
- Date (IST): ${displayDate}
- Article angle: **${angle.label}** — ${angle.focus}
- Headline style hint: ${angle.headlineStyle}
- Suggested slug: ${slug}

## Job data published today on ${siteName}
Total new listings today: ${digest.total}
Unique companies: ${digest.uniqueCompanies}
Top categories: ${JSON.stringify(digest.topCategories)}
Work mode mix: ${JSON.stringify(digest.workModes)}
Sample companies: ${digest.companySample.join(', ') || 'n/a'}
Representative openings (for examples only — link when path exists):
${JSON.stringify(digest.highlights, null, 2)}

${webSection}

## Required article structure (Markdown body)
1. **Opening** (2 short paragraphs) — hook with today's market takeaway for Vizag job seekers.
2. **What stood out today** — 3–5 insights from the data (sectors, employers, experience levels).
3. **Deep analysis section** — aligned to today's angle (${angle.label}); connect local context (port city, IT parks, pharma, manufacturing, PSU presence) where relevant.
4. **Highlighted opportunities** — up to 6 roles as Markdown bullets with [title](path) links ONLY when path is provided; one line of context each.
5. **Practical tips for applicants** — 3–4 actionable bullets (resume, timing, categories to watch).
6. **Looking ahead** — short forward-looking paragraph (next few days, seasonal patterns, sectors to watch).
7. **Editor's note** — one sentence that ${siteName} aggregates listings; verify details on the original employer posting.

## Internal links (include at least 4 naturally in the body)
${internalLinks}

## Output format
Return JSON with keys: title, slug, excerpt, body, angle_id, editorial_notes.
Site URL for absolute references when needed: ${siteUrl}
`;
};

export const DAILY_BLOG_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    slug: { type: 'STRING' },
    excerpt: { type: 'STRING' },
    body: { type: 'STRING' },
    angle_id: { type: 'STRING' },
    editorial_notes: { type: 'STRING' },
  },
  required: ['title', 'slug', 'excerpt', 'body', 'angle_id'],
};

export const parseDailyBlogGeminiJson = (raw: unknown) => {
  const parsed =
    typeof raw === 'string'
      ? JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim())
      : raw;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Gemini blog response was not an object.');
  }

  const record = parsed as Record<string, unknown>;
  if (!record.title || !record.body) {
    throw new Error('Gemini blog response missing title or body.');
  }

  return {
    title: String(record.title).trim(),
    slug: String(record.slug || '').trim(),
    excerpt: String(record.excerpt || '').trim(),
    body: String(record.body).trim(),
    angleId: String(record.angle_id || '').trim(),
    editorialNotes: String(record.editorial_notes || '').trim(),
  };
};
