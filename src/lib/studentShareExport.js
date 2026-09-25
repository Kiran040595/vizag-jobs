import { buildStudentShareCardSnapshot, buildStudentShareFileBaseName } from './studentProfileShare.js';

const CARD_WIDTH = 900;
const PADDING_X = 48;
const PADDING_Y = 40;

const wrapText = (ctx, text, maxWidth) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [''];
  }

  const lines = [];
  let current = words[0];
  for (let index = 1; index < words.length; index += 1) {
    const next = `${current} ${words[index]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[index];
    }
  }
  lines.push(current);
  return lines;
};

const groupFields = (fields) => {
  const groups = new Map();
  for (const field of fields) {
    const group = field.group || 'Details';
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group).push(field);
  }
  return [...groups.entries()];
};

const measureCardHeight = (ctx, snapshot, companyLabel) => {
  const contentWidth = CARD_WIDTH - PADDING_X * 2;
  let y = PADDING_Y;

  y += 18;
  y += wrapText(ctx, snapshot.title, contentWidth).length * 40;
  y += companyLabel ? 28 : 24;
  y += 28;

  for (const [, fields] of groupFields(snapshot.fields)) {
    y += 30;
    for (const field of fields) {
      y += 16;
      y += wrapText(ctx, field.value, contentWidth).length * 24;
      y += 14;
    }
    y += 10;
  }

  y += PADDING_Y;
  return Math.max(y, 520);
};

/** Draw the student card onto a canvas and return it. */
export const renderStudentShareCanvas = ({ student, fieldIds, companyLabel = '' }) => {
  const snapshot = buildStudentShareCardSnapshot(student, fieldIds);
  const label = String(companyLabel || '').trim();

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) {
    throw new Error('Could not prepare the share card.');
  }
  measureCtx.font = '800 34px system-ui, sans-serif';

  const height = measureCardHeight(measureCtx, snapshot, label);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not draw the share card.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CARD_WIDTH, height);

  const headerHeight = 150;
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, headerHeight);
  gradient.addColorStop(0, '#ecfeff');
  gradient.addColorStop(0.55, '#ffffff');
  gradient.addColorStop(1, '#f8fafc');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, headerHeight);
  ctx.fillStyle = '#cffafe';
  ctx.fillRect(0, headerHeight - 2, CARD_WIDTH, 2);

  let y = PADDING_Y;
  const contentWidth = CARD_WIDTH - PADDING_X * 2;

  ctx.fillStyle = '#0e7490';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillText('JOBS IN VIZAG', PADDING_X, y + 14);
  y += 36;

  ctx.fillStyle = '#020617';
  ctx.font = '800 34px system-ui, sans-serif';
  for (const line of wrapText(ctx, snapshot.title, contentWidth)) {
    ctx.fillText(line, PADDING_X, y + 28);
    y += 40;
  }

  ctx.fillStyle = '#475569';
  ctx.font = '500 16px system-ui, sans-serif';
  ctx.fillText(
    label ? `Shared for ${label}` : 'Candidate profile card',
    PADDING_X,
    y + 18,
  );
  y = Math.max(y + 36, headerHeight + 24);

  for (const [group, fields] of groupFields(snapshot.fields)) {
    ctx.fillStyle = '#64748b';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(String(group).toUpperCase(), PADDING_X, y + 12);
    y += 28;

    for (const field of fields) {
      ctx.fillStyle = '#64748b';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillText(String(field.label).toUpperCase(), PADDING_X, y + 10);
      y += 20;

      ctx.fillStyle = '#0f172a';
      ctx.font = '500 16px system-ui, sans-serif';
      for (const line of wrapText(ctx, field.value, contentWidth)) {
        ctx.fillText(line, PADDING_X, y + 14);
        y += 24;
      }
      y += 12;
    }
    y += 8;
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 12px system-ui, sans-serif';
  ctx.fillText('Shared via Jobs in Vizag', PADDING_X, height - 18);

  return { canvas, snapshot };
};

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not export the share card.'));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });

const concatBytes = (chunks) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};

/** Minimal one-page PDF wrapping a JPEG image. */
const buildPdfFromJpeg = (jpegBytes, imgWidth, imgHeight) => {
  const encoder = new TextEncoder();
  const pageWidth = 595;
  const pageHeight = Math.max(420, Math.round((imgHeight / imgWidth) * pageWidth));
  const contentStream = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = encoder.encode(contentStream);

  const objects = [
    encoder.encode('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
    encoder.encode('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'),
    encoder.encode(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n`,
    ),
    concatBytes([
      encoder.encode(`4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      encoder.encode('endstream\nendobj\n'),
    ]),
    concatBytes([
      encoder.encode(
        `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
      ),
      jpegBytes,
      encoder.encode('\nendstream\nendobj\n'),
    ]),
    encoder.encode('6 0 obj\n<< /Producer (Jobs in Vizag) >>\nendobj\n'),
  ];

  const header = encoder.encode('%PDF-1.4\n');
  const parts = [header];
  const offsets = [0];
  let offset = header.length;

  for (const objectBytes of objects) {
    offsets.push(offset);
    parts.push(objectBytes);
    offset += objectBytes.length;
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(encoder.encode(xref));

  return concatBytes(parts);
};

