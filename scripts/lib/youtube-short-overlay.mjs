import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SHORT_WIDTH = 1080;
export const SHORT_HEIGHT = 1920;
export const DEFAULT_SECONDS_PER_SLIDE = 4.5;
export const DEFAULT_MAX_JOBS = 3;

export const LOGO_PATH = path.resolve(__dirname, '../../public/logo.png');

const PANEL = {
  x: 24,
  y: 560,
  width: 1032,
  height: 1300,
  radius: 48,
  padX: 44,
  padTop: 40,
};

export const BRAND = {
  siteName: 'JobsInVizag.in',
  siteUrl: 'jobsinvizag.in',
  panelTop: 'rgba(10,20,48,0.98)',
  panelBottom: 'rgba(2,6,16,0.99)',
  panelBorder: '#22d3ee',
  rowBg: 'rgba(18,32,58,0.95)',
  rowBorder: 'rgba(56,189,248,0.35)',
  accent: '#22d3ee',
  accentBright: '#38bdf8',
  accentSoft: '#7dd3fc',
  accentWarm: '#fcd34d',
  text: '#ffffff',
  muted: '#e2e8f0',
  label: '#bae6fd',
  badge: '#2563eb',
  fresher: '#10b981',
  ctaTop: '#22d3ee',
  ctaBottom: '#06b6d4',
  ctaText: '#021018',
  bg: '#030712',
  bgGlow: '#0c1929',
};

export function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function truncate(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

export function wrapLines(value, maxCharsPerLine, maxLines) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [''];
  }

  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
    if (lines.length >= maxLines - 1) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (words.join(' ').length > lines.join(' ').length && lines.length > 0) {
    lines[lines.length - 1] = truncate(lines[lines.length - 1], maxCharsPerLine);
  }

  return lines.slice(0, maxLines);
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shortCompanyName(name) {
  return String(name || '')
    .replace(/\s+private\s+limited$/i, '')
    .replace(/\s+pvt\.?\s+ltd\.?$/i, '')
    .replace(/\s+ltd\.?$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function cleanJobTitle(title, company) {
  let text = String(title || '').trim();
  text = text.split('|')[0].trim();
  text = text.replace(/^vizag\s*:\s*/i, '');
  text = text.replace(/^vizag\s+/i, '');
  text = text.replace(/\s+in\s+visakhapatnam\b/gi, '');
  text = text.replace(/\s+in\s+vizag\b/gi, '');
  text = text.replace(/\s+jobs?\s*$/i, '').trim();

  const companyNorm = String(company || '').replace(/\s+/g, ' ').trim();
  if (companyNorm) {
    const patterns = [
      new RegExp(`\\s*\\|\\s*${escapeRegex(companyNorm)}`, 'i'),
      new RegExp(`\\s+at\\s+${escapeRegex(companyNorm)}`, 'i'),
      new RegExp(`\\s*-\\s*${escapeRegex(companyNorm)}`, 'i'),
      new RegExp(`\\s+${escapeRegex(companyNorm)}\\s*$`, 'i'),
    ];
    for (const pattern of patterns) {
      text = text.replace(pattern, '').trim();
    }
  }

  return text.replace(/\s{2,}/g, ' ').trim() || 'Job opening';
}

function shortCategory(category) {
  const value = String(category || '').trim();
  const shortcuts = {
    'logistics & supply chain': 'Logistics',
    'banking & finance': 'Banking & Finance',
    'hospitality & retail': 'Hospitality',
    'it & software': 'IT & Software',
    'customer support': 'Customer Support',
  };
  const key = value.toLowerCase();
  if (shortcuts[key]) {
    return shortcuts[key];
  }
  return truncate(value, 22);
}

function sanitizeVagueWorkText(value) {
  const text = String(value || '').trim();
  if (/work arrangement discussed/i.test(text)) {
    return '';
  }
  return text;
}

function cleanWorkMode(workMode) {
  const cleaned = sanitizeVagueWorkText(workMode);
  return cleaned || 'At interview';
}

function formatLocationOnly(location) {
  const loc = sanitizeVagueWorkText(location);
  if (loc && /vishakhapatnam|visakhapatnam/i.test(loc)) {
    return 'Vizag, AP';
  }
  if (loc) {
    return truncate(loc, 28);
  }
  return 'Vizag, AP';
}

function openingLabel(count) {
  const n = Number(count) || 0;
  return n === 1 ? '1 NEW OPENING TODAY' : `${n} NEW OPENINGS TODAY`;
}

function svgDefs() {
  return `
    <defs>
      <linearGradient id="panelGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${BRAND.panelTop}" />
        <stop offset="100%" stop-color="${BRAND.panelBottom}" />
      </linearGradient>
      <linearGradient id="ctaGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${BRAND.ctaTop}" />
        <stop offset="100%" stop-color="${BRAND.ctaBottom}" />
      </linearGradient>
      <linearGradient id="highlightGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgba(251,191,36,0.25)" />
        <stop offset="100%" stop-color="rgba(34,211,238,0.15)" />
      </linearGradient>
      <filter id="textShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.95" />
      </filter>
      <filter id="panelGlow" x="-8%" y="-4%" width="116%" height="112%">
        <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#22d3ee" flood-opacity="0.35" />
      </filter>
    </defs>
  `;
}

export function buildTextBlock({
  x,
  y,
  lines,
  fontSize,
  fill,
  fontWeight = 600,
  lineHeight = 1.22,
  anchor = 'start',
  shadow = true,
  letterSpacing = 0,
}) {
  const anchorAttr = anchor === 'middle' ? ' text-anchor="middle"' : '';
  const filterAttr = shadow ? ' filter="url(#textShadow)"' : '';
  const spacingAttr = letterSpacing ? ` letter-spacing="${letterSpacing}"` : '';
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : fontSize * lineHeight;
      return `<tspan x="${x}" dy="${index === 0 ? 0 : dy}">${escapeXml(line)}</tspan>`;
    })
    .join('');

  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}"${anchorAttr}${filterAttr}${spacingAttr}>${tspans}</text>`;
}

