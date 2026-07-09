/**
 * Icon Generator for PWA
 * This script generates placeholder icons for the PWA
 * Run with: node scripts/generate-pwa-icons.js
 * 
 * For production, replace with actual logo assets:
 * - icon-192x192.png (192x192)
 * - icon-512x512.png (512x512)
 * - icon-192x192-maskable.png (192x192, needs safe zone)
 * - icon-512x512-maskable.png (512x512, needs safe zone)
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = './public';

// Ensure public directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

function generateIcon(size, isMaskable = false) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = isMaskable ? '#000000' : '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Draw a circle with "VJ" for Vizag Jobs
  const radius = size / 2.5;
  const centerX = size / 2;
  const centerY = size / 2;

  // Circle background
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.fill();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.floor(size * 0.4)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VJ', centerX, centerY);

  return canvas;
}

function savePNG(canvas, filename) {
  const stream = fs.createWriteStream(path.join(PUBLIC_DIR, filename));
  const pngStream = canvas.createPNGStream();
  
  return new Promise((resolve, reject) => {
    pngStream.pipe(stream)
      .on('finish', () => {
        console.log(`✓ Generated: ${filename}`);
        resolve();
      })
      .on('error', reject);
  });
}

async function generateIcons() {
  try {
    console.log('Generating PWA icons...\n');

    // Generate regular icons
    const icon192 = generateIcon(192, false);
    const icon512 = generateIcon(512, false);

    // Generate maskable icons (for adaptive icons on Android)
    const maskable192 = generateIcon(192, true);
    const maskable512 = generateIcon(512, true);

    // Save all icons
    await Promise.all([
      savePNG(icon192, 'icon-192x192.png'),
      savePNG(icon512, 'icon-512x512.png'),
      savePNG(maskable192, 'icon-192x192-maskable.png'),
      savePNG(maskable512, 'icon-512x512-maskable.png')
    ]);

    console.log('\n✓ All PWA icons generated successfully!');
    console.log('\nNote: These are placeholder icons.');
    console.log('For production, replace them with your actual logo/branding.');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
