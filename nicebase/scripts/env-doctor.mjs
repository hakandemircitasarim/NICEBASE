import fs from 'node:fs'
import path from 'node:path'

function parseDotEnv(contents) {
  const out = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    // strip quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function classifySupabaseUrl(url) {
  const u = (url || '').trim()
  if (!u) return { kind: 'OFFLINE', detail: 'VITE_SUPABASE_URL boş' }

  const lower = u.toLowerCase()
  const isLocal =
    lower.startsWith('http://127.0.0.1:54321') ||
    lower.startsWith('http://localhost:54321') ||
    lower.startsWith('http://127.0.0.1') ||
    lower.startsWith('http://localhost') ||
    lower.includes(':54321')

  if (isLocal) return { kind: 'LOCAL', detail: u }

  const isCloud =
    lower.includes('.supabase.co') ||
    lower.includes('.supabase.in') ||
    lower.includes('supabase.co')

  if (isCloud) return { kind: 'CLOUD', detail: u }

  return { kind: 'UNKNOWN', detail: u }
}

function main() {
  const cwd = process.cwd()
  const envPath = path.join(cwd, '.env')

  let env = { ...process.env }
  if (fs.existsSync(envPath)) {
    try {
      const parsed = parseDotEnv(fs.readFileSync(envPath, 'utf8'))
      env = { ...env, ...parsed }
    } catch (e) {
      console.error('[doctor] .env okunamadı:', e?.message || e)
    }
  } else {
    console.warn('[doctor] .env bulunamadı (yalnızca process.env kontrol edildi).')
  }

  const url = env.VITE_SUPABASE_URL || ''
  const anon = env.VITE_SUPABASE_ANON_KEY || ''
  const appEnv = env.VITE_APP_ENV || ''

  const classification = classifySupabaseUrl(url)

  console.log('--- NICEBASE doctor ---')
  if (appEnv) console.log('VITE_APP_ENV:', appEnv)
  console.log('Supabase hedefi:', classification.kind)
  console.log('VITE_SUPABASE_URL:', classification.detail)
  console.log('VITE_SUPABASE_ANON_KEY:', anon ? '(set)' : '(missing)')
  console.log('')

  if (classification.kind === 'LOCAL') {
    console.log('Not: LOCAL Supabase kullanıyorsun (Docker).')
    console.log(
      'Uyarı: `supabase db reset` LOCAL DB’yi siler (kullanıcılar/anılar dahil). Env değişikliği için kullanılmaz.'
    )
  } else if (classification.kind === 'CLOUD') {
    console.log('Not: Supabase Cloud bağlısın. Docker çalıştırmak zorunda değilsin.')
    console.log('Env değiştiyse genelde sadece `npm run dev` kapat/aç yeter.')
  } else if (classification.kind === 'OFFLINE') {
    console.log('Not: Supabase kapalı; uygulama offline modda (sadece cihazdaki veri).')
  } else {
    console.log('Not: Supabase URL formatı tanınamadı; yine de bağlantı bu URL’ye gider.')
  }
}

main()


