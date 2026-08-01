#!/usr/bin/env node

/**
 * Play Store Graphics Generation Script for NICEBASE
 *
 * Generates the two graphics Google Play requires for a store listing but that
 * cannot be reused from the app icons:
 *   - Feature graphic (1024x500, TR + EN) — shown at the top of the store page
 *   - High-res icon (512x512, no alpha) — Play rejects icons with transparency
 *     and applies its own corner masking, so the square is rendered full-bleed.
 *
 * Requirements:
 * - sharp: npm install --save-dev sharp
 *
 * Usage:
 *   npm run generate:store-graphics
 */

import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const svgPath = join(publicDir, 'logo.svg');
const storeDir = join(rootDir, 'store-assets');

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (error) {
  console.error('Error: sharp is not installed.');
  console.error('   Please install it with: npm install --save-dev sharp');
  process.exit(1);
}

// Feature graphic copy per store listing language.
const featureGraphics = [
  {
    name: 'feature-graphic-tr.png',
    tagline: 'Kişisel Duygusal Çapan',
    support: 'Anı Kasası  ·  Aiya AI  ·  Bağlantı Kurtarıcı',
  },
  {
    name: 'feature-graphic-en.png',
    tagline: 'Your Personal Emotional Anchor',
    support: 'Memory Vault  ·  Aiya AI  ·  Relationship Saver',
  },
];

const FONT_STACK = 'Segoe UI, Noto Sans, DejaVu Sans, Arial, sans-serif';

/**
 * Background plate for the feature graphic. Mirrors the logo's dark base and
 * warm radial glow so the banner reads as part of the same brand system.
 * Text sits in the middle band because Play crops feature graphics on some
 * surfaces.
 */
function featureGraphicSvg({ tagline, support }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
  <defs>
    <radialGradient id="halo" cx="0.22" cy="0.5" r="0.62">
      <stop offset="0%" stop-color="#FF7525" stop-opacity="0.42"/>
      <stop offset="35%" stop-color="#E55A2B" stop-opacity="0.20"/>
      <stop offset="70%" stop-color="#CC5018" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#111111" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FF8C5A" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#FF6B35" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="1024" height="500" fill="#111111"/>
  <rect width="1024" height="500" fill="url(#halo)"/>

  <text x="410" y="228" font-family="${FONT_STACK}" font-size="82"
        font-weight="700" fill="#FFFFFF" letter-spacing="2">NICEBASE</text>

  <rect x="414" y="252" width="200" height="3" fill="url(#rule)"/>

  <text x="412" y="303" font-family="${FONT_STACK}" font-size="31"
        font-weight="600" fill="#FFB068">${tagline}</text>

  <text x="412" y="352" font-family="${FONT_STACK}" font-size="22"
        font-weight="400" fill="#B4A79E">${support}</text>
</svg>`;
}

async function generateStoreGraphics() {
  try {
    console.log('Generating Play Store graphics from logo.svg...\n');

    if (!existsSync(storeDir)) {
      mkdirSync(storeDir, { recursive: true });
    }

    const svgContent = readFileSync(svgPath, 'utf8');
    const svgBuffer = Buffer.from(svgContent);

    // --- Feature graphics (1024x500) ---
    console.log('--- Feature Graphics ---');
    const logoBuf = await sharp(svgBuffer)
      .resize(300, 300, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    for (const graphic of featureGraphics) {
      const plate = Buffer.from(featureGraphicSvg(graphic));
      await sharp(plate)
        .composite([{ input: logoBuf, top: 100, left: 84 }])
        // Play rejects alpha on feature graphics; flatten onto the base colour
        // and drop the channel entirely so the PNG is emitted as 24-bit RGB.
        .flatten({ background: { r: 17, g: 17, b: 17 } })
        .removeAlpha()
        .png()
        .toFile(join(storeDir, graphic.name));
      console.log(`  Generated ${graphic.name} (1024x500)`);
    }

    // --- High-res store icon (512x512, opaque) ---
    console.log('\n--- High-res Store Icon ---');
    // Play masks the corners itself, so strip the logo's own rounded clip to
    // avoid a double-rounded icon with dark wedges in the corners.
    const squareSvg = svgContent.replace(/rx="112" ry="112"/, 'rx="0" ry="0"');
    await sharp(Buffer.from(squareSvg))
      .resize(512, 512, { fit: 'contain', background: { r: 17, g: 17, b: 17, alpha: 1 } })
      .flatten({ background: { r: 17, g: 17, b: 17 } })
      .png()
      .toFile(join(storeDir, 'play-icon-512.png'));
    console.log('  Generated play-icon-512.png (512x512, no alpha)');

    console.log('\nAll Play Store graphics generated successfully!');
  } catch (error) {
    console.error('Error generating store graphics:', error.message);
    process.exit(1);
  }
}

generateStoreGraphics();
