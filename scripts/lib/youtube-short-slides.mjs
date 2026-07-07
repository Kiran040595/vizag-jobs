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

function buildSeoTitle({ leadJob, year, hasFresher }) {
  const jobTitle = cleanJobTitle(leadJob?.title, leadJob?.company);
  const shortJob = truncate(jobTitle, 30);

  const templates = hasFresher
    ? [
        `${shortJob} Jobs in Vizag ${year} | Latest Fresher Jobs in Vizag #Shorts`,
        `${shortJob} | Jobs for Fresher in Vizag ${year} | Latest Jobs #Shorts`,
      ]
    : [
        `${shortJob} Jobs in Vizag ${year} | Latest Jobs in Vizag #Shorts`,
        `${shortJob} | Latest Jobs in Vizag ${year} | Vizag Hiring #Shorts`,
      ];

  const title = templates.find((entry) => entry.length <= 100) || templates[0];
  return title.length <= 100 ? title : truncate(title, 97);
}

function buildJobDescriptionLine(job, index, siteUrl) {
  const title = cleanJobTitle(job.title, job.company);
  const parts = [job.company, job.experience, job.salary].filter(Boolean);
  const detail = parts.join(' • ');
  const link = job.slug ? `${siteUrl}/jobs/${job.slug}` : `${siteUrl}/jobs`;
  return `${index + 1}. ${title} — ${detail}\n   Apply: ${link}`;
}

function buildSeoTags({ leadJob, year, hasFresher }) {
  const jobTitle = cleanJobTitle(leadJob?.title, leadJob?.company);
  const candidates = [
    'jobs in vizag 2026',
    'latest jobs in vizag',
    'jobs for fresher in vizag',
    'jobsinvizag',
    'vizag hiring',
    `jobs in vizag ${year}`,
    'visakhapatnam jobs',
    'vizag jobs today',
    'job openings vizag',
    'andhra pradesh jobs',
    truncate(`${jobTitle} vizag`, 40),
    'fresher jobs vizag',
    'IT jobs vizag',
    'civil jobs vizag',
    'part time jobs vizag',
    'banking jobs vizag',
    'hospitality jobs vizag',
    'vizag job alert',
    'jobs in visakhapatnam',
    'daily job updates vizag',
    'Shorts',
  ];

  if (hasFresher) {
    candidates.push('graduate jobs vizag', 'entry level jobs vizag');
  }

  const seen = new Set();
  const tags = [];
  let totalChars = 0;

  for (const candidate of candidates) {
    const tag = String(candidate || '').trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) {
      continue;
    }
    if (totalChars + tag.length + 1 > 480) {
      break;
    }
    seen.add(key);
    tags.push(tag);
    totalChars += tag.length + 1;
  }

  return tags;
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

  const title = buildSeoTitle({ leadJob, year, hasFresher });
  const jobLines = selectedJobs.map((job, index) => buildJobDescriptionLine(job, index, siteUrl));

  const hashtags = [
    '#jobsinvizag',
    '#vizaghiring',
    '#VizagJobs',
    '#LatestJobsInVizag',
    `#JobsInVizag${year}`,
    '#FresherJobsVizag',
    '#VisakhapatnamJobs',
    '#AndhraPradeshJobs',
    '#ITJobsVizag',
    '#CivilJobsVizag',
    '#PartTimeJobsVizag',
    '#JobSearchVizag',
    '#Shorts',
  ].join(' ');

  const description = [
    `Latest jobs in Vizag ${year} — ${formattedDate}`,
    `Featured opening: ${leadTitle} | More latest jobs in Visakhapatnam today.`,
  ];

  if (hasFresher) {
    description.push('Includes jobs for fresher in Vizag — graduate & entry-level friendly roles.');
  }

  description.push(
    '',
    "📌 Today's featured jobs:",
    '',
    ...jobLines,
    '',
    `👉 All latest jobs in Vizag ${year}: ${siteUrl}/jobs`,
    `👉 Fresher jobs in Vizag: ${siteUrl}/jobs/fresher`,
    `👉 Today's blog: ${siteUrl}/blog`,
    '',
    hashtags,
    '',
    `vizag-jobs-short:${istDate}`,
  );

  const tags = buildSeoTags({ leadJob, year, hasFresher });

  return {
    title,
    description: description.join('\n'),
    tags,
    selectedJobs,
    marker: istDate,
  };
}
