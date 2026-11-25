import { buildJobShareUrl } from './instagramJobCaption.js';
import {
  displayCompanyName,
  displayJobCategory,
  displayJobType,
  displayLocation,
  displaySalary,
  displayWorkMode,
  isPlaceholderJobValue,
} from './jobDisplayLabels.js';
import { isDirectPosting } from './jobDirectPosting.js';
import { isFresherFlagSet } from './fresherMatch.js';
import { resolveJobExperienceForDisplay } from './jobRecordInference.js';

export const POSTER_FORMATS = Object.freeze({
  portrait: {
    id: 'portrait',
    label: 'Portrait (4:5)',
    hint: 'Instagram & LinkedIn',
    width: 1080,
    height: 1350,
  },
  story: {
    id: 'story',
    label: 'Status / Story (9:16)',
    hint: 'WhatsApp Status & Reels',
    width: 1080,
    height: 1920,
  },
  square: {
    id: 'square',
    label: 'Square (1:1)',
    hint: 'WhatsApp Groups',
    width: 1080,
    height: 1080,
  },
});

export const POSTER_THEMES = Object.freeze({
  cyan: {
    id: 'cyan',
    label: 'Vizag Cyan',
    bgTop: '#020617',
    bgBottom: '#0f172a',
    accent: '#06b6d4',
    accentLight: '#cffafe',
    accentText: '#0e7490',
    glow: 'rgba(6, 182, 212, 0.24)',
  },
  emerald: {
    id: 'emerald',
    label: 'Direct Emerald',
    bgTop: '#022c22',
    bgBottom: '#064e3b',
    accent: '#10b981',
    accentLight: '#d1fae5',
    accentText: '#047857',
    glow: 'rgba(16, 185, 129, 0.24)',
  },
  indigo: {
    id: 'indigo',
    label: 'Royal Indigo',
    bgTop: '#0f172a',
    bgBottom: '#1e1b4b',
    accent: '#6366f1',
    accentLight: '#e0e7ff',
    accentText: '#4338ca',
    glow: 'rgba(99, 102, 241, 0.26)',
  },
});

const parseSkillsList = (rawSkills) => {
  if (Array.isArray(rawSkills)) {
    return rawSkills.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 4);
  }
  return String(rawSkills || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
};

/** Build normalized display fields from either camelCase or raw snake_case job records. */
export const buildPosterMetadata = (job = {}) => {
  const title = String(job?.title || 'Job Opening in Vizag').trim();
  const company = displayCompanyName(job?.company);
  const location = displayLocation(job?.location);
  const category = displayJobCategory(job?.category);
  const jobType = displayJobType(job?.jobType ?? job?.job_type);
  const workMode = displayWorkMode(job?.workMode ?? job?.work_mode);
  const isFresher = isFresherFlagSet(job);
  const resolvedExp = resolveJobExperienceForDisplay({
    ...job,
    isFresher: job?.isFresher ?? job?.is_fresher,
    shortDescription: job?.shortDescription ?? job?.short_description,
  });
  const experience = resolvedExp || (isFresher ? 'Freshers Eligible' : 'All Experience Levels');
  const hasSalary = !isPlaceholderJobValue(job?.salary);
  const salaryRaw = hasSalary ? displaySalary(job?.salary) : null;
  const skills = parseSkillsList(job?.skills);
  const shareUrl = buildJobShareUrl(job);
  const displayUrl = shareUrl.replace(/^https?:\/\//i, '');

  const badge = isDirectPosting(job)
    ? 'DIRECT EMPLOYER · APPLY NOW'
    : isFresher
      ? 'FRESHER HIRING · VISAKHAPATNAM'
      : 'NOW HIRING · VISAKHAPATNAM';

  return {
    title,
    company,
    location,
    category,
    jobType,
    workMode,
    experience,
    isFresher,
    salary: hasSalary ? salaryRaw : null,
    skills,
    shareUrl,
    displayUrl,
    badge,
  };
};

export const buildPosterFilename = (job = {}, formatId = 'portrait') => {
  const rawSlug = String(job?.slug || job?.title || 'job')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `vizagjobs-${rawSlug || 'opening'}-${formatId}.png`;
};

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

const wrapTextLines = (ctx, text, maxWidth, maxLines = 3) => {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      } else {
        lines.push(word);
      }
      current = current ? word : '';
      if (lines.length === maxLines) break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    let last = lines[maxLines - 1];
    while (last.length > 3 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    lines[maxLines - 1] = `${last}…`;
  }

  return lines;
};

const generateQrCanvas = async (text, size) => {
  try {
    const QRCode = await import('qrcode');
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
    return qrCanvas;
  } catch {
    return null;
  }
};