function pill(label, x, y, fill, textColor = '#ffffff', maxWidth = 320) {
  const width = Math.min(maxWidth, Math.max(140, label.length * 14 + 48));
  return {
    width,
    svg: `
      <rect x="${x}" y="${y}" width="${width}" height="54" rx="27" fill="${fill}" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
      ${buildTextBlock({ x: x + width / 2, y: y + 36, lines: [label], fontSize: 26, fill: textColor, fontWeight: 800, anchor: 'middle' })}
    `,
  };
}

function detailCell({ icon, label, value, x, y, width, height }) {
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="22" fill="${BRAND.rowBg}" stroke="${BRAND.rowBorder}" stroke-width="2" />
    ${buildTextBlock({ x: x + 20, y: y + 42, lines: [icon], fontSize: 32, fill: BRAND.accentBright, fontWeight: 800 })}
    ${buildTextBlock({ x: x + 64, y: y + 34, lines: [label], fontSize: 22, fill: BRAND.label, fontWeight: 700, letterSpacing: 0.5 })}
    ${buildTextBlock({
      x: x + 64,
      y: y + 68,
      lines: wrapLines(value, Math.floor((width - 72) / 16), 2),
      fontSize: 32,
      fill: BRAND.text,
      fontWeight: 800,
      lineHeight: 1.12,
    })}
  `;
}

function detailGrid(details, startY) {
  const x = PANEL.x + PANEL.padX;
  const totalW = PANEL.width - PANEL.padX * 2;
  const gap = 14;
  const cellW = Math.floor((totalW - gap) / 2);
  const cellH = 96;
  const rows = [];

  for (let index = 0; index < details.length; index += 1) {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const cellX = x + col * (cellW + gap);
    const cellY = startY + row * (cellH + gap);
    rows.push(detailCell({ ...details[index], x: cellX, y: cellY, width: cellW, height: cellH }));
  }

  const rowCount = Math.ceil(details.length / 2);
  return { svg: rows.join(''), height: rowCount * cellH + Math.max(0, rowCount - 1) * gap };
}

function bottomPanel(children) {
  return `
    ${svgDefs()}
    <rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.width}" height="${PANEL.height}" rx="${PANEL.radius}" fill="url(#panelGrad)" stroke="${BRAND.panelBorder}" stroke-width="3" filter="url(#panelGlow)" />
    <rect x="${PANEL.x + 20}" y="${PANEL.y + 20}" width="10" height="${PANEL.height - 40}" rx="5" fill="${BRAND.accent}" opacity="0.9" />
    ${children}
  `;
}

function highlightBanner(text, y) {
  const x = PANEL.x + PANEL.padX;
  const width = PANEL.width - PANEL.padX * 2;
  return `
    <rect x="${x}" y="${y}" width="${width}" height="52" rx="16" fill="url(#highlightGrad)" stroke="rgba(251,191,36,0.45)" stroke-width="1.5" />
    ${buildTextBlock({ x: x + 20, y: y + 34, lines: [text], fontSize: 28, fill: BRAND.accentWarm, fontWeight: 800 })}
  `;
}

function ctaButton(label, y) {
  const x = PANEL.x + PANEL.padX;
  const width = PANEL.width - PANEL.padX * 2;
  return `
    <rect x="${x}" y="${y}" width="${width}" height="104" rx="52" fill="url(#ctaGrad)" stroke="rgba(255,255,255,0.35)" stroke-width="2" />
    ${buildTextBlock({ x: SHORT_WIDTH / 2, y: y + 66, lines: [label], fontSize: 36, fill: BRAND.ctaText, fontWeight: 900, anchor: 'middle', shadow: true })}
  `;
}

function introJobRow(item, y) {
  const x = PANEL.x + PANEL.padX;
  const width = PANEL.width - PANEL.padX * 2;
  const company = truncate(shortCompanyName(item.company), 34);
  const meta = [item.experience, item.salary].filter(Boolean).join('  •  ');
  return `
    <rect x="${x}" y="${y}" width="${width}" height="136" rx="20" fill="${BRAND.rowBg}" stroke="${BRAND.rowBorder}" stroke-width="2" />
    <circle cx="${x + 36}" cy="${y + 36}" r="24" fill="${BRAND.accent}" />
    ${buildTextBlock({ x: x + 36, y: y + 44, lines: [String(item.index)], fontSize: 28, fill: BRAND.ctaText, fontWeight: 900, anchor: 'middle' })}
    ${buildTextBlock({ x: x + 72, y: y + 44, lines: [item.title], fontSize: 32, fill: BRAND.text, fontWeight: 900 })}
    ${buildTextBlock({ x: x + 72, y: y + 80, lines: [company], fontSize: 28, fill: BRAND.accentSoft, fontWeight: 700 })}
    ${buildTextBlock({ x: x + 72, y: y + 116, lines: [meta], fontSize: 26, fill: BRAND.muted, fontWeight: 600 })}
  `;
}

export function getSlideContent({ kind, istDate, job, jobIndex, jobCount, allJobs = [] }) {
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${istDate}T12:00:00+05:30`));

  if (kind === 'intro') {
    return {
      kind,
      pill: 'VIZAG JOBS DAILY',
      title: "Today's Top Picks",
      subtitle: openingLabel(jobCount),
      dateLine: `Visakhapatnam • ${formattedDate}`,
      jobList: allJobs.map((entry, index) => ({
        index: index + 1,
        title: cleanJobTitle(entry?.title, entry?.company),
        company: String(entry?.company || 'Company').trim(),
        experience: entry?.experience || 'Not specified',
        salary: entry?.salary ? String(entry.salary).trim() : 'Salary not disclosed',
      })),
      chips: ['IT', 'Fresher', 'Civil', 'Part-time', 'Banking'],
      cta: null,
    };
  }

  if (kind === 'outro') {
    return {
      kind,
      pill: 'MORE OPENINGS',
      title: 'Find your next role',
      subtitle: 'jobsinvizag.in',
      dateLine: 'Link in description ↓',
      body: 'Fresh listings every day — IT, fresher, civil, banking, hospitality & part-time roles in Vizag.',
      bullets: ['✓ 100% free to browse', '✓ Updated daily', '✓ Direct apply links'],
      chips: ['IT', 'Fresher', 'Civil', 'Part-time'],
      cta: 'Open jobsinvizag.in',
    };
  }

  const company = String(job?.company || '').trim() || 'Company not listed';
  const categoryFull = String(job?.category || '').trim();

  return {
    kind: 'job',
    pill: `JOB ${jobIndex} OF ${jobCount}`,
    title: cleanJobTitle(job?.title, company),
    subtitle: company,
    category: categoryFull ? shortCategory(categoryFull) : null,
    isFresher: Boolean(job?.is_fresher),
    highlight: job?.is_fresher ? '✓ Fresher & graduate friendly' : '✓ Hiring now in Visakhapatnam',
    details: [
      { icon: '₹', label: 'SALARY', value: job?.salary ? String(job.salary).trim() : 'Not disclosed' },
      { icon: '★', label: 'EXPERIENCE', value: job?.experience || 'Not specified' },
      { icon: '◎', label: 'WORK MODE', value: cleanWorkMode(job?.work_mode) },
      { icon: '⌂', label: 'LOCATION', value: formatLocationOnly(job?.location) },
      { icon: '⏱', label: 'JOB TYPE', value: job?.job_type || 'Full-time' },
    ],
    cta: 'Apply on jobsinvizag.in',
  };
}

