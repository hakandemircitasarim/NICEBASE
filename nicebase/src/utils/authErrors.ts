import type { TFunction } from 'i18next'

/**
 * Map a raw Supabase/auth error message to a localized, user-friendly string.
 * Keep the raw message only for logging — never show it to the user (it's
 * English and inconsistent). Falls back to a generic localized message.
 */
export function authErrorMessage(raw: string, t: TFunction): string {
  const m = (raw || '').toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) return t('authInvalidCredentials')
  if (m.includes('email not confirmed')) return t('authEmailNotConfirmed')
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already')) return t('authEmailInUse')
  if (m.includes('password') && (m.includes('at least') || m.includes('weak') || m.includes('should be') || m.includes('6 characters'))) return t('authWeakPassword')
  if (m.includes('rate limit') || m.includes('too many')) return t('authRateLimited')
  if (m.includes('network') || m.includes('failed to fetch') || m.includes('timeout') || m.includes('fetch')) return t('authNetworkError')
  return t('errorOccurred')
}