/**
 * Render a branded, scannable WhatsApp / Instagram job poster onto a <canvas>.
 */
export async function renderJobPosterToCanvas(canvas, job, options = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new Error('Canvas element is unavailable.');
  }

  const format = POSTER_FORMATS[options.format] || POSTER_FORMATS.portrait;
  const theme = POSTER_THEMES[options.theme] || POSTER_THEMES.cyan;
  const meta = buildPosterMetadata(job);

  canvas.width = format.width;
  canvas.height = format.height;

  const ctx = canvas.getContext('2d');
  const W = format.width;
  const H = format.height;
  const padX = 64;
  const isStory = format.id === 'story';
  const isSquare = format.id === 'square';

  // 1. Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, theme.bgTop);
  bgGrad.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle decorative glow orbs
  const orb1 = ctx.createRadialGradient(W * 0.88, H * 0.1, 20, W * 0.88, H * 0.1, 420);
  orb1.addColorStop(0, theme.glow);
  orb1.addColorStop(1, 'transparent');
  ctx.fillStyle = orb1;
  ctx.fillRect(0, 0, W, H);

  const orb2 = ctx.createRadialGradient(W * 0.12, H * 0.9, 20, W * 0.12, H * 0.9, 440);
  orb2.addColorStop(0, theme.glow);
  orb2.addColorStop(1, 'transparent');
  ctx.fillStyle = orb2;
  ctx.fillRect(0, 0, W, H);

  // 2. Top Brand Header
  const headerTop = isStory ? 110 : isSquare ? 48 : 64;
  ctx.textBaseline = 'middle';

  ctx.font = '900 48px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Vizag', padX, headerTop + 26);
  const vizagWidth = ctx.measureText('Vizag').width;
  ctx.fillStyle = theme.accent;
  ctx.fillText('Jobs', padX + vizagWidth, headerTop + 26);

  // Domain pill on top right
  ctx.font = '700 22px system-ui, -apple-system, Segoe UI, sans-serif';
  const domainText = 'jobsinvizag.in';
  const domainWidth = ctx.measureText(domainText).width + 36;
  drawRoundedRect(ctx, W - padX - domainWidth, headerTop + 4, domainWidth, 44, 22);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(domainText, W - padX - domainWidth + 18, headerTop + 26);

  // Hiring Status Pill
  const badgeTop = headerTop + (isStory ? 96 : isSquare ? 72 : 84);
  ctx.font = '800 21px system-ui, -apple-system, Segoe UI, sans-serif';
  const badgeText = meta.badge;
  const badgeWidth = Math.min(W - padX * 2, ctx.measureText(badgeText).width + 44);
  drawRoundedRect(ctx, padX, badgeTop, badgeWidth, 46, 23);
  ctx.fillStyle = theme.accent;
  ctx.fill();
  ctx.fillStyle = '#020617';
  ctx.fillText(badgeText, padX + 22, badgeTop + 23);

  // 3. Center White Job Card
  const cardTop = badgeTop + (isStory ? 84 : isSquare ? 68 : 74);
  const footerHeight = isStory ? 260 : isSquare ? 210 : 230;
  const footerBottomMargin = isStory ? 96 : isSquare ? 44 : 56;
  const cardBottom = H - footerHeight - footerBottomMargin - 28;
  const cardHeight = cardBottom - cardTop;
  const cardWidth = W - padX * 2;

  drawRoundedRect(ctx, padX, cardTop, cardWidth, cardHeight, 36);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  const innerX = padX + 52;
  const innerWidth = cardWidth - 104;
  let cursorY = cardTop + (isSquare ? 52 : 64);

  // Company Label
  ctx.font = '800 26px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillStyle = theme.accentText;
  const companyLines = wrapTextLines(ctx, meta.company.toUpperCase(), innerWidth, 1);
  ctx.fillText(companyLines[0], innerX, cursorY);
  cursorY += isSquare ? 42 : 48;

  // Job Title (auto-scales down if long)
  const titleFontSize = meta.title.length > 48 ? 44 : meta.title.length > 28 ? 52 : 58;
  const titleLineHeight = Math.round(titleFontSize * 1.18);
  ctx.font = `900 ${titleFontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.fillStyle = '#0f172a';
  const titleLines = wrapTextLines(ctx, meta.title, innerWidth, isSquare ? 2 : 3);
  for (const line of titleLines) {
    ctx.fillText(line, innerX, cursorY);
    cursorY += titleLineHeight;
  }
  cursorY += 8;

  // Location Line
  ctx.font = '600 25px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillStyle = '#475569';
  const locLines = wrapTextLines(ctx, `📍 ${meta.location}`, innerWidth, 1);
  ctx.fillText(locLines[0], innerX, cursorY);
  cursorY += isSquare ? 42 : 56;

  // Subtle Divider
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(innerX, cursorY);
  ctx.lineTo(innerX + innerWidth, cursorY);
  ctx.stroke();
  cursorY += isSquare ? 28 : 38;

  // 2x2 Key Highlight Tiles
  const tiles = [
    { label: 'JOB TYPE', value: meta.jobType || 'Full-time' },
    { label: 'EXPERIENCE', value: meta.experience },
    meta.salary
      ? { label: 'COMPENSATION', value: meta.salary }
      : { label: 'WORK MODE', value: meta.workMode || 'Visakhapatnam' },
    { label: 'CATEGORY', value: meta.category || 'General' },
  ];

  const tileGap = 20;
  const tileWidth = (innerWidth - tileGap) / 2;
  const tileHeight = isStory ? 132 : isSquare ? 104 : 118;

  tiles.forEach((tile, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const tx = innerX + col * (tileWidth + tileGap);
    const ty = cursorY + row * (tileHeight + tileGap);

    drawRoundedRect(ctx, tx, ty, tileWidth, tileHeight, 20);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '700 17px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(tile.label, tx + 22, ty + (isSquare ? 30 : 34));

    ctx.font = '800 24px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillStyle = '#0f172a';
    const valLines = wrapTextLines(ctx, tile.value, tileWidth - 44, 1);
    ctx.fillText(valLines[0], tx + 22, ty + (isSquare ? 70 : 78));
  });

  cursorY += tileHeight * 2 + tileGap + (isSquare ? 26 : 38);

  // Optional Skills Chips (when space allows cleanly inside the card)
  if (meta.skills.length > 0 && cursorY + 70 < cardBottom - 20) {
    ctx.font = '700 18px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('KEY SKILLS', innerX, cursorY);
    cursorY += 32;

    let chipX = innerX;
    let chipY = cursorY;
    ctx.font = '700 20px system-ui, -apple-system, Segoe UI, sans-serif';

    for (const skill of meta.skills) {
      const chipWidth = Math.min(innerWidth, ctx.measureText(skill).width + 36);
      if (chipX + chipWidth > innerX + innerWidth) {
        chipX = innerX;
        chipY += 54;
      }
      if (chipY + 44 > cardBottom - 20) break;

      drawRoundedRect(ctx, chipX, chipY, chipWidth, 42, 21);
      ctx.fillStyle = theme.accentLight;
      ctx.fill();

      ctx.fillStyle = theme.accentText;
      ctx.fillText(skill, chipX + 18, chipY + 21);
      chipX += chipWidth + 12;
    }
  }

  // Note inside bottom of card if story has extra vertical room
  if (isStory && cursorY + 130 < cardBottom - 40) {
    const noteY = cardBottom - 76;
    drawRoundedRect(ctx, innerX, noteY - 24, innerWidth, 64, 18);
    ctx.fillStyle = '#ecfeff';
    ctx.fill();
    ctx.font = '700 22px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillStyle = '#155e75';
    ctx.fillText('Zero consultancy fee · Apply directly via VizagJobs', innerX + 24, noteY + 8);
  }

  // 4. Bottom CTA Strip + Scannable QR Code
  const footerTop = H - footerHeight - footerBottomMargin;
  drawRoundedRect(ctx, padX, footerTop, cardWidth, footerHeight, 32);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const qrBoxSize = footerHeight - 40;
  const qrCanvas = await generateQrCanvas(meta.shareUrl, qrBoxSize - 20);
  const qrBoxX = W - padX - qrBoxSize - 24;
  const qrBoxY = footerTop + 20;

  if (qrCanvas) {
    drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.drawImage(qrCanvas, qrBoxX + 10, qrBoxY + 10, qrBoxSize - 20, qrBoxSize - 20);
  }

  const ctaMaxWidth = qrCanvas ? cardWidth - qrBoxSize - 96 : cardWidth - 72;
  const ctaX = padX + 36;
  const ctaCenterY = footerTop + footerHeight / 2;

  ctx.font = '800 28px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillStyle = theme.accent;
  ctx.fillText('SCAN OR APPLY ONLINE', ctaX, ctaCenterY - 42);

  ctx.font = '700 22px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillStyle = '#f8fafc';
  const urlLines = wrapTextLines(ctx, meta.displayUrl, ctaMaxWidth, 2);
  urlLines.forEach((line, i) => {
    ctx.fillText(line, ctaX, ctaCenterY - 2 + i * 28);
  });

  ctx.font = '600 18px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('Verified Local Jobs · Share with friends in Vizag', ctaX, ctaCenterY + 56);
}