function buildJobPanel(content) {
  const x = PANEL.x + PANEL.padX;
  let y = PANEL.y + PANEL.padTop;

  const eyebrow = buildTextBlock({ x, y, lines: [content.pill], fontSize: 30, fill: BRAND.accentSoft, fontWeight: 900, letterSpacing: 1.2 });
  y += 54;

  const title = buildTextBlock({
    x,
    y: y + 52,
    lines: wrapLines(content.title, 20, 2),
    fontSize: 58,
    fill: BRAND.text,
    fontWeight: 900,
    lineHeight: 1.06,
  });
  y += content.title.length > 22 ? 148 : 118;

  const company = buildTextBlock({
    x,
    y,
    lines: wrapLines(shortCompanyName(content.subtitle), 32, 2),
    fontSize: 40,
    fill: BRAND.accentSoft,
    fontWeight: 700,
    lineHeight: 1.14,
  });
  y += content.subtitle.length > 32 ? 92 : 58;

  let badges = '';
  let badgeX = x;
  if (content.category) {
    const cat = pill(content.category, badgeX, y, BRAND.badge, '#ffffff', 300);
    badges += cat.svg;
    badgeX += cat.width + 14;
  }
  if (content.isFresher) {
    const fresher = pill('Fresher', badgeX, y, BRAND.fresher, '#ffffff', 160);
    badges += fresher.svg;
  }
  y += 72;

  const highlight = highlightBanner(content.highlight, y);
  y += 68;

  const ctaY = PANEL.y + PANEL.height - 124;
  const grid = detailGrid(content.details, y);
  const cta = ctaButton(content.cta, ctaY);

  return bottomPanel(`
    ${eyebrow}
    ${title}
    ${company}
    ${badges}
    ${highlight}
    ${grid.svg}
    ${cta}
  `);
}