const downloadBlob = (blob, fileName) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
};

export const exportStudentShareImage = async ({ student, fieldIds, companyLabel = '' }) => {
  const { canvas, snapshot } = renderStudentShareCanvas({ student, fieldIds, companyLabel });
  const blob = await canvasToBlob(canvas, 'image/png');
  const fileName = `${buildStudentShareFileBaseName(student)}-card.png`;
  return { blob, fileName, snapshot, mimeType: 'image/png', format: 'image' };
};

export const exportStudentSharePdf = async ({ student, fieldIds, companyLabel = '' }) => {
  const { canvas, snapshot } = renderStudentShareCanvas({ student, fieldIds, companyLabel });
  const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const pdfBytes = buildPdfFromJpeg(jpegBytes, canvas.width, canvas.height);
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const fileName = `${buildStudentShareFileBaseName(student)}-card.pdf`;
  return { blob, fileName, snapshot, mimeType: 'application/pdf', format: 'pdf' };
};

export const downloadStudentShareFile = (blob, fileName) => {
  downloadBlob(blob, fileName);
};

const buildWhatsAppCaption = ({ student, companyLabel, format }) => {
  const name = student?.fullName || 'Candidate';
  const company = String(companyLabel || '').trim();
  const kind = format === 'pdf' ? 'PDF' : 'image';
  if (company) {
    return `Hi, sharing ${name}'s candidate profile card (${kind}) for ${company} via Jobs in Vizag.`;
  }
  return `Hi, sharing ${name}'s candidate profile card (${kind}) via Jobs in Vizag.`;
};

/**
 * Share the generated card on WhatsApp when the browser supports file sharing.
 * Falls back to downloading the file and opening WhatsApp with a caption.
 */
export const shareStudentCardOnWhatsApp = async ({
  blob,
  fileName,
  mimeType,
  format,
  student,
  companyLabel = '',
}) => {
  const caption = buildWhatsAppCaption({ student, companyLabel, format });
  const file = new File([blob], fileName, { type: mimeType });
  const shareData = {
    files: [file],
    title: `${student?.fullName || 'Candidate'} profile`,
    text: caption,
  };

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const canShareFiles =
      typeof navigator.canShare === 'function' ? navigator.canShare(shareData) : false;
    if (canShareFiles) {
      await navigator.share(shareData);
      return { mode: 'native-share' };
    }
  }

  downloadBlob(blob, fileName);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `${caption}\n\n(Attach the downloaded ${format === 'pdf' ? 'PDF' : 'image'}: ${fileName})`,
  )}`;
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  return { mode: 'download-and-whatsapp' };
};
