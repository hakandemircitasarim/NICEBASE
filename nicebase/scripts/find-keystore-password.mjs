#!/usr/bin/env node

/**
 * Keystore Password Finder for NICEBASE
 *
 * Tries each candidate password against android/app/release.keystore and, on a
 * match, writes KEYSTORE_PASSWORD / KEY_PASSWORD into .env so the release build
 * can run. The matching password is never printed — only whether one was found.
 *
 * Usage:
 *   1. Put one candidate password per line in keystore-candidates.txt
 *      (project root, gitignored). Blank lines and #comments are skipped.
 *   2. npm run find:keystore-password
 *   3. Delete keystore-candidates.txt afterwards.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const keystore = join(rootDir, 'android', 'app', 'release.keystore');
const candidatesFile = process.argv[2]
  ? join(rootDir, process.argv[2])
  : join(rootDir, 'keystore-candidates.txt');
const envFile = join(rootDir, '.env');
const ALIAS = 'nicebase';

if (!existsSync(keystore)) {
  console.error(`Error: keystore not found at ${keystore}`);
  process.exit(1);
}
if (!existsSync(candidatesFile)) {
  console.error(`Error: ${candidatesFile} not found.`);
  console.error('   Create it with one candidate password per line, then re-run.');
  process.exit(1);
}

const candidates = readFileSync(candidatesFile, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

if (candidates.length === 0) {
  console.error('Error: no candidates found in the file.');
  process.exit(1);
}

// `keytool -list` only validates the STORE password. The key password is
// checked separately below, because they can differ.
function storePasswordWorks(password) {
  const res = spawnSync(
    'keytool',
    ['-list', '-keystore', keystore, '-storepass', password],
    { encoding: 'utf8' }
  );
  return res.status === 0;
}

// Exporting the private key entry requires the KEY password, so a successful
// -certreq proves both passwords.
function keyPasswordWorks(storePassword, keyPassword) {
  const res = spawnSync(
    'keytool',
    [
      '-certreq', '-keystore', keystore, '-alias', ALIAS,
      '-storepass', storePassword, '-keypass', keyPassword,
    ],
    { encoding: 'utf8' }
  );
  return res.status === 0;
}

// Replace the key if it already exists, otherwise append it.
function upsertEnv(contents, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(contents)) return contents.replace(pattern, line);
  return contents.replace(/\s*$/, '\n') + line + '\n';
}

console.log(`Trying ${candidates.length} candidate(s) against release.keystore...\n`);

let storePassword = null;
for (let i = 0; i < candidates.length; i++) {
  process.stdout.write(`  candidate ${i + 1}/${candidates.length}... `);
  if (storePasswordWorks(candidates[i])) {
    console.log('MATCH');
    storePassword = candidates[i];
    break;
  }
  console.log('no');
}

if (!storePassword) {
  console.log('\nNone of the candidates unlocked the keystore.');
  console.log('Next step: request an upload key reset in Play Console and generate a new keystore.');
  process.exit(2);
}

// The key password is usually the same as the store password; if not, look for
// it among the remaining candidates.
let keyPassword = null;
for (const candidate of [storePassword, ...candidates]) {
  if (keyPasswordWorks(storePassword, candidate)) {
    keyPassword = candidate;
    break;
  }
}

if (!keyPassword) {
  console.log('\nStore password found, but no candidate matched the KEY password.');
  console.log(`Add the key password for alias "${ALIAS}" to the candidates file and re-run.`);
  process.exit(3);
}

let env = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
env = upsertEnv(env, 'KEYSTORE_PASSWORD', storePassword);
env = upsertEnv(env, 'KEY_PASSWORD', keyPassword);
writeFileSync(envFile, env);

try {
  unlinkSync(candidatesFile);
} catch {
  console.log('Note: could not delete the candidates file — remove it manually.');
}

console.log('\nFound it. KEYSTORE_PASSWORD and KEY_PASSWORD written to .env.');
console.log('The candidates file has been deleted. You can now run the release build.');
