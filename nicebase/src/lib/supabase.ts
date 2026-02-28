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
      storageKey: 'supabase.auth.token',
    },
  }
)

