import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import {
  buildFullSlideSvg,
  cleanJobTitle,
  DEFAULT_MAX_JOBS,
  LOGO_PATH,
  SHORT_HEIGHT,
  SHORT_WIDTH,
  shortCompanyName,
  truncate,
} from './youtube-short-overlay.mjs';

export {
  DEFAULT_MAX_JOBS,
  DEFAULT_SECONDS_PER_SLIDE,
  SHORT_HEIGHT,
  SHORT_WIDTH,
} from './youtube-short-overlay.mjs';

async function compositeLogoOnSlide(svg) {
  const base = sharp(Buffer.from(svg)).png();
  try {
    await fs.access(LOGO_PATH);
    const logo = await sharp(LOGO_PATH)
      .resize(108, 108, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return base.composite([{ input: logo, top: 56, left: Math.floor((SHORT_WIDTH - 108) / 2) }]).png().toBuffer();
  } catch {
    return base.png().toBuffer();
  }
}

export function pickJobsForShort(jobs, maxJobs = DEFAULT_MAX_JOBS) {
  const sorted = [...jobs].sort((a, b) => {
    const aTime = new Date(a.posted_at || 0).getTime();
    const bTime = new Date(b.posted_at || 0).getTime();
    return bTime - aTime;
  });

  return sorted.slice(0, Math.max(1, maxJobs));
}

export async function renderShortSlides({ jobs, istDate, outputDir }) {
  await fs.mkdir(outputDir, { recursive: true });

  const selectedJobs = pickJobsForShort(jobs);
  const slideSpecs = [
    { kind: 'intro', filename: 'slide-00-intro.png' },
    ...selectedJobs.map((job, index) => ({
      kind: 'job',
      job,
      jobIndex: index + 1,
      jobCount: selectedJobs.length,
      filename: `slide-${String(index + 1).padStart(2, '0')}-job.png`,
    })),
    { kind: 'outro', filename: `slide-${String(selectedJobs.length + 1).padStart(2, '0')}-outro.png` },
  ];

  const slidePaths = [];

  for (const spec of slideSpecs) {
    const svg = buildFullSlideSvg({
      kind: spec.kind,
      istDate,
      job: spec.job,
      jobIndex: spec.jobIndex,
      jobCount: spec.jobCount || selectedJobs.length,
      allJobs: selectedJobs,
    });
    const outputPath = path.join(outputDir, spec.filename);
    const pngBuffer = await compositeLogoOnSlide(svg);
    await fs.writeFile(outputPath, pngBuffer);
    slidePaths.push(outputPath);
  }

  return {
    slidePaths,
    selectedJobs,
    renderer: 'slides',
  };
}

function yearFromIstDate(istDate) {
  return String(istDate || '').slice(0, 4) || String(new Date().getFullYear());
}

const KNOWN_COMPANY_BRANDS = [
  { match: /\btcs\b/i, tag: 'tcs', label: 'TCS' },
  { match: /\binfosys\b/i, tag: 'infosys', label: 'Infosys' },
  { match: /\bwipro\b/i, tag: 'wipro', label: 'Wipro' },
  { match: /\baccenture\b/i, tag: 'accenture', label: 'Accenture' },
  { match: /\bcognizant\b/i, tag: 'cognizant', label: 'Cognizant' },
  { match: /\bhcl\b/i, tag: 'hcl', label: 'HCL' },
  { match: /\btech\s*mahindra\b/i, tag: 'tech mahindra', label: 'Tech Mahindra' },
  { match: /\bcapgemini\b/i, tag: 'capgemini', label: 'Capgemini' },
  { match: /\bibm\b/i, tag: 'ibm', label: 'IBM' },
  { match: /\bamazon\b/i, tag: 'amazon', label: 'Amazon' },
  { match: /\bflipkart\b/i, tag: 'flipkart', label: 'Flipkart' },
  { match: /\baccor\b/i, tag: 'accor', label: 'Accor' },
  { match: /\bdeloitte\b/i, tag: 'deloitte', label: 'Deloitte' },
  { match: /\bgenpact\b/i, tag: 'genpact', label: 'Genpact' },
];

function detectCompanyBrand(company) {
  const text = String(company || '');
  return KNOWN_COMPANY_BRANDS.find((brand) => brand.match.test(text)) || null;
}

function detectBrandsFromJobs(jobs) {
  const seen = new Set();
  const brands = [];
  for (const job of jobs || []) {
    const brand = detectCompanyBrand(job?.company);
    if (brand && !seen.has(brand.tag)) {
      seen.add(brand.tag);
      brands.push(brand);
    }
  }
  return brands;
}

function categorySeoTags(category, year) {
  const value = String(category || '').toLowerCase();
  const tags = [];

  if (value.includes('it') || value.includes('software')) {
    tags.push(`IT jobs in vizag ${year}`, 'software jobs vizag', 'tech jobs vizag', `IT jobs vizag ${year}`);
  }
  if (value.includes('bank')) {
    tags.push('banking jobs vizag', `bank jobs in vizag ${year}`, 'finance jobs vizag');
  }
  if (value.includes('civil')) {
    tags.push('civil jobs vizag', 'civil engineer jobs vizag', `civil jobs in vizag ${year}`);
  }
  if (value.includes('hospitality') || value.includes('retail')) {
    tags.push('hotel jobs vizag', 'hospitality jobs vizag', 'retail jobs vizag');
  }
  if (value.includes('logistic')) {
    tags.push('logistics jobs vizag', 'supply chain jobs vizag');
  }
  if (value.includes('mechanical') || value.includes('engineering')) {
    tags.push('engineering jobs vizag', 'mechanical jobs vizag');
  }
  if (value.includes('support') || value.includes('bpo')) {
    tags.push('BPO jobs vizag', 'customer support jobs vizag');
  }

  return tags;
}

function collectTags(candidates, maxChars = 495) {
  const seen = new Set();
  const tags = [];
  let totalChars = 0;

  for (const candidate of candidates) {
    const tag = String(candidate || '').trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) {
      continue;
    }
    if (totalChars + tag.length + 1 > maxChars) {
      break;
    }
    seen.add(key);
    tags.push(tag);
    totalChars += tag.length + 1;
  }

  return tags;
}

