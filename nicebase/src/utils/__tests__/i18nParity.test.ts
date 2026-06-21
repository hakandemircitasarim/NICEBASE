import { describe, it, expect } from 'vitest'
import i18n from '../../i18n'

/**
 * Guards CLAUDE.md rule 2.5: every user-facing key must exist in BOTH locales.
 * Catches the class of bug where a key is added to `tr` but not `en` (or vice
 * versa), which would otherwise render the raw key — or a hardcoded fallback in
 * the wrong language — to half the users.
 */
function keysOf(bundle: Record<string, unknown> | undefined): string[] {
  return Object.keys(bundle ?? {}).sort()
}

describe('i18n tr/en parity', () => {
  const tr = i18n.getResourceBundle('tr', 'translation') as Record<string, unknown>
  const en = i18n.getResourceBundle('en', 'translation') as Record<string, unknown>

  it('loads both translation bundles', () => {
    expect(keysOf(tr).length).toBeGreaterThan(50)
    expect(keysOf(en).length).toBeGreaterThan(50)
  })

  it('has no keys present in tr but missing in en', () => {
    const missingInEn = keysOf(tr).filter((k) => !(k in en))
    expect(missingInEn).toEqual([])
  })

  it('has no keys present in en but missing in tr', () => {
    const missingInTr = keysOf(en).filter((k) => !(k in tr))
    expect(missingInTr).toEqual([])
  })
})
