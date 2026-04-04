import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'

const AuthContext = createContext(null)

async function fetchProfileSafe(userId) {
  if (!userId) return null
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) { console.warn('[Auth] Profile fetch:', error.message); return null }
    return data || null
  } catch (e) { console.warn('[Auth] Profile exception:', e.message); return null }
}

async function upsertProfile(userId, email, metadata) {
  if (!userId) return null
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: userId, email,
        name: metadata.full_name || 'Ny spiller',
        full_name: metadata.full_name || 'Ny spiller',
        level: metadata.level ?? 5,
        play_style: metadata.play_style || 'Ved ikke endnu',
        area: metadata.area || 'København',
        availability: metadata.availability || [],
        bio: metadata.bio || '',
        avatar: metadata.avatar || '🎾',
        elo_rating: metadata.elo_rating ?? 1000,
        games_played: 0, games_won: 0,
      })
      .select().maybeSingle()
    if (error) { console.error('[Auth] Upsert:', error.message); return null }
    return data
  } catch (e) { console.error('[Auth] Upsert exception:', e.message); return null }
}

function translateAuthError(msg) {
  if (!msg) return 'Ukendt fejl'
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Forkert email eller adgangskode'
  if (m.includes('email not confirmed')) return 'Bekræft din email først — tjek indbakken'
  if (m.includes('user already registered')) return 'Email er allerede registreret — prøv at logge ind'
  if (m.includes('password should be at least')) return 'Adgangskode skal være mindst 6 tegn'
  if (m.includes('rate limit')) return 'For mange forsøg — vent lidt'
  if (m.includes('network')) return 'Netværksfejl — tjek internetforbindelsen'
  return msg
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const mountedRef = useRef(true)
  const profileReqRef = useRef(0)

  useEffect(() => { return () => { mountedRef.current = false } }, [])

  const loadProfile = useCallback(async (userId) => {
    const reqId = ++profileReqRef.current
    if (!mountedRef.current) return null
    setProfileLoading(true)
    const p = await fetchProfileSafe(userId)
    if (profileReqRef.current === reqId && mountedRef.current) {
      setProfile(p)
      setProfileLoading(false)
    }
    return p
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    let cancelled = false

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (cancelled) return
        if (error) { console.error('[Auth] getSession:', error.message); return }
        const s = data?.session ?? null
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) await loadProfile(s.user.id)
      } catch (e) {
        if (!cancelled) console.error('[Auth] Init:', e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (cancelled) return
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) { loadProfile(s.user.id) }
        else { profileReqRef.current++; setProfile(null); setProfileLoading(false) }
        setLoading(false)
      }
    )

    return () => { cancelled = true; subscription.unsubscribe() }
  }, [loadProfile])

  const signUp = useCallback(async (email, password, metadata = {}) => {
    if (!isSupabaseConfigured) throw new Error('Supabase er ikke konfigureret')
    if (!email || !email.includes('@')) throw new Error('Ugyldig email')
    if (!password || password.length < 6) throw new Error('Adgangskode skal være mindst 6 tegn')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { data: metadata },
    })
    if (error) throw new Error(translateAuthError(error.message))
    if (data.user) {
      const p = await upsertProfile(data.user.id, email, metadata)
      if (data.session) { setSession(data.session); setUser(data.user); setProfile(p); setProfileLoading(false); setLoading(false) }
    }
    return data
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) throw new Error('Supabase er ikke konfigureret')
    if (!email?.trim()) throw new Error('Indtast din email')
    if (!password) throw new Error('Indtast din adgangskode')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    })
    if (error) throw new Error(translateAuthError(error.message))
    if (data.user) {
      setSession(data.session); setUser(data.user); setLoading(false)
      const p = await fetchProfileSafe(data.user.id)
      setProfile(p); setProfileLoading(false)
    }
    return data
  }, [])

  const signOut = useCallback(async () => {
    profileReqRef.current++
    try { await supabase.auth.signOut() } catch (e) { console.warn('[Auth] Signout:', e.message) }
    setSession(null); setUser(null); setProfile(null); setProfileLoading(false)
  }, [])

  const updateProfile = useCallback(async (updates) => {
    if (!user) throw new Error('Ikke logget ind')
    const { id, email, ...safe } = updates
    const { data, error } = await supabase.from('profiles').update(safe).eq('id', user.id).select().single()
    if (error) throw new Error('Kunne ikke opdatere: ' + error.message)
    setProfile(data)
    return data
  }, [user])

  const refreshProfile = useCallback(() => { if (user) loadProfile(user.id) }, [user, loadProfile])

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, profileLoading, signUp, signIn, signOut, updateProfile, refreshProfile, isAuthenticated: Boolean(user && session) }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