function buildSeoTitle({ leadJob, selectedJobs, year, hasFresher }) {
  const jobTitle = cleanJobTitle(leadJob?.title, leadJob?.company);
  const leadBrand = detectCompanyBrand(leadJob?.company);
  const otherBrand = detectBrandsFromJobs(selectedJobs).find((brand) => brand.tag !== leadBrand?.tag);

  if (leadBrand) {
    const companyTitle = `${leadBrand.label} Jobs in Vizag ${year} | Latest Jobs in Vizag Today #Shorts`;
    if (companyTitle.length <= 100) {
      return companyTitle;
    }
  }

  if (leadJob?.is_fresher || (hasFresher && !otherBrand)) {
    const fresherTitles = [
      `Fresher Jobs in Vizag ${year} | Latest Jobs in Vizag Today #Shorts`,
      `Latest Jobs in Vizag Today ${year} | Fresher Jobs in Vizag #Shorts`,
      `${truncate(jobTitle, 22)} | Fresher Jobs in Vizag ${year} #Shorts`,
    ];
    const match = fresherTitles.find((entry) => entry.length <= 100);
    if (match) {
      return match;
    }
  }

  if (otherBrand) {
    const companyTitle = `${otherBrand.label} Jobs in Vizag ${year} | Latest Jobs in Vizag Today #Shorts`;
    if (companyTitle.length <= 100) {
      return companyTitle;
    }
  }

  if (hasFresher) {
    const fresherTitles = [
      `Fresher Jobs in Vizag ${year} | Latest Jobs in Vizag Today #Shorts`,
      `Latest Jobs in Vizag Today ${year} | Fresher Jobs in Vizag #Shorts`,
    ];
    const match = fresherTitles.find((entry) => entry.length <= 100);
    if (match) {
      return match;
    }
  }

  const defaultTitles = [
    `Latest Jobs in Vizag Today ${year} | Jobs in Vizag ${year} #Shorts`,
    `Jobs in Vizag Today ${year} | Latest Openings in Vizag #Shorts`,
    `${truncate(jobTitle, 24)} | Latest Jobs in Vizag ${year} #Shorts`,
  ];
  const match = defaultTitles.find((entry) => entry.length <= 100);
  return match || truncate(defaultTitles[0], 97);
}

