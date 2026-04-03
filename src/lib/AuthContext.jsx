import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  const fetchProfile = async (userId) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      return data || null
    } catch {
      return null
    }
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) {
          const p = await fetchProfile(s.user.id)
          setProfile(p)
        } else {
          setProfile(null)
        }
        setLoading(false)
        initialized.current = true
      }
    )

    // Safety: if onAuthStateChange never fires within 3s, stop loading
    const timeout = setTimeout(() => {
      if (!initialized.current) setLoading(false)
    }, 3000)

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email, password, metadata = {}) => {
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
        elo_rating: 1000,
        games_played: 0,
        games_won: 0,
      })
    }
    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
  }

  const updateProfile = async (updates) => {
    if (!user) throw new Error('Not authenticated')
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single()
    if (error) throw error
    setProfile(data)
    return data
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signUp, signIn, signOut, updateProfile, refreshProfile: () => user && fetchProfile(user.id).then(setProfile) }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
