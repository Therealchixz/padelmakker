import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseKey
)

if (!isSupabaseConfigured) {
  console.error(
    '[PadelMakker] Supabase er ikke konfigureret. Sæt VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY i .env.local eller Vercel.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-anon-key'
)
