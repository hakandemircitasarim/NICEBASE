import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Validate environment variables
function validateSupabaseConfig(): { isValid: boolean; error?: string } {
  if (!supabaseUrl || supabaseUrl.trim() === '') {
    return { isValid: false, error: 'VITE_SUPABASE_URL is not set or is empty' }
  }
  if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
    return { isValid: false, error: 'VITE_SUPABASE_ANON_KEY is not set or is empty' }
  }
  
  // Basic URL validation
  try {
    new URL(supabaseUrl)
  } catch {
    return { isValid: false, error: 'VITE_SUPABASE_URL is not a valid URL' }
  }
  
  return { isValid: true }
}

const validation = validateSupabaseConfig()
export const hasSupabaseConfig = validation.isValid

// Log validation errors in development
if (!hasSupabaseConfig && import.meta.env.DEV) {
  console.warn('Supabase configuration is invalid:', validation.error)
}

// Safe storage reference — avoids crash when window is not defined
const safeStorage = typeof window !== 'undefined' ? window.localStorage : undefined

// Extract project ref from URL for default storage key
const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : 'app'

// Migration: move old custom key to standard key so existing sessions survive
if (typeof window !== 'undefined' && safeStorage) {
  try {
    const standardKey = `sb-${projectRef}-auth-token`
    const oldData = safeStorage.getItem('supabase.auth.token')
    if (oldData && !safeStorage.getItem(standardKey)) {
      safeStorage.setItem(standardKey, oldData)
    }
    // Clean up old key after migration
    if (oldData && safeStorage.getItem(standardKey)) {
      safeStorage.removeItem('supabase.auth.token')
    }
  } catch {
    // Ignore storage errors
  }
}

// Only create client if configuration is valid
// Use empty strings as fallback to prevent crashes, but client won't work without valid config
export const supabase = createClient(
  hasSupabaseConfig ? supabaseUrl : '',
  hasSupabaseConfig ? supabaseAnonKey : '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: safeStorage,
      // Use Supabase default storage key format for proper token refresh
    },
  }
)

