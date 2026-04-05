import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

if (!isSupabaseConfigured) {
  console.error(
    '[PadelMakker] Supabase er ikke konfigureret. Sæt VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY i environment variables.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-anon-key',
  {
    auth: {
      // Persist session in localStorage so login survives page refresh
      persistSession: true,
      // Automatically refresh token before it expires
      autoRefreshToken: true,
      // Detect session from URL (for email confirm redirects)
      detectSessionInUrl: true,
      // Use localStorage (default, but explicit for clarity)
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
)
