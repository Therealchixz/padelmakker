import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { useConfirm } from '../../lib/ConfirmDialogProvider'
import { Court } from '../../api/base44Client'
import { CreateAmericanoTournamentForm } from './CreateAmericanoTournamentForm'
import { AmericanoResultsPanel } from './AmericanoResultsPanel'
import { AmericanoListCard } from './AmericanoListCard'
import { AmericanoDetailSheet, type AmericanoDetailPlayer } from './AmericanoDetailSheet'
import {
  computeAmericanoActiveRound,
  resolveAmericanoCourtName,
} from './americanoDisplayUtils'
import { computeAmericanoPlayedDurationMinutes } from '../../lib/americanoPlayedDuration.js'
import { buildMexicanoStartRoundRows, isMexicanoFormat } from '../../lib/mexicanoSchedule.js'
import { buildAmericanoRoundRobinMatchRows } from '../../lib/americanoRoundRobinSchedule'
import type { AmericanoTournament, AmericanoParticipant } from './types'
import { formatMatchDateDa, formatTimeSlotDa } from '../../lib/matchDisplayUtils'
import { PillTabs } from '../../components/PillTabs'
import { btn, theme } from '../../lib/platformTheme'
import { notifyAmericanoTournamentFull } from '../../lib/notifyKampeEntityFull'
import { notifyAmericanoTournamentStarted } from '../../lib/notifyKampeEntityStarted'
import { notifyAmericanoSpotOpened } from '../../lib/notifyKampeEntityRoster'
import {
  TOURNAMENT_EMPTY,
  TOURNAMENT_LOAD_ERROR_TITLE,
  TOURNAMENT_LOAD_ERROR_TOAST,
  TOURNAMENT_LOADING,
  TOURNAMENT_LOGIN_REQUIRED,
  TOURNAMENT_SECTION_LABEL,
} from '../../lib/tournamentCopy'
import { useScrollIntoViewWhen } from '../../lib/useScrollIntoViewWhen'
import { PlayerStatsModal } from '../../components/PlayerStatsModal'
import { tournamentPassesKampeRegionFilter } from '../../lib/kampeListFilterCore'

const font = 'var(--pm-font)'

type ProfileLike = {
  id: string
  full_name?: string | null
  name?: string | null
  email?: string | null
  role?: string | null
}

type AmericanoSubTab = 'open' | 'playing' | 'completed'

type Props = {
  profile?: ProfileLike | null
  showToast: (msg: string) => void
  /** Gendan underfane efter tab/fokus/genindlæsning i samme session */
  initialSubTab?: AmericanoSubTab
  onAmericanoSubTabChange?: (tab: AmericanoSubTab) => void
  /** Indlejret under Kampe — skjul egen top-række; "Opret turnering" styres udefra */
  embedInKampe?: boolean
  /** Kampe-fanen er aktiv (til notifikations-deep-link) */
  tabActive?: boolean
  /** Scroll til denne turnering (fra notifikation) */
  focusTournamentId?: string | null
  onFocusTournamentHandled?: () => void
  /** Styret opret-formular (sammen med onCreateOpenChange) */
  createOpen?: boolean
  onCreateOpenChange?: (open: boolean) => void
  /** Filtrering fra overordnet Kampe-fane */
  scope?: 'mine' | 'alle'
  searchQuery?: string
  listRegionFilter?: string
  onFilteredCountChange?: (count: number) => void
}

type ParticipantListRow = {
  id: string
  tournament_id: string
  user_id: string
  display_name: string
  joined_at: string
}

type ProfileSnippet = {
  avatar?: string | null
  full_name?: string | null
  name?: string | null
  americano_elo_rating?: number | null
}

function resolveName(p: ProfileLike | null | undefined, authEmail?: string | null) {
  if (!p) {
    if (authEmail) return authEmail.split('@')[0]
    return 'Spiller'
  }
  const n = (p.full_name || p.name || '').trim()
  if (n) return n
  if (authEmail) return authEmail.split('@')[0]
  return 'Spiller'
}

