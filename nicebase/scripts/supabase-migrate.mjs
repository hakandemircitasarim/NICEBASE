import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function parseDotEnv(contents) {
  const out = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
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

function loadEnvFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return {}
  try {
    return parseDotEnv(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return {}
  }
}

function requireEnv(name) {
  const v = (process.env[name] || '').trim()
  if (!v) {
    console.error(`[supabase] Missing ${name}.`)
    console.error(
      `Create ".env.supabase" (see env.supabase.example) or set ${name} in your environment.`
    )
    process.exit(1)
  }
  return v
}

function run(cmd) {
  const res = spawnSync(cmd, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
    env: process.env,
  })
  process.exit(res.status ?? 1)
}

function main() {
  // Load token/project-ref from optional local-only file
  const cwd = process.cwd()
  const supaEnvPath = path.join(cwd, '.env.supabase')
  const extra = loadEnvFileIfExists(supaEnvPath)
  process.env = { ...process.env, ...extra }

  const args = process.argv.slice(2)
  const isDry = args.includes('--dry-run')

  // Ensure required inputs exist
  requireEnv('SUPABASE_PROJECT_REF')

  // Token is optional if user already ran `supabase login` interactively,
  // but required for fully non-interactive usage.
  // We still warn loudly if missing.
  const token = (process.env.SUPABASE_ACCESS_TOKEN || '').trim()
  if (!token) {
    console.warn('[supabase] SUPABASE_ACCESS_TOKEN is not set.')
    console.warn('[supabase] If CLI is already logged in, this may still work.')
    console.warn('[supabase] For "just run one command" flow, set it in .env.supabase.')
  }

  // Link (idempotent)
  const projectRef = process.env.SUPABASE_PROJECT_REF
  console.log(`[supabase] Linking to project: ${projectRef}`)
  const linkRes = spawnSync(`npx supabase link --project-ref ${projectRef}`, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
    env: process.env,
  })
  if ((linkRes.status ?? 1) !== 0) process.exit(linkRes.status ?? 1)

  // Push migrations
  // Use --yes to avoid interactive prompts (CI / "just run one command" flow)
  const pushCmd = isDry
    ? 'npx supabase db push --dry-run'
    : 'npx supabase db push --yes'
  console.log(`[supabase] ${isDry ? 'Dry run' : 'Applying'} migrations to remote...`)
  run(pushCmd)
}

main()


