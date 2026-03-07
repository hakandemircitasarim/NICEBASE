#!/usr/bin/env node
/**
 * Android Physical Device - Live Reload Setup
 *
 * Bu script fiziksel telefon icin Capacitor live reload'u kurar.
 * Bilgisayarinin IP adresini otomatik alir.
 *
 * Kullanim:
 *   npm run android:live:device
 *
 * Gereksinim:
 *   - Telefon ve bilgisayar ayni WiFi'a bagli olmali
 *
 * Ne yapar:
 *   1. Bilgisayarin IP adresini otomatik tespit eder
 *   2. Capacitor'i live reload URL'i ile sync eder
 *   3. Vite dev server'i baslatir
 */

import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = dirname(__dirname);

const VITE_PORT = 5173;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        candidates.push({ name, address: iface.address });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Prefer WiFi/WLAN interfaces
  const wifi = candidates.find(c =>
    c.name.toLowerCase().includes('wlan') ||
    c.name.toLowerCase().includes('wifi') ||
    c.name.toLowerCase().includes('wi-fi') ||
    c.name.toLowerCase().includes('en0') ||
    c.name.toLowerCase().includes('wlp')
  );

  return wifi ? wifi.address : candidates[0].address;
}

const localIP = getLocalIP();

if (!localIP) {
  console.error('HATA: Bilgisayarin IP adresi bulunamadi.');
  console.error('WiFi\'a bagli oldugundan emin ol.');
  process.exit(1);
}

const DEV_SERVER_URL = `http://${localIP}:${VITE_PORT}`;

console.log('');
console.log('Android Fiziksel Cihaz - Live Reload Setup');
console.log('==========================================');
console.log(`Bilgisayar IP: ${localIP}`);
console.log(`Dev server URL: ${DEV_SERVER_URL}`);
console.log('');
console.log('DIKKAT: Telefon ve bilgisayar ayni WiFi\'a bagli olmali!');
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
