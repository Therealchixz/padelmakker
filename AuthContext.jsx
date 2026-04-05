import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'

const AuthContext = createContext(null)

/**
 * Safely fetch a user's profile from Supabase.
 * Returns null instead of throwing on error.
 */
async function fetchProfileSafe(userId) {
  if (!userId) return null
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.warn('[Auth] Profile fetch error:', error.message)
      return null
    }
    return data || null
  } catch (e) {
    console.warn('[Auth] Profile fetch exception:', e.message)
    return null
  }
}

/**
 * Create or update a user's profile.
 * Uses upsert to handle both new and existing profiles.
 */
async function upsertProfile(userId, email, metadata) {
  if (!userId) return null
  try {
    const profileData = {
      id: userId,
      email: email,
      name: metadata.full_name || 'Ny spiller',
      full_name: metadata.full_name || 'Ny spiller',
      level: metadata.level ?? 5,
      play_style: metadata.play_style || 'Ved ikke endnu',
      area: metadata.area || 'København',
      availability: metadata.availability || [],
      bio: metadata.bio || '',
      avatar: metadata.avatar || '🎾',
      elo_rating: metadata.elo_rating ?? 1000,
      games_played: metadata.games_played ?? 0,
      games_won: metadata.games_won ?? 0,
    }
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData)
      .select()
      .maybeSingle()
    if (error) {
      console.error('[Auth] Profile upsert error:', error.message)
      return null
    }
    return data
  } catch (e) {
    console.error('[Auth] Profile upsert exception:', e.message)
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [authError, setAuthError] = useState(null)

  // Track if component is mounted to prevent state updates after unmount
  const mountedRef = useRef(true)
  // Track current profile request to prevent stale updates
  const profileReqRef = useRef(0)

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  /**
   * Load profile with request tracking to prevent race conditions.
   * If a newer request is started, older ones are ignored.
   */
  const loadProfile = useCallback(async (userId) => {
    const reqId = ++profileReqRef.current
    if (!mountedRef.current) return null
    setProfileLoading(true)

    const p = await fetchProfileSafe(userId)

    // Only update state if this is still the latest request and component is mounted
    if (profileReqRef.current === reqId && mountedRef.current) {
      setProfile(p)
      setProfileLoading(false)
    }
    return p
  }, [])

  /**
   * Initialize auth state on mount.
   * 1. Check for existing session (persisted in localStorage by Supabase)
   * 2. Set up listener for auth state changes
   * 3. Always ensure loading is set to false, even on error
   */
  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.error('[Auth] Supabase not configured — skipping auth init')
      setLoading(false)
      return
    }

    let cancelled = false

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (cancelled) return

        if (error) {
          console.error('[Auth] getSession error:', error.message)
          setAuthError(error.message)
          return
        }

        const s = data?.session ?? null
        setSession(s)
        setUser(s?.user ?? null)

        if (s?.user) {
          await loadProfile(s.user.id)
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[Auth] Init exception:', e.message)
          setAuthError(e.message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (cancelled) return

        // Update session and user immediately
        setSession(s)
        setUser(s?.user ?? null)
        setAuthError(null)

        if (s?.user) {
          // Load profile in background — don't block UI
          loadProfile(s.user.id)
        } else {
          // User logged out — clear everything
          profileReqRef.current += 1
          setProfile(null)
          setProfileLoading(false)
        }

        // Ensure loading is false after any auth event
        setLoading(false)
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [loadProfile])

  /**
   * Sign up a new user with email + password.
   * Creates a profile immediately after signup.
   */
  const signUp = useCallback(async (email, password, metadata = {}) => {
    if (!isSupabaseConfigured) throw new Error('Supabase er ikke konfigureret')

    // Input validation
    if (!email || !email.includes('@')) throw new Error('Ugyldig email adresse')
    if (!password || password.length < 6) throw new Error('Adgangskode skal være mindst 6 tegn')

    setAuthError(null)

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: metadata },
    })

    if (error) {
      // Translate common Supabase errors to Danish
      const msg = translateAuthError(error.message)
      throw new Error(msg)
    }

    // Create profile immediately (don't rely on database trigger)
    if (data.user) {
      const p = await upsertProfile(data.user.id, email, metadata)

      if (data.session) {
        setSession(data.session)
        setUser(data.user)
        setProfile(p)
        setProfileLoading(false)
        setLoading(false)
      }
    }

    return data
  }, [])

  /**
   * Sign in with email + password.
   * Fetches profile after successful login.
   */
  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) throw new Error('Supabase er ikke konfigureret')

    // Input validation
    if (!email || !email.trim()) throw new Error('Indtast din email')
    if (!password) throw new Error('Indtast din adgangskode')

    setAuthError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) {
      const msg = translateAuthError(error.message)
      throw new Error(msg)
    }

    // Set user state immediately for responsive UI
    if (data.user) {
      setSession(data.session)
      setUser(data.user)
      setLoading(false)

      // Load profile (onAuthStateChange will also fire, but this is faster)
      const p = await fetchProfileSafe(data.user.id)
      setProfile(p)
      setProfileLoading(false)
    }

    return data
  }, [])

  /**
   * Sign out and clear all state.
   */
  const signOut = useCallback(async () => {
    profileReqRef.current += 1
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('[Auth] Sign out error:', e.message)
    }
    setSession(null)
    setUser(null)
    setProfile(null)
    setProfileLoading(false)
    setAuthError(null)
  }, [])

  /**
   * Update the current user's profile.
   */
  const updateProfile = useCallback(async (updates) => {
    if (!user) throw new Error('Du er ikke logget ind')

    // Sanitize updates — don't allow changing id or email
    const { id, email, ...safeUpdates } = updates

    const { data, error } = await supabase
      .from('profiles')
      .update(safeUpdates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw new Error('Kunne ikke opdatere profil: ' + error.message)
    setProfile(data)
    return data
  }, [user])

  /**
   * Refresh profile from database.
   */
  const refreshProfile = useCallback(() => {
    if (user) loadProfile(user.id)
  }, [user, loadProfile])

  const value = {
    session,
    user,
    profile,
    loading,
    profileLoading,
    authError,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile,
    isAuthenticated: Boolean(user && session),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/**
 * Translate common Supabase auth errors to Danish.
 */
function translateAuthError(msg) {
  if (!msg) return 'Ukendt fejl'
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Forkert email eller adgangskode'
  if (m.includes('email not confirmed')) return 'Du skal bekræfte din email først. Tjek din indbakke.'
  if (m.includes('user already registered')) return 'Denne email er allerede registreret. Prøv at logge ind.'
  if (m.includes('password should be at least')) return 'Adgangskode skal være mindst 6 tegn'
  if (m.includes('rate limit')) return 'For mange forsøg. Vent lidt og prøv igen.'
  if (m.includes('network')) return 'Netværksfejl. Tjek din internetforbindelse.'
  if (m.includes('signup is disabled')) return 'Oprettelse af nye konti er midlertidigt deaktiveret.'
  return msg
}
