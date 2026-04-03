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

      // ic_launcher.png — icon with padding (80% of target size, centered)
      const innerSize = Math.round(size * 0.80);
      const pad = Math.round((size - innerSize) / 2);
      const iconBuf = await sharp(svgBuffer)
        .resize(innerSize, innerSize, { fit: 'contain', background: { r: 17, g: 17, b: 17, alpha: 1 } })
        .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 17, g: 17, b: 17, alpha: 1 } })
        .png()
        .toBuffer();
      await sharp(iconBuf).toFile(join(mipmapDir, 'ic_launcher.png'));

      // ic_launcher_round.png — same
      await sharp(iconBuf).toFile(join(mipmapDir, 'ic_launcher_round.png'));

      console.log(`  Generated mipmap-${density}/ic_launcher.png (${size}x${size})`);
    }

    // --- Android Adaptive Icon Foreground ---
    console.log('\n--- Android Adaptive Icon Foregrounds ---');
    for (const { density, size } of androidForegroundSizes) {
      const mipmapDir = join(androidResDir, `mipmap-${density}`);
      if (!existsSync(mipmapDir)) {
        mkdirSync(mipmapDir, { recursive: true });
      }

      // ic_launcher_foreground.png — logo at 60% (inside Android adaptive safe zone)
      const fgInner = Math.round(size * 0.60);
      const fgPad = Math.round((size - fgInner) / 2);
      const fgBuf = await sharp(svgBuffer)
        .resize(fgInner, fgInner, { fit: 'contain', background: { r: 17, g: 17, b: 17, alpha: 1 } })
        .extend({ top: fgPad, bottom: fgPad, left: fgPad, right: fgPad, background: { r: 17, g: 17, b: 17, alpha: 1 } })
        .png()
        .toBuffer();
      await sharp(fgBuf).toFile(join(mipmapDir, 'ic_launcher_foreground.png'));

      console.log(`  Generated mipmap-${density}/ic_launcher_foreground.png (${size}x${size})`);
    }

    console.log('\nAll icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
