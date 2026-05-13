import sharp from 'sharp';
import fs from 'fs';

const PUBLIC_DIR = './public';

// Ensure public directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

async function generateIcon(size, isMaskable = false) {
  // Create SVG
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${isMaskable ? '#000000' : '#ffffff'}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${Math.floor(size / 2.5)}" fill="#1f2937"/>
      <text x="${size / 2}" y="${size / 2}" font-size="${Math.floor(size * 0.4)}" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">VJ</text>
    </svg>
  `;

  return Buffer.from(svg);
}

async function generateIcons() {
  try {
    console.log('Generating PWA icons...\n');

    // Generate all 4 icons
    const icons = await Promise.all([
      (async () => {
        const svg = await generateIcon(192, false);
        await sharp(svg).png().toFile(`${PUBLIC_DIR}/icon-192x192.png`);
        console.log('✓ Generated: icon-192x192.png');
      })(),
      (async () => {
        const svg = await generateIcon(512, false);
        await sharp(svg).png().toFile(`${PUBLIC_DIR}/icon-512x512.png`);
        console.log('✓ Generated: icon-512x512.png');
      })(),
      (async () => {
        const svg = await generateIcon(192, true);
        await sharp(svg).png().toFile(`${PUBLIC_DIR}/icon-192x192-maskable.png`);
        console.log('✓ Generated: icon-192x192-maskable.png');
      })(),
      (async () => {
        const svg = await generateIcon(512, true);
        await sharp(svg).png().toFile(`${PUBLIC_DIR}/icon-512x512-maskable.png`);
        console.log('✓ Generated: icon-512x512-maskable.png');
      })()
    ]);

    console.log('\n✓ All PWA icons generated successfully!');
    console.log('\nNote: These are placeholder icons with "VJ" branding.');
    console.log('Replace them with your actual logo from: https://www.pwabuilder.com/');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