function buildJobDescriptionLine(job, index, siteUrl) {
  const title = cleanJobTitle(job.title, job.company);
  const company = shortCompanyName(job.company);
  const parts = [company, job.experience, job.salary].filter(Boolean);
  const detail = parts.join(' • ');
  const link = job.slug ? `${siteUrl}/jobs/${job.slug}` : `${siteUrl}/jobs`;
  return `${index + 1}. ${title} — ${detail}\n   Apply: ${link}`;
}

function buildSeoTags({ leadJob, selectedJobs, year, hasFresher }) {
  const jobTitle = cleanJobTitle(leadJob?.title, leadJob?.company);
  const brands = detectBrandsFromJobs(selectedJobs);
  const categories = [...new Set((selectedJobs || []).map((job) => String(job?.category || '').trim()).filter(Boolean))];

  const coreKeywords = [
    'latest jobs in vizag',
    `latest jobs in vizag ${year}`,
    `fresher jobs in vizag ${year}`,
    `jobs in vizag today ${year}`,
    'jobs in vizag today',
    `jobs in vizag ${year}`,
    'vizag jobs today',
    `vizag jobs today ${year}`,
    `visakhapatnam jobs ${year}`,
    'visakhapatnam jobs',
    'jobs in visakhapatnam today',
    'vizag job openings today',
    'vizag job openings',
    'vizag hiring',
    `vizag hiring ${year}`,
    'jobsinvizag',
    'andhra pradesh jobs',
    `andhra pradesh jobs ${year}`,
    'job vacancy vizag',
    'careers in vizag',
    'today jobs in vizag',
  ];

  const fresherKeywords = hasFresher
    ? [
        'fresher jobs vizag',
        'fresher jobs in vizag',
        'jobs for freshers in vizag',
        'freshers jobs in visakhapatnam',
        'graduate jobs vizag',
        'entry level jobs vizag',
        'fresher job openings vizag',
        'campus jobs vizag',
      ]
    : [];

  const companyKeywords = brands.flatMap((brand) => [
    `${brand.tag} jobs in vizag ${year}`,
    `${brand.tag} jobs vizag`,
    `${brand.label} jobs in vizag`,
    `${brand.tag} careers vizag`,
  ]);

  const roleKeywords = [
    truncate(`${jobTitle} jobs vizag`, 48),
    truncate(`${jobTitle} jobs in vizag ${year}`, 48),
    truncate(`${jobTitle} job in vizag`, 48),
  ];

  const categoryKeywords = categories.flatMap((category) => categorySeoTags(category, year));

  const longTailKeywords = [
    'part time jobs vizag',
    'private jobs vizag',
    'walk in interview vizag',
    'daily job updates vizag',
    'vizag jobs alert',
    'job search vizag',
    'hiring in vizag',
    'job fair vizag',
    'vizag jobs for freshers',
    'new jobs in vizag',
    'job openings visakhapatnam today',
    'Shorts',
  ];

  return collectTags([
    ...coreKeywords,
    ...fresherKeywords,
    ...companyKeywords,
    ...roleKeywords,
    ...categoryKeywords,
    ...longTailKeywords,
  ]);
}

function buildKeywordSearchLine({ selectedJobs, year, hasFresher, brands }) {
  const parts = [
    'latest jobs in vizag',
    `fresher jobs in vizag ${year}`,
    `jobs in vizag today ${year}`,
    `jobs in vizag ${year}`,
    'visakhapatnam jobs',
    'vizag hiring',
  ];

  for (const brand of brands) {
    parts.push(`${brand.tag} jobs in vizag ${year}`);
  }

  for (const job of selectedJobs || []) {
    const title = cleanJobTitle(job?.title, job?.company);
    if (title) {
      parts.push(`${title.toLowerCase()} jobs vizag`);
    }
  }

  if (hasFresher) {
    parts.push('jobs for freshers in vizag', 'fresher job openings vizag');
  }

  return [...new Set(parts)].slice(0, 18).join(', ');
}

