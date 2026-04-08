import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { normalizeProfileRow } from './profileUtils'

const AuthContext = createContext(null)

const SESSION_TIMEOUT_MS = 12000
const PROFILE_TIMEOUT_MS = 12000

/** Trigger/default-rækker sætter ofte "Ny spiller" før app-metadata når email skal bekræftes først. */
function isGenericProfileName(s) {
  if (s == null || String(s).trim() === '') return true
  const t = String(s).trim().toLowerCase()
  return t === 'ny spiller' || t === 'ny' || t === 'spiller'
}

function safeNameFromAuthUser(userRow) {
  const meta = userRow?.user_metadata || {}
  let s = String(meta.full_name || meta.name || '').trim()
  if (!s || isGenericProfileName(s)) {
    const em = userRow?.email
    s = em ? String(em).split('@')[0].trim() : ''
  }
  if (!s) return null
  return s.replace(/</g, '').replace(/>/g, '').slice(0, 120)
}

async function syncProfileNameFromAuthIfNeeded(p, userRow) {
  if (!p?.id || !userRow) return p
  const dbName = String(p.full_name || p.name || '').trim()
  if (dbName && !isGenericProfileName(dbName)) return p
  const newName = safeNameFromAuthUser(userRow)
  if (!newName) return p
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: newName, name: newName })
    .eq('id', p.id)
    .select()
    .single()
  if (error) {
    console.warn('profiles name sync:', error.message)
    return p
  }
  return normalizeProfileRow(data)
}

function fetchProfileQuery(userId) {
  return supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) console.warn('profiles:', error.message)
      return normalizeProfileRow(data || null)
    })
    .catch(() => null)
}

/** Eksisterende profil eller minimal upsert (auth uden profiles-række → ellers hvid dashboard). */
async function fetchOrCreateProfile(userRow) {
  if (!userRow?.id) return null
  let p = await fetchProfileQuery(userRow.id)
  if (p) {
    p = await syncProfileNameFromAuthIfNeeded(p, userRow)
    return p
  }
  const meta = userRow.user_metadata || {}
  const email = userRow.email || ''
  const regionFromMeta =
    meta.region || meta.area || meta.city || 'Region Hovedstaden'
  const { data: row, error } = await supabase.from('profiles').upsert(
    {
      id: userRow.id,
      email: email || '',
      name: meta.full_name || meta.name || (email ? email.split('@')[0] : null) || 'Spiller',
      full_name: meta.full_name || meta.name || (email ? email.split('@')[0] : null) || 'Spiller',
      level: meta.level || 5,
      play_style: meta.play_style || 'Ved ikke endnu',
      area: regionFromMeta,
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
  return normalizeProfileRow(row || null)
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
      const displayName =
        (metadata.full_name && String(metadata.full_name).trim()) ||
        (metadata.name && String(metadata.name).trim()) ||
        email.trim().split('@')[0] ||
        'Spiller'
      const region =
        metadata.region || metadata.area || metadata.city || 'Region Hovedstaden'
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: email,
        name: displayName,
        full_name: displayName,
        level: metadata.level || 5,
        play_style: metadata.play_style || 'Ved ikke endnu',
        area: region,
        availability: metadata.availability || [],
        bio: metadata.bio || '',
        avatar: metadata.avatar || '🎾',
        birth_year: metadata.birth_year ?? null,
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
    const row = normalizeProfileRow(data)
    setProfile(row)
    return row
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