export function AmericanoTab({
  profile,
  showToast,
  initialSubTab,
  onAmericanoSubTabChange,
  embedInKampe,
  tabActive = true,
  createOpen,
  onCreateOpenChange,
  scope = 'mine',
  searchQuery = '',
  listRegionFilter = '',
  onFilteredCountChange,
  focusTournamentId = null,
  onFocusTournamentHandled,
}: Props) {
  const { user: authUser, refreshProfileQuiet } = useAuth()
  const ask = useConfirm()
  const authEmail =
    authUser && typeof authUser === 'object' && 'email' in authUser
      ? String((authUser as { email?: string }).email || '')
      : ''
  const authUserId =
    authUser && typeof authUser === 'object' && 'id' in authUser
      ? String((authUser as { id?: string }).id || '')
      : ''
  const profileId = profile?.id ?? authUserId
  const isAdmin = profile?.role === 'admin'
  const displayName = resolveName(profile, authEmail || null)
  const [courts, setCourts] = useState<{ id: string; name: string }[]>([])
  const [rows, setRows] = useState<AmericanoTournament[]>([])
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [createOpenInternal, setCreateOpenInternal] = useState(false)
  const createControlled = typeof createOpen === 'boolean'
  const showCreate = createControlled ? createOpen : createOpenInternal
  const setShowCreate = (open: boolean) => {
    onCreateOpenChange?.(open)
    if (!createControlled) setCreateOpenInternal(open)
  }
  const createFormRef = useRef<HTMLDivElement>(null)
  useScrollIntoViewWhen(showCreate, createFormRef, { block: 'start' })

  useEffect(() => {
    if (showCreate) setAmericanoHelpOpen(false)
  }, [showCreate])

  const [busyId, setBusyId] = useState<string | null>(null)
  const [americanoView, setAmericanoView] = useState<AmericanoSubTab>(() => initialSubTab ?? 'open')
  const [detailTournamentId, setDetailTournamentId] = useState<string | null>(null)
  const [listMeta, setListMeta] = useState<{
    myEloChange: Record<string, number>
    liveRound: Record<string, number>
    playedDurationMinutes: Record<string, number>
  }>({ myEloChange: {}, liveRound: {}, playedDurationMinutes: {} })
  const [completedDetailCache, setCompletedDetailCache] = useState<
    Record<
      string,
      {
        pointsByUserId: Record<string, number>
        eloByUserId: Record<string, { change: number }>
        playedDurationMinutes: number | null
      }
    >
  >({})
  const [participantsByTournament, setParticipantsByTournament] = useState<
    Record<string, ParticipantListRow[]>
  >({})
  const [openManageTools, setOpenManageTools] = useState<Set<string>>(() => new Set())
  const [participantSnippets, setParticipantSnippets] = useState<Record<string, ProfileSnippet>>({})
  const [creatorAreasByUserId, setCreatorAreasByUserId] = useState<Record<string, string>>({})
  const [participantStatsPick, setParticipantStatsPick] = useState<{
    userId: string
    name: string
    avatar?: string | null
  } | null>(null)

  const openParticipantProfile = useCallback((userId: string, displayName: string) => {
    const snap = participantSnippets[userId]
    const name = String(snap?.full_name || snap?.name || displayName).trim() || displayName
    setParticipantStatsPick({
      userId,
      name,
      avatar: snap?.avatar ?? null,
    })
  }, [participantSnippets])
  const [americanoHelpOpen, setAmericanoHelpOpen] = useState<boolean>(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      if (!profileId) {
        setCourts([])
        setRows([])
        setJoinedIds(new Set())
        setParticipantsByTournament({})
        return
      }
      const [cd, trRes, myRes] = await Promise.all([
        Court.filter(),
        supabase.from('americano_tournaments').select('*').order('tournament_date', { ascending: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('americano_participants').select('tournament_id').eq('user_id', profileId),
      ])
      setCourts(
        (cd || []).map((c: { id: string; name?: string | null }) => ({
          id: c.id,
          name: c.name || 'Bane',
        }))
      )
      if (trRes.error) throw trRes.error
      const tournamentList: AmericanoTournament[] = (trRes.data || []) as AmericanoTournament[]
      setRows(tournamentList)

      const creatorIds = [...new Set(tournamentList.map((t) => t.creator_id).filter(Boolean))]
      if (creatorIds.length > 0) {
        const { data: creatorProfiles } = await supabase
          .from('profiles')
          .select('id, area')
          .in('id', creatorIds)
        const areaMap: Record<string, string> = {}
        ;(creatorProfiles || []).forEach((p: { id: string; area?: string | null }) => {
          areaMap[String(p.id)] = String(p.area || '')
        })
        setCreatorAreasByUserId(areaMap)
      } else {
        setCreatorAreasByUserId({})
      }
      if (!myRes.error && myRes.data) {
        setJoinedIds(new Set(myRes.data.map((r: { tournament_id: string }) => r.tournament_id)))
      } else {
        setJoinedIds(new Set())
      }

      const tids = tournamentList.map((t) => t.id)
      if (tids.length === 0) {
        setParticipantsByTournament({})
      } else {
        const { data: allParts, error: partErr } = await supabase
          .from('americano_participants')
          .select('id, tournament_id, user_id, display_name, joined_at')
          .in('tournament_id', tids)
        if (partErr) {
          console.warn('americano_participants list:', partErr.message)
          setParticipantsByTournament({})
        } else {
          const grouped: Record<string, ParticipantListRow[]> = {}
          ;(allParts || []).forEach((raw: Record<string, unknown>) => {
            const tid = String(raw.tournament_id)
            const row: ParticipantListRow = {
              id: String(raw.id),
              tournament_id: tid,
              user_id: String(raw.user_id),
              display_name: String(raw.display_name || 'Spiller').trim() || 'Spiller',
              joined_at: String(raw.joined_at || ''),
            }
            if (!grouped[tid]) grouped[tid] = []
            grouped[tid].push(row)
          })
          Object.keys(grouped).forEach((tid) => {
            grouped[tid].sort((a, b) => {
              const c = a.joined_at.localeCompare(b.joined_at)
              if (c !== 0) return c
              return String(a.id).localeCompare(String(b.id))
            })
          })
          setParticipantsByTournament(grouped)
        }
      }
    } catch (e) {
      console.warn(e)
      setLoadError(`${TOURNAMENT_LOAD_ERROR_TITLE} lige nu.`)
      showToast(TOURNAMENT_LOAD_ERROR_TOAST)
      setRows([])
      setParticipantsByTournament({})
    } finally {
      setLoading(false)
    }
  }, [profileId, showToast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (initialSubTab === 'open' || initialSubTab === 'playing' || initialSubTab === 'completed') {
      setAmericanoView(initialSubTab)
    }
  }, [initialSubTab])

  useEffect(() => {
    const tid = focusTournamentId
    if (!tid || !tabActive || loading) return
    const t = rows.find((x) => String(x.id) === String(tid))
    if (!t) {
      onFocusTournamentHandled?.()
      return
    }
    const st = String(t.status || '').toLowerCase()
    if (st === 'registration') setAmericanoView('open')
    else if (st === 'playing') setAmericanoView('playing')
    else setAmericanoView('completed')
    setDetailTournamentId(t.id)
    onFocusTournamentHandled?.()
  }, [focusTournamentId, tabActive, loading, rows, onFocusTournamentHandled])

  useEffect(() => {
    const uidSet = new Set<string>()
    for (const t of rows) {
      /* Completed inkluderet for at vise avatar på podium */
      if (t.status !== 'playing' && t.status !== 'registration' && t.status !== 'completed') continue
      for (const p of participantsByTournament[t.id] || []) {
        uidSet.add(p.user_id)
      }
    }
    if (uidSet.size === 0) {
      setParticipantSnippets({})
      return
    }
    const idList = [...uidSet]
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, avatar, full_name, name, americano_elo_rating')
        .in('id', idList)
      if (cancelled) return
      if (error) {
        console.warn('americano participant profiles:', error.message)
        if (!cancelled) setParticipantSnippets({})
        return
      }
      const next: Record<string, ProfileSnippet> = {}
      ;(data || []).forEach((r: { id: string; avatar?: string | null; full_name?: string | null; name?: string | null; americano_elo_rating?: number | null }) => {
        next[String(r.id)] = {
          avatar: r.avatar,
          full_name: r.full_name,
          name: r.name,
          americano_elo_rating: r.americano_elo_rating,
        }
      })
      setParticipantSnippets(next)
    })()
    return () => {
      cancelled = true
    }
  }, [rows, participantsByTournament])

  useEffect(() => {
    if (!profileId || loading) return

    const matchesScope = (t: AmericanoTournament) => {
      if (scope === 'mine' && !joinedIds.has(t.id)) return false
      if (listRegionFilter) {
        const creatorArea = creatorAreasByUserId[String(t.creator_id)] || ''
        const courtName = resolveAmericanoCourtName(t.court_id, courts)
        if (!tournamentPassesKampeRegionFilter(t, listRegionFilter, creatorArea, courtName)) return false
      }
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if ((t.name || '').toLowerCase().includes(q)) return true
        const parts = participantsByTournament[t.id] || []
        return parts.some((p) => (p.display_name || '').toLowerCase().includes(q))
      }
      return true
    }

    const filtered = rows.filter(matchesScope)
    const viewRows =
      americanoView === 'open'
        ? filtered.filter((t) => t.status === 'registration')
        : americanoView === 'playing'
          ? filtered.filter((t) => t.status === 'playing')
          : filtered.filter((t) => t.status === 'completed')

    const completedJoined = viewRows.filter((t) => t.status === 'completed' && joinedIds.has(t.id))
    const completedInView = viewRows.filter((t) => t.status === 'completed')
    const playing = viewRows.filter((t) => t.status === 'playing')

    if (completedInView.length === 0 && playing.length === 0) {
      setListMeta({ myEloChange: {}, liveRound: {}, playedDurationMinutes: {} })
      return undefined
    }

    let cancelled = false
    ;(async () => {
      const myEloChange: Record<string, number> = {}
      const liveRound: Record<string, number> = {}
      const playedDurationMinutes: Record<string, number> = {}

      if (completedJoined.length > 0) {
        const tids = completedJoined.map((t) => t.id)
        const { data } = await supabase
          .from('americano_elo_history')
          .select('tournament_id, change')
          .in('tournament_id', tids)
          .eq('user_id', profileId)
        ;(data || []).forEach((row: { tournament_id: string; change: number | null }) => {
          myEloChange[String(row.tournament_id)] = Number(row.change) || 0
        })
      }

      if (completedInView.length > 0) {
        const tids = completedInView.map((t) => t.id)
        const { data: matchRows } = await supabase
          .from('americano_matches')
          .select(
            'tournament_id, created_at, updated_at, team_a_score, team_b_score, results_locked',
          )
          .in('tournament_id', tids)
        const byTournament: Record<string, typeof matchRows> = {}
        ;(matchRows || []).forEach((m) => {
          const tid = String(m.tournament_id)
          if (!byTournament[tid]) byTournament[tid] = []
          byTournament[tid].push(m)
        })
        completedInView.forEach((t) => {
          const mins = computeAmericanoPlayedDurationMinutes(t, byTournament[t.id] || [])
          if (mins != null) playedDurationMinutes[t.id] = mins
        })
      }

      if (playing.length > 0) {
        const tids = playing.map((t) => t.id)
        const { data } = await supabase
          .from('americano_matches')
          .select('tournament_id, round_number, team_a_score, team_b_score, results_locked')
          .in('tournament_id', tids)
        const byTournament: Record<
          string,
          {
            round_number: number
            team_a_score: number | null
            team_b_score: number | null
            results_locked?: boolean | null
          }[]
        > = {}
        ;(data || []).forEach((m) => {
          const tid = String(m.tournament_id)
          if (!byTournament[tid]) byTournament[tid] = []
          byTournament[tid].push(m)
        })
        playing.forEach((t) => {
          const round = computeAmericanoActiveRound(byTournament[t.id] || [])
          if (round != null) liveRound[t.id] = round
        })
      }

      if (!cancelled) setListMeta({ myEloChange, liveRound, playedDurationMinutes })
    })()

    return () => {
      cancelled = true
    }
  }, [rows, joinedIds, profileId, loading, americanoView, scope, searchQuery, participantsByTournament, listRegionFilter, creatorAreasByUserId])

  useEffect(() => {
    if (!detailTournamentId || !profileId) return undefined
    const t = rows.find((x) => x.id === detailTournamentId)
    if (!t || t.status !== 'completed') return undefined
    if (completedDetailCache[detailTournamentId]) return undefined

    let cancelled = false
    ;(async () => {
      const ppm = Number(t.points_per_match)
      const P = ppm === 16 || ppm === 24 || ppm === 32 ? ppm : 16
      const parts = participantsByTournament[t.id] || []
      const partIdToUser = new Map(parts.map((p) => [p.id, p.user_id]))
      const [matchesRes, eloRes] = await Promise.all([
        supabase.from('americano_matches').select('*').eq('tournament_id', t.id),
        supabase.from('americano_elo_history').select('user_id, change').eq('tournament_id', t.id),
      ])
      if (cancelled) return
      const pointsByUserId: Record<string, number> = {}
      parts.forEach((p) => {
        pointsByUserId[p.user_id] = 0
      })
      ;(matchesRes.data || []).forEach((m) => {
        if (m.team_a_score == null || m.team_b_score == null) return
        const a = m.team_a_score
        const b = m.team_b_score
        if (a + b !== P) return
        const add = (partId: string, pts: number) => {
          const uid = partIdToUser.get(partId)
          if (uid) pointsByUserId[uid] = (pointsByUserId[uid] ?? 0) + pts
        }
        add(m.team_a_p1, a)
        add(m.team_a_p2, a)
        add(m.team_b_p1, b)
        add(m.team_b_p2, b)
      })
      const eloByUserId: Record<string, { change: number }> = {}
      ;(eloRes.data || []).forEach((row: { user_id: string; change: number | null }) => {
        eloByUserId[String(row.user_id)] = { change: Number(row.change) || 0 }
      })
      const playedDurationMinutes = computeAmericanoPlayedDurationMinutes(
        t,
        matchesRes.data || [],
      )
      if (!cancelled) {
        setCompletedDetailCache((prev) => ({
          ...prev,
          [t.id]: { pointsByUserId, eloByUserId, playedDurationMinutes },
        }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [detailTournamentId, rows, profileId, participantsByTournament])

  const filterTournamentRow = useCallback(
    (t: AmericanoTournament) => {
      if (scope === 'mine' && !joinedIds.has(t.id)) return false
      if (listRegionFilter) {
        const creatorArea = creatorAreasByUserId[String(t.creator_id)] || ''
        const courtName = resolveAmericanoCourtName(t.court_id, courts)
        if (!tournamentPassesKampeRegionFilter(t, listRegionFilter, creatorArea, courtName)) return false
      }
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if ((t.name || '').toLowerCase().includes(q)) return true
        const parts = participantsByTournament[t.id] || []
        return parts.some((p) => (p.display_name || '').toLowerCase().includes(q))
      }
      return true
    },
    [scope, joinedIds, listRegionFilter, creatorAreasByUserId, courts, searchQuery, participantsByTournament],
  )

  const filteredRows = useMemo(
    () => (loading || !profileId ? [] : rows.filter(filterTournamentRow)),
    [loading, profileId, rows, filterTournamentRow],
  )

  const openAmericanos = useMemo(
    () => filteredRows.filter((t) => t.status === 'registration'),
    [filteredRows],
  )
  const playingAmericanosFiltered = useMemo(
    () => filteredRows.filter((t) => t.status === 'playing'),
    [filteredRows],
  )
  const completedAmericanosFiltered = useMemo(
    () => filteredRows.filter((t) => t.status === 'completed'),
    [filteredRows],
  )

  const visibleRows = useMemo(
    () =>
      americanoView === 'open'
        ? openAmericanos
        : americanoView === 'playing'
          ? playingAmericanosFiltered
          : completedAmericanosFiltered,
    [americanoView, openAmericanos, playingAmericanosFiltered, completedAmericanosFiltered],
  )

  useEffect(() => {
    onFilteredCountChange?.(visibleRows.length)
  }, [visibleRows.length, onFilteredCountChange])

  const startTournament = async (t: AmericanoTournament, forceAsAdmin = false) => {
    const isCreatorOrAdmin = String(t.creator_id) === String(profileId) || isAdmin
    if (!isCreatorOrAdmin) {
      showToast('Kun opretteren eller en admin kan starte Americano/Mexicano.')
      return
    }
    if (forceAsAdmin) {
      const ok = await ask({
        message: `Gennemtving start af "${t.name}" som admin? Americano/Mexicano er ikke fyldt endnu.`,
        confirmLabel: 'Ja, start',
      })
      if (!ok) return
    }
    setBusyId(t.id)
    try {
      const { data: parts, error: pErr } = await supabase
        .from('americano_participants')
        .select('id, joined_at')
        .eq('tournament_id', t.id)
        .order('joined_at', { ascending: true })
        .order('id', { ascending: true })
      if (pErr) throw pErr
      const list = (parts || []) as Pick<AmericanoParticipant, 'id' | 'joined_at'>[]
      const slots = Number(t.player_slots)
      const n = list.length
      const participantIds = list.map((p) => p.id)
      const format = t.format ?? 'americano'
      let matchRows
      const passes: 1 | 2 = Number(t.opponent_passes) === 2 ? 2 : 1
      const courts = Math.max(1, Number(t.courts_per_round) || 1)
      if (forceAsAdmin) {
        // Admin: brug faktisk antal tilmeldte som schedule-basis (kræver 4–16)
        if (n < 4 || n > 16) {
          showToast(`Kan ikke gennemtvinge: ${n} tilmeldte er ikke gyldigt (kræver 4–16).`)
          return
        }
        if (isMexicanoFormat(format)) {
          const ppm = Number(t.points_per_match)
          const P = ppm === 16 || ppm === 24 || ppm === 32 ? ppm : 16
          matchRows = buildMexicanoStartRoundRows(t.id, participantIds, P, passes, courts)
        } else {
          matchRows = buildAmericanoRoundRobinMatchRows(t.id, participantIds, courts, passes)
        }
      } else {
        if (n !== slots) {
          showToast(`Americano/Mexicano skal være fyldt før start: ${slots} tilmeldte kræves (nu: ${n}).`)
          return
        }
        if (n < 4 || n > 16) {
          showToast(`Ugyldigt antal spillere: ${n}. Kræver 4–16.`)
          return
        }
        if (isMexicanoFormat(format)) {
          const ppm = Number(t.points_per_match)
          const P = ppm === 16 || ppm === 24 || ppm === 32 ? ppm : 16
          matchRows = buildMexicanoStartRoundRows(t.id, participantIds, P, passes, courts)
        } else {
          matchRows = buildAmericanoRoundRobinMatchRows(t.id, participantIds, courts, passes)
        }
      }

      await supabase.from('americano_matches').delete().eq('tournament_id', t.id)

      const { error: mErr } = await supabase.from('americano_matches').insert(matchRows)
      if (mErr) throw mErr

      const { error: uErr } = await supabase
        .from('americano_tournaments')
        .update({ status: 'playing', updated_at: new Date().toISOString() })
        .eq('id', t.id)
      if (uErr) throw uErr

      void notifyAmericanoTournamentStarted(t, profileId)
      showToast(
        isMexicanoFormat(format)
          ? 'Mexicano startet — runde 1 er klar. Næste runder genereres når resultater gemmes.'
          : 'Americano startet — runder genereret.',
      )
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Kunne ikke starte: ' + msg)
    } finally {
      setBusyId(null)
    }
  }

  const joinTournament = async (tournament: AmericanoTournament) => {
    const tournamentId = tournament.id
    const maxSlots = tournament.player_slots
    setBusyId(tournamentId)
    try {
      const { count, error: cErr } = await supabase
        .from('americano_participants')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)
      if (cErr) throw cErr
      if ((count ?? 0) >= maxSlots) {
        showToast('Americano/Mexicano er fuld.')
        return
      }
      const { error } = await supabase.from('americano_participants').insert({
        tournament_id: tournamentId,
        user_id: profileId,
        display_name: displayName,
      })
      if (error) throw error
      const newCount = (count ?? 0) + 1
      if (newCount >= maxSlots) {
        void notifyAmericanoTournamentFull(tournament, profileId)
      }
      showToast('Du er tilmeldt!')
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Kunne ikke tilmelde: ' + msg)
    } finally {
      setBusyId(null)
    }
  }

  const leaveTournament = async (tournamentId: string) => {
    const tournament = rows.find((x) => x.id === tournamentId)
    const countBefore = (participantsByTournament[tournamentId] || []).length
    setBusyId(tournamentId)
    try {
      const { error } = await supabase
        .from('americano_participants')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('user_id', profileId)
      if (error) throw error
      if (tournament) {
        void notifyAmericanoSpotOpened(tournament, profileId, {
          countBeforeLeave: countBefore,
          maxSlots: tournament.player_slots,
        })
      }
      showToast('Du er afmeldt.')
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Kunne ikke afmelde: ' + msg)
    } finally {
      setBusyId(null)
    }
  }

  const kickParticipant = async (tournamentId: string, participantId: string) => {
    const tournament = rows.find((x) => x.id === tournamentId)
    const countBefore = (participantsByTournament[tournamentId] || []).length
    setBusyId(tournamentId + '-kick-' + participantId)
    try {
      const { error } = await supabase
        .from('americano_participants')
        .delete()
        .eq('id', participantId)
        .eq('tournament_id', tournamentId)
      if (error) throw error
      if (tournament) {
        void notifyAmericanoSpotOpened(tournament, profileId, {
          countBeforeLeave: countBefore,
          maxSlots: tournament.player_slots,
        })
      }
      showToast('Spiller fjernet.')
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Kunne ikke fjerne spiller: ' + msg)
    } finally {
      setBusyId(null)
    }
  }

  /** Kun under tilmelding — som almindelig kamp (opretter). CASCADE sletter deltagere + kampe. */
  const deleteTournament = async (t: AmericanoTournament) => {
    if (String(t.creator_id) !== String(profileId)) {
      showToast('Kun opretteren kan slette Americano/Mexicano.')
      return
    }
    if (t.status !== 'registration') {
      showToast('Du kan kun slette Americano/Mexicano der endnu ikke er startet.')
      return
    }
    const okDelete = await ask({
      message: 'Slette denne Americano/Mexicano? Alle tilmeldinger fjernes.',
      confirmLabel: 'Ja, slet',
      danger: true,
    })
    if (!okDelete) return
    setBusyId(t.id)
    try {
      const { error } = await supabase.from('americano_tournaments').delete().eq('id', t.id)
      if (error) throw error
      showToast('Americano/Mexicano slettet.')
      setDetailTournamentId(null)
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Kunne ikke slette: ' + msg)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="pm-state-card pm-state-card--loading" style={{ fontFamily: font }}>
        <div className="pm-spinner pm-state-spinner" />
        <div className="pm-state-title">{TOURNAMENT_LOADING}</div>
        <div className="pm-state-copy">Vi henter Americano/Mexicano og deltagere.</div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="pm-state-card pm-state-card--error" style={{ fontFamily: font }}>
        <div className="pm-state-icon">⚠️</div>
        <div className="pm-state-title">{TOURNAMENT_LOAD_ERROR_TITLE}</div>
        <div className="pm-state-copy">{loadError}</div>
        <div className="pm-state-actions">
          <button type="button" onClick={() => void load()} style={{ ...btn(true), fontSize: 13 }}>
            Prøv igen
          </button>
        </div>
      </div>
    )
  }

  if (!profileId) {
    return (
      <div className="pm-state-card pm-state-card--warning" style={{ fontFamily: font }}>
        <div className="pm-state-icon">🔒</div>
        <div className="pm-state-title">Du skal være logget ind</div>
        <div className="pm-state-copy">{TOURNAMENT_LOGIN_REQUIRED}</div>
      </div>
    )
  }

  const americanoSubTabs = [
    { id: 'open' as const, label: `Åbne (${openAmericanos.length})` },
    { id: 'playing' as const, label: `I gang (${playingAmericanosFiltered.length})` },
    { id: 'completed' as const, label: `Afsluttede (${completedAmericanosFiltered.length})` },
  ]

  const detailTournament = detailTournamentId
    ? rows.find((x) => x.id === detailTournamentId) ?? null
    : null

  const buildDetailPlayers = (
    t: AmericanoTournament,
    manageToolsOpen: boolean,
    canManageTournament: boolean
  ): AmericanoDetailPlayer[] => {
    const parts = participantsByTournament[t.id] || []
    const cache = completedDetailCache[t.id]
    return parts.map((p) => {
      const snap = participantSnippets[p.user_id]
      const name = String(snap?.full_name || snap?.name || p.display_name).trim() || p.display_name
      const isMe = String(p.user_id) === String(profileId)
      const canKickPlayer = canManageTournament && manageToolsOpen && !isMe
      const eloRaw = snap?.americano_elo_rating
      return {
        id: p.id,
        user_id: p.user_id,
        name,
        avatar: snap?.avatar || null,
        isMe,
        elo: eloRaw != null && Number.isFinite(Number(eloRaw)) ? Math.round(Number(eloRaw)) : null,
        points: cache?.pointsByUserId[p.user_id],
        eloChange: cache?.eloByUserId[p.user_id]?.change,
        onView: () => openParticipantProfile(p.user_id, p.display_name),
        ...(canKickPlayer
          ? {
              onKick: () => kickParticipant(t.id, p.id),
              kickBusy: busyId === t.id + '-kick-' + p.id,
            }
          : {}),
      }
    })
  }

  return (
    <div style={{ fontFamily: font }}>
      {!embedInKampe && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 'clamp(20px, 4.5vw, 24px)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            {TOURNAMENT_SECTION_LABEL}
          </h2>
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            style={{
              ...btn(true),
              fontSize: 14,
            }}
          >
            {showCreate ? 'Annullér' : '+ Opret Americano/Mexicano'}
          </button>
        </div>
      )}

      {showCreate ? (
        <div ref={createFormRef} className="pm-create-form-anchor pm-create-form-panel" style={{ marginBottom: 24 }}>
          <CreateAmericanoTournamentForm
            userId={profileId}
            displayName={displayName}
            courts={courts}
            onCreated={async () => {
              setShowCreate(false)
              showToast('Americano/Mexicano oprettet — del link eller invitér spillere.')
              await load()
            }}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      ) : (
        <>
      <div className="pm-help-box" style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setAmericanoHelpOpen((v) => !v)}
          aria-expanded={americanoHelpOpen}
          style={{
            width: '100%',
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            textAlign: 'left',
          }}
        >
          <span className="pm-help-box-title">Sådan fungerer Americano & Mexicano</span>
          <span className="pm-help-box-chevron">
            {americanoHelpOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </button>
        {americanoHelpOpen ? (
          <div className="pm-help-box-content" style={{ marginTop: 8 }}>
            <div className="pm-help-box-item">
              <span style={{ flexShrink: 0 }}>1.</span>
              <span><strong>Americano er et af de mest udbredte formater</strong> og er lavet til social, hurtig afvikling med mange kampe.</span>
            </div>
            <div className="pm-help-box-item">
              <span style={{ flexShrink: 0 }}>2.</span>
              <span>Du har ikke fast makker: der spilles double, og du får <strong>skiftende makkere og modstandere</strong> fra runde til runde.</span>
            </div>
            <div className="pm-help-box-item">
              <span style={{ flexShrink: 0 }}>3.</span>
              <span>Kampe spilles typisk til et fast antal point (fx 16/24/32) eller på tid. Hvert point tæller i resultatet.</span>
            </div>
            <div className="pm-help-box-item">
              <span style={{ flexShrink: 0 }}>4.</span>
              <span>Stillingen er <strong>individuel</strong>: dine kamp-point lægges sammen, og spilleren med flest point vinder Americano/Mexicano.</span>
            </div>
            <div className="pm-help-box-item">
              <span style={{ flexShrink: 0 }}>5.</span>
              <span><strong>Americano:</strong> Hele rundeplanen laves når Americano startes — alle kampe er kendt på forhånd.</span>
            </div>
            <div className="pm-help-box-item">
              <span style={{ flexShrink: 0 }}>6.</span>
              <span><strong>Mexicano:</strong> Runde 1 ved start; derefter parres næste kamp ud fra stilling (1.+4. vs 2.+3. på banen). Nye runder genereres når resultater er gemt.</span>
            </div>
            <div className="pm-help-box-item">
              <span style={{ flexShrink: 0 }}>7.</span>
              <span>
                Antal baner pr. runde betyder: på hver bane spiller <strong>4 (2v2)</strong>, og resten sidder over pr. runde (i Mexicano kan det være forskellige spillere fra runde til runde).
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <PillTabs
        tabs={americanoSubTabs}
        value={americanoView}
        onChange={(nextTab: AmericanoSubTab) => {
          setAmericanoView(nextTab)
          onAmericanoSubTabChange?.(nextTab)
        }}
        ariaLabel="Americano/Mexicano-status"
        size="sm"
        className=""
        style={{ marginBottom: 16 }}
      />

      {rows.length === 0 ? (
        <div className="pm-state-card pm-state-card--empty">
          <div className="pm-state-icon">🏟️</div>
          <div className="pm-state-title">{TOURNAMENT_EMPTY.none}</div>
          <div className="pm-state-copy">{TOURNAMENT_EMPTY.createPrompt}</div>
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="pm-state-card pm-state-card--empty">
          <div className="pm-state-icon">📭</div>
          <div className="pm-state-title">
            {americanoView === 'open' && TOURNAMENT_EMPTY.noneOpen}
            {americanoView === 'playing' && TOURNAMENT_EMPTY.nonePlaying}
            {americanoView === 'completed' && TOURNAMENT_EMPTY.noneCompleted}
          </div>
          <div className="pm-state-copy">{TOURNAMENT_EMPTY.tryOtherTab}</div>
        </div>
      ) : (
        <div className="pm-kampe-v2-list">
          {visibleRows.map((t) => {
            const parts = participantsByTournament[t.id] || []
            const listParticipants = parts.map((p) => {
              const snap = participantSnippets[p.user_id]
              return {
                user_id: p.user_id,
                display_name:
                  String(snap?.full_name || snap?.name || p.display_name).trim() || p.display_name,
                avatar: snap?.avatar || null,
              }
            })
            const cardStatus =
              t.status === 'registration'
                ? ('registration' as const)
                : t.status === 'playing'
                  ? ('playing' as const)
                  : ('completed' as const)
            return (
              <AmericanoListCard
                key={t.id}
                tournament={t}
                courtName={resolveAmericanoCourtName(t.court_id, courts)}
                participants={listParticipants}
                status={cardStatus}
                joined={joinedIds.has(t.id)}
                tournamentFull={parts.length === Number(t.player_slots)}
                liveRound={listMeta.liveRound[t.id] ?? null}
                myEloChange={listMeta.myEloChange[t.id] ?? null}
                playedDurationMinutes={listMeta.playedDurationMinutes[t.id] ?? null}
                onClick={() => setDetailTournamentId(t.id)}
              />
            )
          })}
        </div>
      )}
        </>
      )}

      {detailTournament ? (() => {
        const t = detailTournament
        const isCreator = String(t.creator_id) === String(profileId)
        const joined = joinedIds.has(t.id)
        const partCount = (participantsByTournament[t.id] || []).length
        const slotsConfigured = Number(t.player_slots)
        const tournamentFull = partCount === slotsConfigured
        const canManageTournament = (isCreator || isAdmin) && t.status === 'registration'
        const manageToolsOpen = openManageTools.has(t.id)
        const dateLabel = `${formatMatchDateDa(t.tournament_date)} kl. ${formatTimeSlotDa(t.time_slot)}`
        const detailStatus =
          t.status === 'registration'
            ? ('registration' as const)
            : t.status === 'playing'
              ? ('playing' as const)
              : ('completed' as const)
        const detailPlayers = buildDetailPlayers(t, manageToolsOpen, canManageTournament)
        const enrichedParts = (participantsByTournament[t.id] || []).map((p) => {
          const snap = participantSnippets[p.user_id]
          return {
            id: p.id,
            user_id: p.user_id,
            display_name:
              String(snap?.full_name || snap?.name || p.display_name).trim() || p.display_name,
            avatar: snap?.avatar || null,
            full_name: snap?.full_name || null,
          }
        })

        const registrationActions =
          t.status === 'registration' ? (
            <>
              {!joined && (
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => joinTournament(t)}
                  style={{
                    ...btn(true),
                    width: '100%',
                    justifyContent: 'center',
                    padding: '12px',
                    fontSize: 14,
                    fontWeight: 700,
                    borderRadius: 10,
                    cursor: busyId === t.id ? 'wait' : 'pointer',
                  }}
                >
                  {busyId === t.id
                    ? 'Vent…'
                    : `Tilmeld dig · ${slotsConfigured - partCount} ${slotsConfigured - partCount === 1 ? 'plads' : 'pladser'} tilbage`}
                </button>
              )}
              {joined && !isCreator && (
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => leaveTournament(t.id)}
                  style={{
                    ...btn(false),
                    width: '100%',
                    justifyContent: 'center',
                    padding: '12px',
                    fontSize: 14,
                    fontWeight: 700,
                    borderRadius: 10,
                    cursor: busyId === t.id ? 'wait' : 'pointer',
                  }}
                >
                  Afmeld
                </button>
              )}
            </>
          ) : null

        const joinedNote =
          joined && t.status === 'registration' ? (
            <span
              className="pm-feedback-inline-note pm-feedback-inline-note--info"
              style={{ alignSelf: 'center' }}
            >
              Du er tilmeldt
            </span>
          ) : null

        const manageExtras = canManageTournament ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              disabled={busyId === t.id || !tournamentFull}
              title={
                tournamentFull
                  ? 'Generér runder og start Americano/Mexicano'
                  : `Kræver ${slotsConfigured} tilmeldte (nu ${partCount})`
              }
              onClick={() => startTournament(t)}
              style={{
                ...btn(true),
                fontSize: 13,
                padding: '8px 14px',
                background: tournamentFull ? theme.warm : theme.border,
                borderColor: tournamentFull ? theme.warm : theme.border,
                color: tournamentFull ? theme.onAccent : theme.textLight,
                cursor: busyId === t.id ? 'wait' : tournamentFull ? 'pointer' : 'not-allowed',
              }}
            >
              {busyId === t.id ? 'Starter…' : 'Start Americano/Mexicano (generér runder)'}
            </button>
            <button
              type="button"
              onClick={() =>
                setOpenManageTools((prev) => {
                  const next = new Set(prev)
                  if (next.has(t.id)) next.delete(t.id)
                  else next.add(t.id)
                  return next
                })
              }
              style={{
                ...btn(false),
                padding: '7px 12px',
                fontSize: '12px',
                color: theme.warm,
                borderColor: theme.warm + '55',
                background: theme.warmBg,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
              }}
            >
              <span>{manageToolsOpen ? 'Skjul admin-værktøjer' : 'Vis admin-værktøjer'}</span>
              {manageToolsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {manageToolsOpen && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {isAdmin && !tournamentFull && partCount >= 5 && (
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => startTournament(t, true)}
                    style={{
                      ...btn(false),
                      fontSize: 13,
                      padding: '8px 14px',
                      borderColor: theme.warm,
                      color: theme.warm,
                      cursor: busyId === t.id ? 'wait' : 'pointer',
                    }}
                  >
                    ⚡ Gennemtving start (Admin)
                  </button>
                )}
                {isCreator && (
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => void deleteTournament(t)}
                    style={{
                      ...btn(false),
                      fontSize: 13,
                      padding: '8px 14px',
                      border: '1px solid var(--pm-danger-border)',
                      color: theme.red,
                      cursor: busyId === t.id ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Trash2 size={14} aria-hidden />
                    Slet Americano/Mexicano
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null

        const playingPrimaryAction =
          t.status === 'playing' && joined ? (
            <button
              type="button"
              className="pm-americano-v2-detail-live-btn"
              onClick={() => {
                const el = document.querySelector('.pm-americano-v2-detail-results')
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              Se live scoreboard
            </button>
          ) : null

        return (
          <AmericanoDetailSheet
            open
            onClose={() => setDetailTournamentId(null)}
            tournament={t}
            courts={courts}
            dateLabel={dateLabel}
            status={detailStatus}
            participants={detailPlayers}
            joined={joined}
            tournamentFull={tournamentFull}
            liveRound={listMeta.liveRound[t.id] ?? null}
            playedDurationMinutes={
              t.status === 'completed'
                ? completedDetailCache[t.id]?.playedDurationMinutes ??
                  listMeta.playedDurationMinutes[t.id] ??
                  null
                : null
            }
            description={t.description}
            actions={
              <>
                {registrationActions}
                {playingPrimaryAction}
              </>
            }
            joinedNote={joinedNote}
            extras={manageExtras}
            resultsPanel={
              joined && t.status === 'playing' ? (
                <AmericanoResultsPanel
                  tournament={t}
                  currentUserId={profileId}
                  onSaved={load}
                  showToast={showToast}
                  onProfileStatsRefresh={refreshProfileQuiet}
                />
              ) : null
            }
            completedTournament={
              t.status === 'completed'
                ? {
                    participants: enrichedParts,
                    currentUserId: profileId,
                    isCreator,
                    onParticipantView: openParticipantProfile,
                  }
                : null
            }
          />
        )
      })() : null}

      {participantStatsPick && (
        <PlayerStatsModal
          userId={participantStatsPick.userId}
          fallbackName={participantStatsPick.name}
          avatar={participantStatsPick.avatar}
          onClose={() => setParticipantStatsPick(null)}
        />
      )}
    </div>
  )
}
