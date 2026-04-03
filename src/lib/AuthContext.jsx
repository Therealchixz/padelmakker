import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      setProfile(data)
      return data
    } catch {
      setProfile(null)
      return null
    }
  }

  const fetchProfileWithRetry = async (userId, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      const result = await fetchProfile(userId)
      if (result) return result
      await new Promise(r => setTimeout(r, 1000))
    }
    return null
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        fetchProfileWithRetry(s.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) {
          if (event === 'SIGNED_IN') {
            await fetchProfileWithRetry(s.user.id)
          } else {
            await fetchProfile(s.user.id)
          }
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    })
    if (error) throw error

    if (data.user && data.session) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: email,
          name: metadata.full_name || metadata.name || 'Ny spiller',
          full_name: metadata.full_name || metadata.name || 'Ny spiller',
          level: metadata.level || 5,
          play_style: metadata.play_style || 'Ved ikke endnu',
          area: metadata.area || 'København',
          availability: metadata.availability || [],
          bio: metadata.bio || '',
          avatar: metadata.avatar || '🎾',
          elo_rating: metadata.elo_rating || 1000,
          games_played: 0,
          games_won: 0,
        })
      if (profileError) console.error('Profile creation error:', profileError)
      await fetchProfileWithRetry(data.user.id)
      setUser(data.user)
      setSession(data.session)
    }

    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    if (data.user) {
      await fetchProfileWithRetry(data.user.id)
    }
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setSession(null)
    setUser(null)
    setProfile(null)
  }

  const updateProfile = async (updates) => {
    if (!user) throw new Error('Not authenticated')
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (error) throw error
    setProfile(data)
    return data
  }

  const value = {
    session,
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile: () => user && fetchProfile(user.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