function buildIntroPanel(content) {
  const x = PANEL.x + PANEL.padX;
  let y = PANEL.y + PANEL.padTop;

  const eyebrow = buildTextBlock({ x, y, lines: [content.pill], fontSize: 30, fill: BRAND.accentSoft, fontWeight: 900, letterSpacing: 1.2 });
  y += 54;

  const title = buildTextBlock({ x, y: y + 52, lines: [content.title], fontSize: 60, fill: BRAND.text, fontWeight: 900 });
  y += 112;

  const subtitle = buildTextBlock({ x, y, lines: [content.subtitle], fontSize: 42, fill: BRAND.accentBright, fontWeight: 900 });
  y += 56;

  const dateLine = buildTextBlock({ x, y, lines: [content.dateLine], fontSize: 30, fill: BRAND.muted, fontWeight: 600 });
  y += 52;

  const jobList = (content.jobList || [])
    .map((item, index) => introJobRow(item, y + index * 146))
    .join('');
  y += (content.jobList || []).length * 146 + 20;

  let chips = '';
  let chipX = x;
  for (const chip of content.chips || []) {
    const item = pill(chip, chipX, y, 'rgba(30,58,95,0.95)', BRAND.accentSoft, 170);
    chips += item.svg;
    chipX += item.width + 12;
    if (chipX > PANEL.x + PANEL.width - 190) {
      chipX = x;
      y += 62;
    }
  }

  return bottomPanel(`
    ${eyebrow}
    ${title}
    ${subtitle}
    ${dateLine}
    ${jobList}
    ${chips}
  `);
}

