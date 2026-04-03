import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) console.error('Profile fetch error:', error);
      return data || null;
    } catch (e) {
      console.error('Profile fetch exception:', e);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    // Initial load
    const initAuth = async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          const p = await fetchProfile(s.user.id);
          setProfile(p);
        }
      } catch (e) {
        console.error('Auth init error:', e);
      } finally {
        if (mounted) setLoading(false);   // <--- VIGTIG: altid sæt loading false
      }
    };

    initAuth();

    // Listen for changes (login, logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mounted) return;
        
        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          const p = await fetchProfile(s.user.id);
          setProfile(p);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const value = {
    session,
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile: async (updates) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      setProfile(data);
      return data;
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
