/**
 * Canonical default values for a newly-created user row.
 *
 * NOTE: the Aiya edge function (supabase/functions/aiya-chat/index.ts) keeps its
 * own copy of these (different runtime — Deno vs the browser bundle — so it can't
 * import this module). Keep the two in sync.
 */
export const DEFAULT_AIYA_LIMIT = 50
export const DEFAULT_LANGUAGE = 'tr' as const
export const DEFAULT_THEME = 'light' as const
