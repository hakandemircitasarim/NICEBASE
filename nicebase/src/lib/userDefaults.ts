/**
 * Canonical default values for a newly-created user row.
 *
 * NOTE: the Aiya edge function (supabase/functions/aiya-chat/index.ts) keeps its
 * own copy of these (different runtime — Deno vs the browser bundle — so it can't
 * import this module). Keep the two in sync.
 */
import i18n from '../i18n'

export const DEFAULT_AIYA_LIMIT = 50
export const DEFAULT_LANGUAGE = 'tr' as const
export const DEFAULT_THEME = 'light' as const

/**
 * Language for a newly-created user row: the app's CURRENT UI language,
 * normalized to the two supported codes. Hardcoding DEFAULT_LANGUAGE here
 * would flip an English-UI user to Turkish on first login/signup.
 */
export function currentLanguage(): 'tr' | 'en' {
  return i18n.language?.startsWith('en') ? 'en' : DEFAULT_LANGUAGE
}
