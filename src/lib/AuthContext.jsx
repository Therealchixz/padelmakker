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
        .maybeSingle()
      if (error) {
        console.error('Profile fetch error:', error)
        return null
      }
      setProfile(data)
      return data
    } catch (e) {
      console.error('Profile fetch exception:', e)
      setProfile(null)
      return null
    }
  }

useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) {
          await fetchProfile(s.user.id)
        }
      } catch (e) {
        console.error('Auth init error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth loading timeout - forcing load complete')
        setLoading(false)
      }
    }, 3000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mounted) return
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) {
          await fetchProfile(s.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      mounted = false
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
      try {
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
          elo_rating: metadata.elo_rating || 1000,
          games_played: 0,
          games_won: 0,
        })
      } catch (e) {
        console.error('Profile upsert error:', e)
      }

      if (data.session) {
        setSession(data.session)
        setUser(data.user)
        await fetchProfile(data.user.id)
      }
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
      setSession(data.session)
      setUser(data.user)
      await fetchProfile(data.user.id)
    }
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