function buildOutroPanel(content) {
  const x = PANEL.x + PANEL.padX;
  let y = PANEL.y + PANEL.padTop;

  const eyebrow = buildTextBlock({ x, y, lines: [content.pill], fontSize: 30, fill: BRAND.accentSoft, fontWeight: 900, letterSpacing: 1.2 });
  y += 54;

  const title = buildTextBlock({ x, y: y + 52, lines: [content.title], fontSize: 60, fill: BRAND.text, fontWeight: 900 });
  y += 112;

  const subtitle = buildTextBlock({ x, y, lines: [content.subtitle], fontSize: 44, fill: BRAND.accentBright, fontWeight: 900 });
  y += 60;

  const dateLine = buildTextBlock({ x, y, lines: [content.dateLine], fontSize: 30, fill: BRAND.muted, fontWeight: 600 });
  y += 48;

  const body = buildTextBlock({
    x,
    y,
    lines: wrapLines(content.body, 40, 3),
    fontSize: 30,
    fill: BRAND.muted,
    fontWeight: 600,
    lineHeight: 1.3,
  });
  y += 108;

  const bullets = (content.bullets || [])
    .map((line, index) =>
      buildTextBlock({ x, y: y + index * 50, lines: [line], fontSize: 34, fill: BRAND.text, fontWeight: 700 }),
    )
    .join('');
  y += (content.bullets || []).length * 50 + 28;

  let chips = '';
  let chipX = x;
  for (const chip of content.chips || []) {
    const item = pill(chip, chipX, y, 'rgba(30,58,95,0.95)', BRAND.accentSoft, 170);
    chips += item.svg;
    chipX += item.width + 12;
  }
  y += 72;

  const cta = ctaButton(content.cta, y);

  return bottomPanel(`
    ${eyebrow}
    ${title}
    ${subtitle}
    ${dateLine}
    ${body}
    ${bullets}
    ${chips}
    ${cta}
  `);
}

function footerBrand() {
  return `
    <rect x="${SHORT_WIDTH / 2 - 180}" y="1848" width="360" height="52" rx="26" fill="rgba(0,0,0,0.55)" />
    ${buildTextBlock({ x: SHORT_WIDTH / 2, y: 1882, lines: [BRAND.siteName], fontSize: 30, fill: BRAND.accentBright, fontWeight: 800, anchor: 'middle' })}
  `;
}

export function buildContentOverlaySvg({
  kind,
  istDate,
  job,
  jobIndex,
  jobCount,
  allJobs = [],
  withBackground = false,
}) {
  const content = getSlideContent({ kind, istDate, job, jobIndex, jobCount, allJobs });
  const panel =
    content.kind === 'job'
      ? buildJobPanel(content)
      : content.kind === 'intro'
        ? buildIntroPanel(content)
        : buildOutroPanel(content);

  const backgroundLayer = withBackground
    ? `
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${BRAND.bg}" />
          <stop offset="55%" stop-color="${BRAND.bgGlow}" />
          <stop offset="100%" stop-color="${BRAND.bg}" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
    `
    : `
      <defs>
        <linearGradient id="shadeTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.15" />
          <stop offset="35%" stop-color="#000000" stop-opacity="0.35" />
          <stop offset="58%" stop-color="#000000" stop-opacity="0.82" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.94" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#shadeTop)" />
    `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SHORT_WIDTH}" height="${SHORT_HEIGHT}" viewBox="0 0 ${SHORT_WIDTH} ${SHORT_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${backgroundLayer}
  ${panel}
  ${footerBrand()}
</svg>`;
}

export function buildFullSlideSvg(params) {
  return buildContentOverlaySvg({ ...params, withBackground: true });
}

export function categoryBackgroundPrompt(category) {
  const map = {
    IT: 'modern Indian tech office, laptops, developers, blue neon lighting',
    Support: 'customer support team, headsets, friendly office, professional',
    Civil: 'construction site Visakhapatnam, engineers, infrastructure project',
    Engineering: 'engineering workplace, industrial Visakhapatnam port city',
    Fresher: 'young graduates career start, campus to office, hopeful energy',
  };
  const key = Object.keys(map).find((k) => String(category || '').toLowerCase().includes(k.toLowerCase()));
  return map[key] || 'professional Indian workplace, modern office, career opportunity';
}

export function buildPollinationsBackgroundPrompt({ kind, job }) {
  const base =
    'cinematic vertical 9:16 composition, Visakhapatnam Andhra Pradesh India coastal city, professional recruitment atmosphere, dark blue cyan gold tones, high quality, dramatic lighting, NO TEXT, NO WORDS, NO LETTERS, NO WATERMARK';

  if (kind === 'intro') {
    return `${base}, sunrise over city skyline and port, new job opportunities, inspiring career mood`;
  }
  if (kind === 'outro') {
    return `${base}, success celebration, city lights at dusk, motivational career journey`;
  }
  return `${base}, ${categoryBackgroundPrompt(job?.category)}, ${job?.work_mode || 'office'} work environment`;
}
