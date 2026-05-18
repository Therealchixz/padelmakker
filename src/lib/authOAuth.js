import { supabase } from './supabase'

/** @param {'google' | 'apple'} provider */
export async function signInWithOAuthProvider(provider, redirectPath = '/login') {
  const redirectTo = getAuthRedirectTo(redirectPath)
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  })
  if (error) throw new Error(mapOAuthError(error.message))
}

export function getAuthRedirectTo(path = '/login') {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${origin}${normalized}`
}

export function mapOAuthError(message) {
  const m = String(message || '').toLowerCase()
  if (m.includes('provider is not enabled')) {
    return 'Google/Apple-login er ikke slået til i Supabase endnu. Kontakt support.'
  }
  if (m.includes('redirect') && m.includes('url')) {
    return 'Login-return URL mangler i Supabase (Authentication → URL configuration).'
  }
  return message || 'Kunne ikke starte login med Google/Apple.'
}

export function splitDisplayName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: '', last: '' }
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

export function oauthAvatarUrl(user) {
  const meta = user?.user_metadata || {}
  const url = meta.picture || meta.avatar_url || meta.avatar
  return typeof url === 'string' && url.startsWith('http') ? url : null
}
