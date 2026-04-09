import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { DEFAULT_PROFILE_REGION } from './regions'

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

function isGenericProfileName(s) {
  if (s == null || String(s).trim() === '') return true
  const t = String(s).trim().toLowerCase()
  return t === 'ny spiller' || t === 'ny' || t === 'spiller'
}

/** Når DB-trigger har oprettet minimal profil før app-upsert, hent data fra auth user_metadata */
function buildProfilePatchFromSignupMetadata(meta) {
  if (meta == null || typeof meta !== 'object') return null
  const displayName = String(meta.full_name || meta.name || '').trim()
  if (displayName.length < 2) return null
  const levelNum =
    typeof meta.level === 'number' && Number.isFinite(meta.level)
      ? meta.level
      : parseFloat(String(meta.level ?? '').match(/\d+/)?.[0] || '5')
  const by = meta.birth_year
  const birthYear =
    by != null && by !== ''
      ? parseInt(String(by), 10)
      : null
  return {
    full_name: displayName,
    name: displayName,
    level: Number.isFinite(levelNum) ? levelNum : 5,
    play_style: String(meta.play_style || 'Ved ikke endnu').trim() || 'Ved ikke endnu',
    area: String(meta.area || DEFAULT_PROFILE_REGION).trim() || DEFAULT_PROFILE_REGION,
    availability: Array.isArray(meta.availability) ? meta.availability : [],
    bio: String(meta.bio || '').trim(),
    avatar: meta.avatar || '🎾',
    birth_year: birthYear != null && !Number.isNaN(birthYear) ? birthYear : null,
  }
}

async function syncProfileFromAuthMetadata(authUser, profileRow) {
  if (!authUser?.id || !profileRow) return profileRow
  const dbName = String(profileRow.full_name || profileRow.name || '').trim()
  if (!isGenericProfileName(dbName)) return profileRow
  const patch = buildProfilePatchFromSignupMetadata(authUser.user_metadata || {})
  if (!patch) return profileRow
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', authUser.id)
    .select()
    .single()
  if (error) {
    console.warn('profiles sync from user_metadata:', error.message)
    return profileRow
  }
  return data || profileRow
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

  const loadProfile = useCallback((authUser) => {
    const userId = authUser?.id
    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    const id = ++profileReqId.current
    setProfileLoading(true)
    Promise.race([
      fetchProfileQuery(userId),
      new Promise((resolve) => setTimeout(() => resolve(null), PROFILE_TIMEOUT_MS)),
    ])
      .then(async (p) => {
        if (profileReqId.current !== id) return
        let next = p
        if (p && authUser) {
          try {
            next = await syncProfileFromAuthMetadata(authUser, p)
          } catch (e) {
            console.warn('profile metadata sync:', e?.message || e)
          }
        }
        setProfile(next)
      })
      .finally(() => {
        if (profileReqId.current !== id) return
        setProfileLoading(false)
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
      const row = {
        id: data.user.id,
        email: email,
        name: metadata.full_name || 'Ny spiller',
        full_name: metadata.full_name || 'Ny spiller',
        level: metadata.level || 5,
        play_style: metadata.play_style || 'Ved ikke endnu',
        area: metadata.area || DEFAULT_PROFILE_REGION,
        availability: metadata.availability || [],
        bio: metadata.bio || '',
        avatar: metadata.avatar || '🎾',
        birth_year: metadata.birth_year ?? null,
      }
      const { error: upErr } = await supabase.from('profiles').upsert(row)
      if (upErr) console.warn('profiles upsert:', upErr.message)
      if (data.session) {
        setSession(data.session)
        setUser(data.user)
        let p = await Promise.race([
          fetchProfileQuery(data.user.id),
          new Promise((r) => setTimeout(() => r(null), PROFILE_TIMEOUT_MS)),
        ])
        if (p) {
          try {
            p = await syncProfileFromAuthMetadata(data.user, p)
          } catch (e) {
            console.warn('profile metadata sync:', e?.message || e)
          }
        }
        setProfile(p)
        setProfileLoading(false)
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
      let p = await Promise.race([
        fetchProfileQuery(data.user.id),
        new Promise((r) => setTimeout(() => r(null), PROFILE_TIMEOUT_MS)),
      ])
      if (p) {
        try {
          p = await syncProfileFromAuthMetadata(data.user, p)
        } catch (e) {
          console.warn('profile metadata sync:', e?.message || e)
        }
      }
      setProfile(p)
      setProfileLoading(false)
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

  const refreshProfile = () => {
    if (user) loadProfile(user)
  }

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
