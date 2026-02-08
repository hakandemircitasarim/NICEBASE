import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

// Safe storage reference — avoids crash when window is not defined
const safeStorage = typeof window !== 'undefined' ? window.localStorage : undefined

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: safeStorage,
    storageKey: 'supabase.auth.token',
  },
})

