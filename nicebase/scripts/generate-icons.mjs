#!/usr/bin/env node

/**
 * Icon Generation Script for NICEBASE
 * 
 * This script generates PNG icons from the SVG logo for PWA and mobile platforms.
 * 
 * Requirements:
 * - sharp: npm install --save-dev sharp
 * 
 * Usage:
 *   npm run generate:icons
 *   or
 *   node scripts/generate-icons.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const svgPath = join(publicDir, 'logo.svg');

// Check if sharp is available
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (error) {
  console.error('❌ Error: sharp is not installed.');
  console.error('   Please install it with: npm install --save-dev sharp');
  process.exit(1);
}

// Icon sizes to generate
const iconSizes = [
  { size: 192, name: 'pwa-192x192.png' },
  { size: 512, name: 'pwa-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 16, name: 'favicon-16x16.png' },
];

async function generateIcons() {
  try {
    console.log('🎨 Generating icons from logo.svg...\n');

    // Read SVG file
    const svgBuffer = readFileSync(svgPath);
    
    for (const { size, name } of iconSizes) {
      const outputPath = join(publicDir, name);
      
      await sharp(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated ${name} (${size}x${size})`);
    }

    // Generate favicon.ico (16x16 and 32x32 combined)
    const favicon16 = await sharp(svgBuffer)
      .resize(16, 16, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toBuffer();
    
    const favicon32 = await sharp(svgBuffer)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toBuffer();

    // For .ico, we'll just use the 32x32 PNG as favicon.ico
    // (Most modern browsers support PNG favicons)
    writeFileSync(join(publicDir, 'favicon.ico'), favicon32);
    console.log(`✅ Generated favicon.ico (32x32)\n`);

    console.log('✨ All icons generated successfully!');
    console.log('\n📝 Next steps:');
    console.log('   - Icons are ready in the /public folder');
    console.log('   - The app will automatically use them');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
