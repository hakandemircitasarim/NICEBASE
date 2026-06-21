import { describe, it, expect } from 'vitest'
import i18n from '../../i18n'

/**
 * Guards CLAUDE.md rule 2.5: every user-facing key must exist in BOTH locales.
 * Catches the class of bug where a key is added to `tr` but not `en` (or vice
 * versa), which would otherwise render the raw key — or a hardcoded fallback in
 * the wrong language — to half the users. Recurses into nested objects (e.g.
 * `streakProtectionMessages.message1`) so nested drift is caught too.
 */
function flatten(obj: Record<string, unknown> | undefined, prefix = ''): string[] {
  if (!obj) return []
  const out: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatten(v as Record<string, unknown>, key))
    } else {
      out.push(key)
    }
  }
  return out.sort()
}

describe('i18n tr/en parity', () => {
  const tr = flatten(i18n.getResourceBundle('tr', 'translation'))
  const en = flatten(i18n.getResourceBundle('en', 'translation'))
  const trSet = new Set(tr)
  const enSet = new Set(en)

  it('loads both translation bundles', () => {
    expect(tr.length).toBeGreaterThan(50)
    expect(en.length).toBeGreaterThan(50)
  })

  it('has no keys present in tr but missing in en', () => {
    expect(tr.filter((k) => !enSet.has(k))).toEqual([])
  })

  it('has no keys present in en but missing in tr', () => {
    expect(en.filter((k) => !trSet.has(k))).toEqual([])
  })
})
