import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'

const AuthContext = createContext(null)

const SESSION_TIMEOUT_MS = 12000
const PROFILE_TIMEOUT_MS = 12000

function fetchProfileQuery(userId) {
  return supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) console.warn('profiles:', error.message)
      return data || null
    })
    .catch(() => null)
}

/** Eksisterende profil eller minimal upsert (auth uden profiles-række → ellers hvid dashboard). */
async function fetchOrCreateProfile(userRow) {
  if (!userRow?.id) return null
  let p = await fetchProfileQuery(userRow.id)
  if (p) return p
  const meta = userRow.user_metadata || {}
  const email = userRow.email || ''
  const { data: row, error } = await supabase.from('profiles').upsert(
    {
      id: userRow.id,
      email: email || '',
      name: meta.full_name || meta.name || (email ? email.split('@')[0] : null) || 'Spiller',
      full_name: meta.full_name || meta.name || (email ? email.split('@')[0] : null) || 'Spiller',
      level: meta.level || 5,
      play_style: meta.play_style || 'Ved ikke endnu',
      area: meta.area || 'København',
      availability: meta.availability || [],
      bio: meta.bio || '',
      avatar: meta.avatar || '🎾',
      birth_year: meta.birth_year ?? null,
    },
    { onConflict: 'id' }
  ).select().single()
  if (error) {
    console.warn('profiles upsert:', error.message)
    return null
  }
  return row || null
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ])
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const profileReqId = useRef(0)

  const loadProfile = useCallback((userRow, opts = {}) => {
    const quiet = opts.quiet === true
    const id = ++profileReqId.current
    if (!userRow?.id) {
      setProfile(null)
      if (!quiet) setProfileLoading(false)
      return
    }
    if (!quiet) setProfileLoading(true)
    Promise.race([
      fetchOrCreateProfile(userRow),
      new Promise((resolve) => setTimeout(() => resolve(null), PROFILE_TIMEOUT_MS)),
    ])
      .then((p) => {
        if (profileReqId.current !== id) return
        setProfile(p)
      })
      .finally(() => {
        if (profileReqId.current !== id) return
        if (!quiet) setProfileLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.error(
        'Supabase mangler: sæt VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY (fx i Vercel / .env.local)'
      )
      setLoading(false)
      return
    }

    let cancelled = false

    const init = async () => {
      try {
        const result = await withTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT_MS
        )
        if (cancelled) return
        const s = result?.data?.session ?? null
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) loadProfile(s.user)
        else setProfile(null)
      } catch (e) {
        if (!cancelled) {
          console.error('Auth init error:', e)
          setSession(null)
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) loadProfile(s.user)
        else {
          profileReqId.current += 1
          setProfile(null)
          setProfileLoading(false)
        }
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signUp = async (email, password, metadata = {}) => {
    if (!isSupabaseConfigured) throw new Error('Supabase er ikke konfigureret')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    })
    if (error) throw error
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: email,
        name: metadata.full_name || 'Ny spiller',
        full_name: metadata.full_name || 'Ny spiller',
        level: metadata.level || 5,
        play_style: metadata.play_style || 'Ved ikke endnu',
        area: metadata.area || 'København',
        availability: metadata.availability || [],
        bio: metadata.bio || '',
        avatar: metadata.avatar || '🎾',
      })
      if (data.session) {
        setSession(data.session)
        setUser(data.user)
        loadProfile(data.user)
      }
    }
    return data
  }

  const signIn = async (email, password) => {
    if (!isSupabaseConfigured) throw new Error('Supabase er ikke konfigureret')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (data.user) {
      setSession(data.session)
      setUser(data.user)
      loadProfile(data.user)
    }
    return data
  }

  const signOut = async () => {
    profileReqId.current += 1
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
    setProfileLoading(false)
  }

  const updateProfile = async (updates) => {
    if (!user) throw new Error('Not authenticated')
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single()
    if (error) throw error
    setProfile(data)
    return data
  }

  const refreshProfile = useCallback(() => {
    if (user) loadProfile(user)
  }, [user, loadProfile])

  /** Genindlæs profiles-rækken uden fuldskærms-loading (fx efter DB-reset eller tab-skift). */
  const refreshProfileQuiet = useCallback(() => {
    if (user) loadProfile(user, { quiet: true })
  }, [user, loadProfile])

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        profileLoading,
        signUp,
        signIn,
        signOut,
        updateProfile,
        refreshProfile,
        refreshProfileQuiet,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
