#!/usr/bin/env node

/**
 * Demo Account Seeding Script for NICEBASE
 *
 * Creates the review account Google Play's reviewers sign in with, and fills it
 * with sample memories so the app does not open on an empty vault (an empty
 * account gives reviewers nothing to look at and risks a rejection).
 *
 * The password is read from the environment and never stored in the repo.
 *
 * Usage (PowerShell):
 *   $env:DEMO_EMAIL="review@example.com"; $env:DEMO_PASSWORD="..."; npm run seed:demo
 *
 * Usage (bash):
 *   DEMO_EMAIL=review@example.com DEMO_PASSWORD=... npm run seed:demo
 *
 * Premium note: is_premium cannot be set from the client — migration
 * 20260620010000 revokes that column from `authenticated` on purpose. Grant it
 * afterwards from the Supabase SQL editor:
 *   update public.users set is_premium = true where email = '<DEMO_EMAIL>';
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Minimal .env reader — the Vite `import.meta.env` bridge does not exist in Node.
function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const fileEnv = readEnvFile(join(rootDir, '.env'));
const supabaseUrl = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY;
// Also accepted from .env (which is gitignored) so the credentials never have
// to be typed on a command line or pasted into a chat.
const email = process.env.DEMO_EMAIL || fileEnv.DEMO_EMAIL;
const password = process.env.DEMO_PASSWORD || fileEnv.DEMO_PASSWORD;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not found in .env');
  process.exit(1);
}
if (!email || !password) {
  console.error('Error: DEMO_EMAIL and DEMO_PASSWORD must be set.');
  console.error('   Easiest: add both to .env (gitignored), then run: npm run seed:demo');
  console.error('   bash:       DEMO_EMAIL=... DEMO_PASSWORD=... npm run seed:demo');
  console.error('   PowerShell: $env:DEMO_EMAIL="..."; $env:DEMO_PASSWORD="..."; npm run seed:demo');
  process.exit(1);
}

// Sample vault contents. Kept in Turkish to match the default store listing,
// spread across categories, life areas and intensities so the reviewer sees the
// statistics, filters and Insights screens populated rather than empty.
const sampleMemories = [
  {
    text: 'Üniversite mezuniyet törenimde ailemin yüzündeki gururu gördüm. Yıllarca süren emeğin karşılığını o an aldım.',
    category: 'success', lifeArea: 'personal', intensity: 10, isCore: true, daysAgo: 420,
    connections: ['Annem', 'Babam'],
  },
  {
    text: 'Sahilde gün batımını izlerken hiçbir şey düşünmediğim o yirmi dakika. Uzun zamandır bu kadar sakin hissetmemiştim.',
    category: 'peace', lifeArea: 'personal', intensity: 8, isCore: false, daysAgo: 180,
    connections: [],
  },
  {
    text: 'İlk projemin canlıya çıktığı gün ekipçe kutladık. Aylardır uğraştığımız şey nihayet gerçek kullanıcılara ulaştı.',
    category: 'success', lifeArea: 'work', intensity: 9, isCore: true, daysAgo: 95,
    connections: ['Ekip'],
  },
  {
    text: 'Kardeşimle gece boyunca eski fotoğraflara bakıp güldük. Unuttuğumuzu sandığımız onlarca anı geri geldi.',
    category: 'fun', lifeArea: 'family', intensity: 8, isCore: false, daysAgo: 60,
    connections: ['Kardeşim'],
  },
  {
    text: 'Kapadokya\'da balon turunda gün doğumunu izledim. Hayatımda gördüğüm en etkileyici manzaraydı.',
    category: 'adventure', lifeArea: 'travel', intensity: 10, isCore: true, daysAgo: 240,
    connections: [],
  },
  {
    text: 'Zor bir dönemimde arkadaşımın hiçbir şey sormadan yanımda oturması. Bazen en iyi destek sessizlik oluyor.',
    category: 'love', lifeArea: 'friends', intensity: 9, isCore: false, daysAgo: 45,
    connections: ['En yakın arkadaşım'],
  },
  {
    text: 'Sabah yürüyüşünde parkta çay içen yaşlı çifti gördüm. Yıllar sonra hâlâ birbirlerine gülümsemeleri içimi ısıttı.',
    category: 'inspiration', lifeArea: 'personal', intensity: 7, isCore: false, daysAgo: 21,
    connections: [],
  },
  {
    text: 'Altı aydır düzenli spor yapıyorum ve bugün ilk kez on kilometre koştum. Vazgeçmediğim için kendimle gurur duyuyorum.',
    category: 'growth', lifeArea: 'health', intensity: 8, isCore: false, daysAgo: 14,
    connections: [],
  },
  {
    text: 'Yıllardır çalmadığım gitarı tekrar elime aldım. Parmaklarım hatırlamış, iki saat nasıl geçti anlamadım.',
    category: 'fun', lifeArea: 'hobby', intensity: 7, isCore: false, daysAgo: 7,
    connections: [],
  },
  {
    text: 'Sağlıklı olduğum, sevdiklerimin yanımda olduğu ve yarına umutla bakabildiğim için minnettarım.',
    category: 'gratitude', lifeArea: 'personal', intensity: 9, isCore: true, daysAgo: 2,
    connections: [],
  },
];

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function seedDemoAccount() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log(`Seeding demo account for ${email}...\n`);

  // Sign up, falling back to sign-in when the account already exists so the
  // script can be re-run safely.
  let session = null;
  const signUpRes = await supabase.auth.signUp({ email, password });

  if (signUpRes.error) {
    console.log(`  Sign-up rejected (${signUpRes.error.message}) — trying sign-in instead.`);
  } else {
    session = signUpRes.data.session;
    if (session) console.log('  Account created.');
  }

  if (!session) {
    const signInRes = await supabase.auth.signInWithPassword({ email, password });
    if (signInRes.error) {
      console.error(`\nError: could not sign in as ${email}: ${signInRes.error.message}`);
      console.error('   If the project requires email confirmation, confirm the address first,');
      console.error('   or disable confirmation under Authentication > Sign In / Providers.');
      process.exit(1);
    }
    session = signInRes.data.session;
    console.log('  Signed in to the existing account.');
  }

  const userId = session.user.id;

  // Mirror userService.ensureUserRow(): DO NOTHING on conflict, and never send
  // the billing columns — client INSERT on them is revoked by migration.
  const { error: userError } = await supabase.from('users').upsert(
    {
      id: userId,
      email,
      display_name: 'NICEBASE Demo',
      avatar_url: null,
      weekly_summary_day: null,
      daily_reminder_time: null,
      language: 'tr',
      theme: 'light',
      created_at: new Date().toISOString(),
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  if (userError) {
    console.error(`\nError: could not create the users row: ${userError.message}`);
    process.exit(1);
  }
  console.log('  Profile row ready.');

  // Skip seeding if the vault already has content, so re-runs don't pile up.
  const { count, error: countError } = await supabase
    .from('memories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (countError) {
    console.error(`\nError: could not read existing memories: ${countError.message}`);
    process.exit(1);
  }
  if (count > 0) {
    console.log(`\nAccount already holds ${count} memories — nothing to seed.`);
    return;
  }

  const rows = sampleMemories.map((m) => {
    const created = isoDaysAgo(m.daysAgo);
    return {
      id: randomUUID(),
      user_id: userId,
      text: m.text,
      category: m.category,
      categories: [m.category],
      intensity: m.intensity,
      date: created.split('T')[0],
      connections: m.connections,
      life_area: m.lifeArea,
      is_core: m.isCore,
      photos: [],
      created_at: created,
      updated_at: created,
    };
  });

  const { error: insertError } = await supabase.from('memories').insert(rows);
  if (insertError) {
    console.error(`\nError: could not insert memories: ${insertError.message}`);
    process.exit(1);
  }

  console.log(`  Inserted ${rows.length} sample memories.`);
  console.log('\nDemo account ready.');
  console.log('Next: grant premium from the Supabase SQL editor so the reviewer sees every screen:');
  console.log(`  update public.users set is_premium = true where email = '${email}';`);
}

seedDemoAccount().catch((error) => {
  console.error('Error seeding demo account:', error.message);
  process.exit(1);
});
