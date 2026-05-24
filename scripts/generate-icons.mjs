// Generate all brand image assets from the master logo at branding/logo-source.png.
//
// Outputs (all in public/):
//   - icon-192x192.png            PWA icon, normal       (logo fits ~92% width)
//   - icon-512x512.png            PWA icon, normal
//   - icon-192x192-maskable.png   PWA icon, maskable     (logo fits ~75% width — Android safe zone)
//   - icon-512x512-maskable.png   PWA icon, maskable
//   - apple-touch-icon.png        180x180, opaque
//   - favicon-32x32.png           32x32 favicon
//   - favicon-16x16.png           16x16 favicon
//   - og-image.png                1200x630 social-share image
//   - logo.png                    Trimmed logo with transparent black background, max 1200 wide
//
// Pipeline:
//   1. sharp.trim() removes the outer letterbox/black border from the source.
//   2. The trimmed image is composited onto a square (or 1200x630) canvas with
//      a solid black background, scaled to a target safe-zone ratio.
//
// Run: node scripts/generate-icons.mjs

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const SOURCE = path.join(repoRoot, 'branding', 'logo-source.png');
const PUBLIC_DIR = path.join(repoRoot, 'public');

if (!fs.existsSync(SOURCE)) {
  console.error(`Source logo not found at ${SOURCE}`);
  process.exit(1);
}

const BRAND_BG = { r: 0, g: 0, b: 0, alpha: 1 };

// 1. Trim the outer black letterbox once and cache the result.
const trimmedBuffer = await sharp(SOURCE)
  .trim({ background: BRAND_BG, threshold: 30 })
  .toBuffer();
const trimmedMeta = await sharp(trimmedBuffer).metadata();
console.log(
  `Trimmed source logo: ${trimmedMeta.width}x${trimmedMeta.height} (was 1024x682)`,
);

// 2. Extract the "icon mark" — the leftmost square region of the trimmed logo.
//    The full logo is wide (~3.5:1), which letterboxes poorly into square PWA
//    icons. The leftmost square contains the briefcase + lighthouse graphic.
const markSize = trimmedMeta.height;
const iconMarkBuffer = await sharp(trimmedBuffer)
  .extract({ left: 0, top: 0, width: markSize, height: markSize })
  .toBuffer();
const iconMarkMeta = await sharp(iconMarkBuffer).metadata();
console.log(`Icon mark (square): ${iconMarkMeta.width}x${iconMarkMeta.height}`);

const composeOnCanvas = async ({
  outFile,
  canvasWidth,
  canvasHeight = canvasWidth,
  fitRatio = 0.92,
  source = trimmedBuffer,
  background = BRAND_BG,
  format = 'png',
}) => {
  const innerW = Math.round(canvasWidth * fitRatio);
  const innerH = Math.round(canvasHeight * fitRatio);

  const inner = await sharp(source)
    .resize(innerW, innerH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const pipeline = sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background,
    },
  }).composite([{ input: inner, gravity: 'center' }]);

  const finalPipeline = format === 'jpeg' ? pipeline.jpeg({ quality: 92 }) : pipeline.png();
  await finalPipeline.toFile(outFile);
  console.log(`  wrote ${path.basename(outFile)} (${canvasWidth}x${canvasHeight})`);
};

console.log('\nGenerating PWA icons (square — icon mark only)...');
await composeOnCanvas({
  outFile: path.join(PUBLIC_DIR, 'icon-192x192.png'),
  canvasWidth: 192,
  fitRatio: 0.92,
  source: iconMarkBuffer,
});
await composeOnCanvas({
  outFile: path.join(PUBLIC_DIR, 'icon-512x512.png'),
  canvasWidth: 512,
  fitRatio: 0.92,
  source: iconMarkBuffer,
});
await composeOnCanvas({
  outFile: path.join(PUBLIC_DIR, 'icon-192x192-maskable.png'),
  canvasWidth: 192,
  fitRatio: 0.72,
  source: iconMarkBuffer,
});
await composeOnCanvas({
  outFile: path.join(PUBLIC_DIR, 'icon-512x512-maskable.png'),
  canvasWidth: 512,
  fitRatio: 0.72,
  source: iconMarkBuffer,
});

console.log('\nGenerating Apple touch icon (icon mark only)...');
await composeOnCanvas({
  outFile: path.join(PUBLIC_DIR, 'apple-touch-icon.png'),
  canvasWidth: 180,
  fitRatio: 0.92,
  source: iconMarkBuffer,
});

console.log('\nGenerating favicons (icon mark only)...');
await composeOnCanvas({
  outFile: path.join(PUBLIC_DIR, 'favicon-32x32.png'),
  canvasWidth: 32,
  fitRatio: 0.95,
  source: iconMarkBuffer,
});
await composeOnCanvas({
  outFile: path.join(PUBLIC_DIR, 'favicon-16x16.png'),
  canvasWidth: 16,
  fitRatio: 0.95,
  source: iconMarkBuffer,
});

console.log('\nGenerating Open Graph image (1200x630)...');
await composeOnCanvas({
  outFile: path.join(PUBLIC_DIR, 'og-image.png'),
  canvasWidth: 1200,
  canvasHeight: 630,
  fitRatio: 0.78,
});

console.log('\nGenerating logo.png (full-width brand asset)...');
await composeOnCanvas({
  outFile: path.join(PUBLIC_DIR, 'logo.png'),
  canvasWidth: Math.min(trimmedMeta.width, 1200),
  canvasHeight: Math.round(
    Math.min(trimmedMeta.width, 1200) * (trimmedMeta.height / trimmedMeta.width),
  ),
  fitRatio: 1.0,
});

console.log('\nDone. All brand assets written to public/.');
