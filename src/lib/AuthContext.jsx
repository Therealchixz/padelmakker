import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { normalizeProfileRow, buildOnboardingProfileRowPatch } from './profileUtils'
import { applyPendingAvatar } from './avatarUpload'
import { DEFAULT_REGION } from './platformConstants'
import { BanNoticeModal } from '../components/BanNoticeModal'

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

async function applyPendingAvatarToProfile(userRow, currentProfile) {
  if (!userRow?.id) return currentProfile
  const url = await applyPendingAvatar(userRow.id, userRow.email)
  if (!url) return currentProfile
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({ avatar: url })
    .eq('id', userRow.id)
    .select()
    .single()
  if (error) {
    console.warn('pending avatar → profiles:', error.message)
    return currentProfile
  }
  const row = normalizeProfileRow(updated)
  /* Sæt ikke onboarding_applied_to_profile her — ellers springes onboarding-merge over. */
  const { error: metaErr } = await supabase.auth.updateUser({ data: { avatar: url } })
  if (metaErr) console.warn('pending avatar → auth metadata:', metaErr.message)
  return row
}

/**
 * Hent/merge profil uden pending storage-upload — så Promise.race-timeout ikke afbryder upload.
 */
async function fetchOrCreateProfileCore(userRow) {
  if (!userRow?.id) return null
  let p = await fetchProfileQuery(userRow.id)
  if (p) {
    p = await syncProfileNameFromAuthIfNeeded(p, userRow)
    const obPatch = buildOnboardingProfileRowPatch(userRow.user_metadata || {}, p)
    if (obPatch && userRow.id) {
      const { data: merged, error: obErr } = await supabase
        .from('profiles')
        .update(obPatch)
        .eq('id', userRow.id)
        .select()
        .single()
      if (!obErr && merged) {
        p = normalizeProfileRow(merged)
        const { error: metaErr } = await supabase.auth.updateUser({
          data: { onboarding_applied_to_profile: true },
        })
        if (metaErr) console.warn('auth metadata onboarding flag:', metaErr.message)
      } else if (obErr) {
        console.warn('onboarding → profiles merge:', obErr.message)
      }
    }
    return p
  }
  const meta = userRow.user_metadata || {}
  const email = userRow.email || ''
  const regionFromMeta =
    meta.region || meta.area || meta.city || DEFAULT_REGION
  const { data: row, error } = await supabase.from('profiles').upsert(
    {
      id: userRow.id,
      email: email || '',
      name: meta.full_name || meta.name || (email ? email.split('@')[0] : null) || 'Spiller',
      full_name: meta.full_name || meta.name || (email ? email.split('@')[0] : null) || 'Spiller',
      level: meta.level || 5,
      play_style: meta.play_style || 'Ved ikke endnu',
      area: regionFromMeta,
      city: meta.city || null,
      availability: meta.availability || [],
      bio: meta.bio || '',
      avatar: meta.avatar || '🎾',
      birth_year: meta.birth_year ?? null,
      birth_month: meta.birth_month ?? null,
      birth_day: meta.birth_day ?? null,
      court_side: meta.court_side ?? null,
      intent_now: meta.intent_now || null,
      seeking_match: meta.seeking_match === true,
      travel_willing: meta.travel_willing === true,
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
  const [banNotice, setBanNotice] = useState(null)
  const profileReqId = useRef(0)
  /** Til pending-avatar merge: undgå at sætte profil efter logout når core-load timeout gav prev=null */
  const activeUserIdRef = useRef('')
  /** Forhindrer dobbelt signOut() fra loadProfile + realtime-lytter */
  const signingOutRef = useRef(false)

  /**
   * Opdater last_active_at for brugeren — fire-and-forget.
   * Læser aktivt user-id via ref, så funktionen er stabil og ikke trigger
   * re-mount af effekter som har den i dependency array.
   */
  const touchLastActive = useCallback(async (userId) => {
    const uid = userId || activeUserIdRef.current
    if (!uid) return
    try {
      await supabase
        .from('profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', uid)
    } catch {
      /* ignorer — kritisk ikke for UX */
    }
  }, [])

  const loadProfile = useCallback((userRow, opts = {}) => {
    const quiet = opts.quiet === true
    const id = ++profileReqId.current
    const uid = userRow?.id != null ? String(userRow.id) : ''
    if (!userRow?.id) {
      setProfile(null)
      if (!quiet) setProfileLoading(false)
      return
    }
    if (!quiet) setProfileLoading(true)
    Promise.race([
      fetchOrCreateProfileCore(userRow),
      new Promise((resolve) => setTimeout(() => resolve(null), PROFILE_TIMEOUT_MS)),
    ])
      .then((p) => {
        if (profileReqId.current !== id) return;

        // Tjek for ban-status — vis modal i stedet for blokerende alert()
        if (p?.is_banned) {
          if (signingOutRef.current) return
          signingOutRef.current = true
          setBanNotice({ reason: p.ban_reason || '' })
          return;
        }

        setProfile(p)

        // Auto-expire seeking_match after 24h from activation
        if (p?.seeking_match && p?.seeking_match_at) {
          const age = Date.now() - new Date(p.seeking_match_at).getTime();
          if (age >= 24 * 60 * 60 * 1000) {
            supabase.from('profiles')
              .update({ seeking_match: false, seeking_match_at: null })
              .eq('id', p.id)
              .then(({ data }) => {
                if (data?.[0]) setProfile(normalizeProfileRow(data[0]));
              })
              .catch(() => {});
          }
        }

        /**
         * Pending storage-upload kan tage lang tid. TOKEN_REFRESHED udløser ofte et nyt loadProfile
         * med et nyt profileReqId — må ikke afvise setProfile når upload først færdiggøres bagefter
         * (så ville pending være slettet men UI stadig vise emoji).
         * Merge med funktionel setProfile + bruger-id-tjek i stedet for profileReqId.
         */
        void applyPendingAvatarToProfile(userRow, p).then((withAvatar) => {
          if (!withAvatar || !uid) return
          setProfile((prev) => {
            if (String(withAvatar.id) !== uid) return prev
            if (prev != null && String(prev.id) !== uid) return prev
            /* Core-load timeout → prev null; kun sæt hvis samme bruger stadig er aktiv */
            if (prev == null) {
              if (activeUserIdRef.current !== uid) return prev
              return withAvatar
            }
            if (String(withAvatar.avatar || '') === String(prev.avatar || '')) return prev
            return withAvatar
          })
        })
      })
      .finally(() => {
        if (profileReqId.current !== id) return
        if (!quiet) setProfileLoading(false)
      })
  }, [])

  /**
   * Init + auth-state-listener: kører kun én gang ved mount.
   * Tidligere lå ban-realtime-subscription i samme effekt med user?.id i deps,
   * hvilket re-initialiserede session/listener/visibilitychange ved hvert auth-skift.
   */
  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.error(
        'Supabase mangler: sæt VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY (fx i Vercel / .env.local)'
      )
      setLoading(false)
      return undefined
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
      (event, s) => {
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) {
          // TOKEN_REFRESHED sker ofte når fanen bliver aktiv igen — uden quiet bliver
          // profileLoading true og hele appen erstattes af spinner (blink).
          const quietRefresh = event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED'
          loadProfile(s.user, { quiet: quietRefresh })
          if (event === 'SIGNED_IN') void touchLastActive(s.user.id)
        } else {
          profileReqId.current += 1
          setProfile(null)
          setProfileLoading(false)
        }
      }
    )

    // Touch last_active_at når brugeren kommer tilbage til appen
    let lastTouch = 0
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastTouch < 5 * 60 * 1000) return // maks. ét kald pr. 5 min
      lastTouch = now
      void touchLastActive()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [loadProfile, touchLastActive])

  /**
   * Realtids-overvågning af ban-status — kører kun når user?.id ændres.
   * Bruger setBanNotice (i stedet for alert) for ikke at blokere UI-tråden.
   */
  useEffect(() => {
    if (!user?.id) return undefined
    const channel = supabase
      .channel(`profile-status-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          if (payload.new?.is_banned) {
            if (signingOutRef.current) return
            signingOutRef.current = true
            setBanNotice({ reason: payload.new.ban_reason || '' })
          }
        }
      )
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch { /* ignore */ }
    }
  }, [user?.id])

  useEffect(() => {
    activeUserIdRef.current = user?.id != null ? String(user.id) : ''
  }, [user?.id])

  const signUp = async (email, password, metadata = {}, captchaToken = '') => {
    if (!isSupabaseConfigured) throw new Error('Supabase er ikke konfigureret')
    const token = typeof captchaToken === 'string' ? captchaToken.trim() : ''
    const options = { data: metadata }
    if (token) options.captchaToken = token
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options,
    })
    if (error) throw error
    if (data.user) {
      const displayName =
        (metadata.full_name && String(metadata.full_name).trim()) ||
        (metadata.name && String(metadata.name).trim()) ||
        email.trim().split('@')[0] ||
        'Spiller'
      const region =
        metadata.region || metadata.area || metadata.city || DEFAULT_REGION
      const { error: upErr } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: email,
        name: displayName,
        full_name: displayName,
        level: metadata.level || 5,
        play_style: metadata.play_style || 'Ved ikke endnu',
        area: region,
        city: metadata.city || null,
        availability: metadata.availability || [],
        bio: metadata.bio || '',
        avatar: metadata.avatar || '🎾',
        birth_year: metadata.birth_year ?? null,
        birth_month: metadata.birth_month ?? null,
        birth_day: metadata.birth_day ?? null,
        court_side: metadata.court_side ?? null,
        intent_now: metadata.intent_now || null,
        seeking_match: metadata.seeking_match === true,
        travel_willing: metadata.travel_willing === true,
      })
      if (upErr) console.warn('profiles upsert:', upErr.message)
      if (data.session) {
        setSession(data.session)
        setUser(data.user)
        loadProfile(data.user)
      }
    }
    return data
  }

  const signIn = async (email, password, captchaToken = '') => {
    if (!isSupabaseConfigured) throw new Error('Supabase er ikke konfigureret')
    const token = typeof captchaToken === 'string' ? captchaToken.trim() : ''
    const payload = { email, password }
    if (token) payload.options = { captchaToken: token }
    const { data, error } = await supabase.auth.signInWithPassword(payload)
    if (error) throw error
    if (data.user) {
      setSession(data.session)
      setUser(data.user)
      loadProfile(data.user)
      void touchLastActive(data.user.id)
    }
    return data
  }

  const signOut = async () => {
    profileReqId.current += 1
    signingOutRef.current = false
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
    const meta = { ...(user.user_metadata || {}) }
    let metaChanged = false
    if ('area' in updates && updates.area != null) {
      meta.area = updates.area
      metaChanged = true
    }
    if ('court_side' in updates) {
      meta.court_side = updates.court_side
      metaChanged = true
    }
    if ('birth_year' in updates) {
      meta.birth_year = updates.birth_year
      metaChanged = true
    }
    if ('birth_month' in updates) {
      meta.birth_month = updates.birth_month
      metaChanged = true
    }
    if ('birth_day' in updates) {
      meta.birth_day = updates.birth_day
      metaChanged = true
    }
    if ('availability' in updates && updates.availability != null) {
      meta.availability = updates.availability
      metaChanged = true
    }
    if ('play_style' in updates && updates.play_style != null) {
      meta.play_style = updates.play_style
      metaChanged = true
    }
    if ('full_name' in updates && updates.full_name != null) {
      meta.full_name = updates.full_name
      metaChanged = true
    }
    if ('avatar' in updates && updates.avatar != null) {
      meta.avatar = updates.avatar
      metaChanged = true
    }
    if (metaChanged) {
      const { data: authData, error: metaErr } = await supabase.auth.updateUser({ data: meta })
      if (!metaErr && authData?.user) setUser(authData.user)
      else if (metaErr) console.warn('sync profile → auth metadata:', metaErr.message)
    }
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
        touchLastActive,
      }}
    >
      {children}
      {banNotice && (
        <BanNoticeModal
          reason={banNotice.reason}
          onAcknowledge={async () => {
            setBanNotice(null)
            try { await signOut() } catch { /* ignorer — vi prøver at logge ud */ }
          }}
        />
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
