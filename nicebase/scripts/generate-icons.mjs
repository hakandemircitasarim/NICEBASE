#!/usr/bin/env node

/**
 * Icon Generation Script for NICEBASE
 *
 * Generates PNG icons from the SVG logo for PWA, web, and Android platforms.
 *
 * Requirements:
 * - sharp: npm install --save-dev sharp
 *
 * Usage:
 *   npm run generate:icons
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const svgPath = join(publicDir, 'logo.svg');
const androidResDir = join(rootDir, 'android', 'app', 'src', 'main', 'res');

// Check if sharp is available
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (error) {
  console.error('Error: sharp is not installed.');
  console.error('   Please install it with: npm install --save-dev sharp');
  process.exit(1);
}

// Web/PWA icon sizes
const webIconSizes = [
  { size: 192, name: 'pwa-192x192.png' },
  { size: 512, name: 'pwa-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 16, name: 'favicon-16x16.png' },
];

// Android mipmap icon sizes (standard launcher icons)
const androidIconSizes = [
  { density: 'mdpi', size: 48 },
  { density: 'hdpi', size: 72 },
  { density: 'xhdpi', size: 96 },
  { density: 'xxhdpi', size: 144 },
  { density: 'xxxhdpi', size: 192 },
];

// Android adaptive icon foreground sizes (108dp per density)
const androidForegroundSizes = [
  { density: 'mdpi', size: 108 },
  { density: 'hdpi', size: 162 },
  { density: 'xhdpi', size: 216 },
  { density: 'xxhdpi', size: 324 },
  { density: 'xxxhdpi', size: 432 },
];

/**
 * Create an SVG that renders the icon with a solid orange background
 * (for standard launcher icons that need a visible background)
 */
function createIconWithBackground(svgContent, size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    ${svgContent}
  </svg>`;
}

/**
 * Create the foreground layer for adaptive icons.
 * This extracts just the white icon part without the background, centered with proper padding.
 */
function createAdaptiveForeground(size) {
  // Adaptive icon safe zone: 66dp centered in 108dp. Icon should be within inner 66/108 = ~61%
  // So we scale the icon part to fit within that zone
  return `<svg width="${size}" height="${size}" viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(54, 52) scale(0.28)">
      <!-- Anchor ring (top circle) -->
      <circle cx="0" cy="-118" r="30" stroke="#FFFFFF" stroke-width="16" fill="none"/>
      <circle cx="0" cy="-118" r="6" fill="#FFFFFF"/>
      <!-- Vertical shank -->
      <rect x="-8" y="-88" width="16" height="196" rx="8" fill="#FFFFFF"/>
      <!-- Heart-shaped arms (left) -->
      <path d="M -8 20 C -8 20 -14 -10 -50 -36 C -86 -62 -108 -26 -108 -2 C -108 30 -76 60 -8 100"
            fill="none" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round"/>
      <!-- Heart-shaped arms (right) -->
      <path d="M 8 20 C 8 20 14 -10 50 -36 C 86 -62 108 -26 108 -2 C 108 30 76 60 8 100"
            fill="none" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round"/>
      <!-- Bottom anchor flukes -->
      <circle cx="-92" cy="54" r="12" fill="#FFFFFF"/>
      <circle cx="92" cy="54" r="12" fill="#FFFFFF"/>
      <!-- Small heart -->
      <path d="M 0 -20 C -4 -28 -16 -28 -16 -18 C -16 -10 0 2 0 2 C 0 2 16 -10 16 -18 C 16 -28 4 -28 0 -20 Z"
            fill="#FFFFFF" opacity="0.9"/>
    </g>
  </svg>`;
}

async function generateIcons() {
  try {
    console.log('Generating icons from logo.svg...\n');

    // Read SVG source
    const svgContent = readFileSync(svgPath, 'utf8');
    const svgBuffer = Buffer.from(svgContent);

    // --- Web/PWA Icons ---
    console.log('--- Web/PWA Icons ---');
    for (const { size, name } of webIconSizes) {
      const outputPath = join(publicDir, name);
      await sharp(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`  Generated ${name} (${size}x${size})`);
    }

    // Generate favicon.ico
    const favicon32 = await sharp(svgBuffer)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toBuffer();
    writeFileSync(join(publicDir, 'favicon.ico'), favicon32);
    console.log('  Generated favicon.ico (32x32)\n');

    // --- Android Standard Icons ---
    console.log('--- Android Launcher Icons ---');
    for (const { density, size } of androidIconSizes) {
      const mipmapDir = join(androidResDir, `mipmap-${density}`);
      if (!existsSync(mipmapDir)) {
        mkdirSync(mipmapDir, { recursive: true });
      }

      // ic_launcher.png — full icon with background
      await sharp(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 107, b: 53, alpha: 1 }
        })
        .png()
        .toFile(join(mipmapDir, 'ic_launcher.png'));

      // ic_launcher_round.png — same but will be masked as circle by Android
      await sharp(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 107, b: 53, alpha: 1 }
        })
        .png()
        .toFile(join(mipmapDir, 'ic_launcher_round.png'));

      console.log(`  Generated mipmap-${density}/ic_launcher.png (${size}x${size})`);
    }

    // --- Android Adaptive Icon Foreground ---
    console.log('\n--- Android Adaptive Icon Foregrounds ---');
    for (const { density, size } of androidForegroundSizes) {
      const mipmapDir = join(androidResDir, `mipmap-${density}`);
      if (!existsSync(mipmapDir)) {
        mkdirSync(mipmapDir, { recursive: true });
      }

      const fgSvg = createAdaptiveForeground(size);
      const fgBuffer = Buffer.from(fgSvg);

      await sharp(fgBuffer)
        .resize(size, size)
        .png()
        .toFile(join(mipmapDir, 'ic_launcher_foreground.png'));

      console.log(`  Generated mipmap-${density}/ic_launcher_foreground.png (${size}x${size})`);
    }

    console.log('\nAll icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
