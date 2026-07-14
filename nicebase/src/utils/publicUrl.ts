import { Capacitor } from '@capacitor/core'

// Canonical hosted web app. Auth e-mail links (password reset, confirmation)
// must land on a real https origin: inside the Capacitor WebView
// window.location.origin is "https://localhost", which produces dead links.
// Keep in sync with the Supabase Auth URL allowlist (site_url + redirect URLs).
const PROD_WEB_URL = 'https://nicebase.vercel.app'

/**
 * Base URL of the publicly hosted web app, without a trailing slash.
 * - Overridable via VITE_PUBLIC_WEB_URL (e.g. staging).
 * - Native: the hosted production URL (never the WebView origin).
 * - Web: the current origin, so dev/preview keep working.
 */
export function getPublicWebBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_WEB_URL as string | undefined
  if (fromEnv && fromEnv.trim() !== '') return fromEnv.trim().replace(/\/+$/, '')
  if (Capacitor.isNativePlatform()) return PROD_WEB_URL
  return window.location.origin
}