function buildHashtags({ year, hasFresher, brands }) {
  const tags = [
    '#jobsinvizag',
    '#vizaghiring',
    '#LatestJobsInVizag',
    '#JobsInVizagToday',
    `#JobsInVizag${year}`,
    '#VisakhapatnamJobs',
    '#VizagJobs',
    '#AndhraPradeshJobs',
    '#JobSearchVizag',
    '#VizagJobAlert',
  ];

  if (hasFresher) {
    tags.push('#FresherJobsVizag', '#FreshersJobsInVizag', `#FresherJobsInVizag${year}`);
  }

  for (const brand of brands) {
    tags.push(`#${brand.label.replace(/\s+/g, '')}JobsVizag`);
  }

  tags.push('#ITJobsVizag', '#CivilJobsVizag', '#PartTimeJobsVizag', '#Shorts');

  return tags.join(' ');
}

function buildSeoDescription({
  istDate,
  year,
  formattedDate,
  selectedJobs,
  leadJob,
  leadTitle,
  hasFresher,
  siteUrl,
  jobLines,
}) {
  const brands = detectBrandsFromJobs(selectedJobs);
  const leadCompany = shortCompanyName(leadJob?.company);
  const brand = detectCompanyBrand(leadJob?.company) || brands[0];

  const intro = `Latest jobs in Vizag ${year} — jobs in Vizag today (${formattedDate}). Find fresher jobs in Vizag ${year}, IT openings, and latest job openings in Visakhapatnam on JobsInVizag.in.`;

  const featured = brand
    ? `🔥 ${brand.label} jobs in Vizag ${year} featured: ${leadTitle} plus more latest jobs in Vizag today.`
    : `🔥 Featured today: ${leadTitle}${leadCompany ? ` at ${leadCompany}` : ''} — latest jobs in Vizag & Visakhapatnam hiring now.`;

  const bullets = [
    hasFresher
      ? `✅ Fresher jobs in Vizag ${year} — graduate & entry-level roles`
      : '✅ Latest hiring updates in Visakhapatnam (Vizag)',
    '✅ IT, banking, civil, logistics, hospitality & part-time jobs',
    '✅ Free to browse — direct apply links below',
  ];

  const keywordLine = buildKeywordSearchLine({ selectedJobs, year, hasFresher, brands });
  const hashtags = buildHashtags({ year, hasFresher, brands });

  return [
    intro,
    '',
    featured,
    ...bullets,
    '',
    "📌 Today's job openings in Vizag:",
    '',
    ...jobLines,
    '',
    `🔗 Latest jobs in Vizag ${year}: ${siteUrl}/jobs`,
    `🔗 Fresher jobs in Vizag ${year}: ${siteUrl}/jobs/fresher`,
    `🔗 IT jobs: ${siteUrl}/jobs/it | Civil jobs: ${siteUrl}/jobs/civil | Part-time: ${siteUrl}/jobs/part-time`,
    '',
    `🔍 Search keywords: ${keywordLine}`,
    '',
    hashtags,
    '',
    `vizag-jobs-short:${istDate}`,
  ].join('\n');
}

export function buildShortMetadata({ istDate, jobs, siteUrl = 'https://jobsinvizag.in' }) {
  const selectedJobs = pickJobsForShort(jobs);
  const year = yearFromIstDate(istDate);
  const leadJob = selectedJobs[0];
  const leadTitle = cleanJobTitle(leadJob?.title, leadJob?.company);
  const hasFresher = selectedJobs.some((job) => Boolean(job?.is_fresher));

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${istDate}T12:00:00+05:30`));

  const title = buildSeoTitle({ leadJob, selectedJobs, year, hasFresher });
  const jobLines = selectedJobs.map((job, index) => buildJobDescriptionLine(job, index, siteUrl));
  const description = buildSeoDescription({
    istDate,
    year,
    formattedDate,
    selectedJobs,
    leadJob,
    leadTitle,
    hasFresher,
    siteUrl,
    jobLines,
  });
  const tags = buildSeoTags({ leadJob, selectedJobs, year, hasFresher });

  return {
    title,
    description,
    tags,
    selectedJobs,
    marker: istDate,
  };
}
