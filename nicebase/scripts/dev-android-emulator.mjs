#!/usr/bin/env node
/**
 * Android Emulator Live Reload Setup
 *
 * Bu script emulator icin Capacitor live reload'u kurar.
 * Emulator host makinaya 10.0.2.2 uzerinden erisir.
 *
 * Kullanim:
 *   npm run android:live
 *
 * Ne yapar:
 *   1. Capacitor'i live reload URL'i ile sync eder (10.0.2.2:5173)
 *   2. Vite dev server'i baslatir
 *
 * Sonra:
 *   - Android Studio'da yesil butona bas (ilk seferde APK kurulur)
 *   - Artik kod degisiklikleri OTOMATIK yuklenir, tekrar yesil butona basmana gerek yok!
 */

import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = dirname(__dirname);

const EMULATOR_HOST = '10.0.2.2';
const VITE_PORT = 5173;
const DEV_SERVER_URL = `http://${EMULATOR_HOST}:${VITE_PORT}`;

console.log('');
console.log('Android Emulator - Live Reload Setup');
console.log('=====================================');
console.log(`Dev server URL: ${DEV_SERVER_URL}`);
console.log('');

const env = {
  ...process.env,
  CAPACITOR_USE_LIVE_RELOAD: 'true',
  CAPACITOR_DEV_SERVER_URL: DEV_SERVER_URL,
};

// Step 1: Capacitor sync with live reload config
console.log('[1/2] Capacitor sync yapiliyor (live reload modunda)...');
try {
  execSync('npx cap sync android', {
    cwd: projectDir,
    env,
    stdio: 'inherit',
  });
  console.log('[1/2] Capacitor sync tamamlandi!');
} catch (e) {
  console.error('HATA: Capacitor sync basarisiz:', e.message);
  process.exit(1);
}

console.log('');
console.log('[2/2] Vite dev server baslatiliyor...');
console.log('');
console.log('=====================================================');
console.log('  HAZIR! Simdi Android Studio\'da yesil butona bas.');
console.log('  APK kurulduktan sonra kodun aninda gozukecek.');
console.log('  Degisiklikler icin tekrar butona basmana gerek yok!');
console.log('=====================================================');
console.log('');

// Step 2: Start Vite dev server
const vite = spawn('npx', ['vite', '--host', '--port', String(VITE_PORT)], {
  cwd: projectDir,
  env,
  stdio: 'inherit',
  shell: true,
});

vite.on('close', (code) => {
  if (code !== 0) {
    console.log(`\nVite dev server durdu (kod: ${code})`);
  }
});

process.on('SIGINT', () => {
  console.log('\n\nDev server durduruluyor...');
  vite.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  vite.kill('SIGTERM');
  process.exit(0);
});
