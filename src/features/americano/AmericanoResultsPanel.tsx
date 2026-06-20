import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { Check, Pencil, ClipboardEdit } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useConfirm } from '../../lib/ConfirmDialogProvider'
import { AvatarCircle } from '../../components/AvatarCircle'
import type { AmericanoMatchRow, AmericanoParticipant, AmericanoTournament } from './types'
import {
  americanoOutcomeColors,
  americanoOutcomeForUserInMatch,
  americanoViewerStatusLabel,
  userIsOnCourtInAmericanoMatch,
} from './americanoOutcomeColors'
import { notifyAmericanoTournamentCompleted } from '../../lib/notifyKampeEntityComplete'
import { TOURNAMENT_ELO_LABEL } from '../../lib/tournamentCopy'
import { advanceMexicanoRoundIfReady, mexicanoProgressLabel } from '../../lib/mexicanoAdvance.js'
import {
  buildNextMexicanoRoundIfReady,
  getMaxRoundNumber,
  getMexicanoTotalRounds,
  isMexicanoFormat,
} from '../../lib/mexicanoSchedule.js'
import { getTournamentFormatLabel } from './americanoDisplayUtils'
import { orderParticipantsForSchedule } from '../../lib/americanoParticipantOrder'

const font = 'var(--pm-font)'

const c = {
  line: 'var(--pm-border)',
  muted: 'var(--pm-text-light)',
  text: 'var(--pm-text)',
  avatarBg: 'var(--pm-border)',
  avatarText: 'var(--pm-text-light)',
  accent: 'var(--pm-accent)',
  warm: 'var(--pm-warm)',
  onAccent: 'var(--pm-on-accent)',
}

function initialsFromName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase()
  if (p.length === 1 && p[0].length >= 2) return p[0].slice(0, 2).toUpperCase()
  return (p[0]?.[0] || '?').toUpperCase()
}

function DualAvatar({ a, b }: { a: string; b: string }) {
  const ia = initialsFromName(a)
  const ib = initialsFromName(b)
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, width: 44 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: c.avatarBg,
          color: c.avatarText,
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid var(--pm-surface)',
          zIndex: 2,
          fontFamily: font,
        }}
      >
        {ia}
      </div>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: c.avatarBg,
          color: c.avatarText,
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: -14,
          border: '2px solid var(--pm-surface)',
          zIndex: 1,
          fontFamily: font,
        }}
      >
        {ib}
      </div>
    </div>
  )
}
type TeamOutcome = 'win' | 'loss' | 'tie'

function TeamBlock({
  name1,
  name2,
  pid1,
  pid2,
  score,
  outcome,
  baseTextColor,
  showCheckForUser,
  userIdByPartId,
  currentUserId,
  inputElement,
  teamLabel,
}: {
  name1: string
  name2: string
  pid1: string
  pid2: string
  score: number | null
  outcome: TeamOutcome
  baseTextColor?: string
  showCheckForUser: boolean
  userIdByPartId: Map<string, string>
  currentUserId: string
  inputElement?: React.ReactNode
  teamLabel?: string
}) {
  const scoreStr = score != null && !Number.isNaN(score) ? String(score) : '—'
  const resolvedBaseTextColor = baseTextColor || c.text
  const nameColor = outcome === 'loss' ? 'var(--pm-text-mid)' : resolvedBaseTextColor
  const scoreColor = outcome === 'loss' ? 'var(--pm-text-mid)' : resolvedBaseTextColor
  const scoreSize = outcome === 'tie' ? 24 : 26
  const scoreWeight = outcome === 'loss' ? 700 : 800
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        minHeight: 56,
      }}
    >
      <DualAvatar a={name1} b={name2} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {teamLabel && (
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: c.muted, marginBottom: 2 }}>
            {teamLabel}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
            color: nameColor,
            lineHeight: 1.35,
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name1}</span>
          {showCheckForUser && String(userIdByPartId.get(pid1)) === String(currentUserId) && (
            <Check size={16} strokeWidth={2.5} color={c.accent} aria-hidden />
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
            color: nameColor,
            lineHeight: 1.35,
            marginTop: 2,
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name2}</span>
          {showCheckForUser && String(userIdByPartId.get(pid2)) === String(currentUserId) && (
            <Check size={16} strokeWidth={2.5} color={c.accent} aria-hidden />
          )}
        </div>
      </div>
      <div
        style={{
          fontSize: inputElement ? undefined : scoreSize,
          fontWeight: inputElement ? undefined : scoreWeight,
          letterSpacing: inputElement ? undefined : '-0.03em',
          color: inputElement ? undefined : scoreColor,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
          minWidth: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: font,
        }}
      >
        {inputElement || scoreStr}
      </div>
    </div>
  )
}

type Props = {
  tournament: AmericanoTournament
  /** Opretteren af turneringen — kan låse op og rette gemte resultater */
  currentUserId: string
  /** Admin kan også afslutte/generere runder (redning hvis opretteren er væk) */
  isAdmin?: boolean
  onSaved: () => void
  showToast: (msg: string) => void
  onProfileStatsRefresh?: () => void
}

function isMatchResultLocked(m: AmericanoMatchRow): boolean {
  const hasScores = m.team_a_score != null && m.team_b_score != null
  if (!hasScores) return false
  if (m.results_locked === false) return false
  return true
}

/** Point på de to hold skal summere til formatet P (16/24/32). Uafgjort (fx 8–8 ved 16) er tilladt. */
function isValidAmericanoScore(a: number, b: number, P: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false
  return a + b === P
}

function resolvedMatchScores(
  m: AmericanoMatchRow,
  sc: Record<string, { a: string; b: string }>,
  P: number
): { a: number; b: number } | null {
  const row = sc[m.id]
  if (row && row.a !== '' && row.b !== '') {
    const a = parseInt(row.a, 10)
    const b = parseInt(row.b, 10)
    if (isValidAmericanoScore(a, b, P)) return { a, b }
  }
  if (m.team_a_score != null && m.team_b_score != null) {
    const a = m.team_a_score
    const b = m.team_b_score
    if (isValidAmericanoScore(a, b, P)) return { a, b }
  }
  return null
}

function buildLeaderboard(
  participants: AmericanoParticipant[],
  matches: AmericanoMatchRow[],
  scores: Record<string, { a: string; b: string }>,
  P: number
): { id: string; name: string; points: number }[] {
  const totals = new Map<string, number>()
  participants.forEach((p) => totals.set(p.id, 0))
  for (const m of matches) {
    const r = resolvedMatchScores(m, scores, P)
    if (!r) continue
    const add = (pid: string, pts: number) => totals.set(pid, (totals.get(pid) ?? 0) + pts)
    add(m.team_a_p1, r.a)
    add(m.team_a_p2, r.a)
    add(m.team_b_p1, r.b)
    add(m.team_b_p2, r.b)
  }
  return participants
    .map((p) => ({ id: p.id, name: p.display_name, points: totals.get(p.id) ?? 0 }))
    .sort((x, y) => y.points - x.points)
}

/** Udfylder det andet hold med P − n (fx 10 → 6, 8 → 8 ved format 16). */
function complementFromOneSide(raw: string, P: number, showToast: (msg: string) => void): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  if (!Number.isInteger(n) || n < 0 || n > P) {
    showToast(`Hold A/B: indtast et helt tal mellem 0 og ${P}.`)
    return null
  }
  return P - n
}

function isMissingRpcFunctionError(message: string): boolean {
  return /could not find the function|function .* does not exist|schema cache/i.test(message || '')
}

type AmericanoEloRpcData = {
  success?: boolean
  error?: string
  already_applied?: boolean
  players_updated?: number
  status_updated?: boolean
}

export function AmericanoResultsPanel({
  tournament,
  currentUserId,
  isAdmin = false,
  onSaved,
  showToast,
  onProfileStatsRefresh,
}: Props) {
  const [participants, setParticipants] = useState<AmericanoParticipant[]>([])
  const [matches, setMatches] = useState<AmericanoMatchRow[]>([])
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({})
  const [avatarByUserId, setAvatarByUserId] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  /** Midlertidigt ulåst af opretter — nulstilles ved genindlæsning */
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(() => new Set())
  const [tab, setTab] = useState<'stilling' | 'mine' | 'alle'>('stilling')
  const [entryOpenId, setEntryOpenId] = useState<string | null>(null)
  const ask = useConfirm()

  const ppm = Number(tournament.points_per_match)
  const P: 16 | 24 | 32 =
    ppm === 16 || ppm === 24 || ppm === 32 ? ppm : 16
  const isCreator = String(tournament.creator_id) === String(currentUserId)
  // Skrivninger til americano_matches/-tournaments er kun-opretter på RLS-niveau.
  // Admin-redning sker via dedikerede admin-RPC'er, ikke via dette panel.
  const canManage = isCreator
  const isMexicano = isMexicanoFormat(tournament.format ?? 'americano')
  const formatLabel = getTournamentFormatLabel(tournament.format)

  const participantIdsOrdered = useMemo(
    () => orderParticipantsForSchedule(participants, tournament.id),
    [participants, tournament.id],
  )

  const mexicanoProgress = useMemo(() => {
    if (!isMexicano || participantIdsOrdered.length === 0) return null
    return mexicanoProgressLabel(tournament, participantIdsOrdered, matches)
  }, [isMexicano, tournament, participantIdsOrdered, matches])

  const pendingNextMexicanoRound = useMemo(() => {
    if (!isMexicano || !canManage) return null
    return buildNextMexicanoRoundIfReady(
      tournament,
      participantIdsOrdered,
      matches,
      P,
    )
  }, [isMexicano, isCreator, tournament, participantIdsOrdered, matches, P])

  const nameByPartId = useCallback(
    (pid: string) => participants.find((p) => p.id === pid)?.display_name || '?',
    [participants]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, mRes] = await Promise.all([
        supabase.from('americano_participants').select('*').eq('tournament_id', tournament.id),
        supabase
          .from('americano_matches')
          .select('*')
          .eq('tournament_id', tournament.id)
          .order('round_number', { ascending: true })
          .order('court_index', { ascending: true }),
      ])
      const plist = (pRes.data || []) as AmericanoParticipant[]
      const mlist = (mRes.data || []) as AmericanoMatchRow[]
      setParticipants(plist)
      setMatches(mlist)

      // Hent avatarer til VS-kort og leaderboard
      const userIds = [...new Set(plist.map((p) => p.user_id).filter(Boolean))]
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, avatar')
          .in('id', userIds)
        const amap: Record<string, string> = {}
        ;(profs || []).forEach((pr: { id: string; avatar?: string | null }) => {
          if (pr.avatar) amap[String(pr.id)] = pr.avatar
        })
        setAvatarByUserId(amap)
      }
      const sc: Record<string, { a: string; b: string }> = {}
      mlist.forEach((m) => {
        const bothSet = m.team_a_score != null && m.team_b_score != null
        sc[m.id] = {
          a: bothSet ? String(m.team_a_score) : '',
          b: bothSet ? String(m.team_b_score) : '',
        }
      })
      setScores(sc)
      setUnlockedIds(new Set())

      if (canManage && isMexicanoFormat(tournament.format ?? 'americano')) {
        const advanced = await advanceMexicanoRoundIfReady({
          supabase,
          tournament,
          participantIdsInJoinOrder: orderParticipantsForSchedule(plist, tournament.id),
          matches: mlist,
          showToast,
        })
        if (advanced) {
          const { data: m2 } = await supabase
            .from('americano_matches')
            .select('*')
            .eq('tournament_id', tournament.id)
            .order('round_number', { ascending: true })
            .order('court_index', { ascending: true })
          const refreshed = (m2 || []) as AmericanoMatchRow[]
          setMatches(refreshed)
          const sc2: Record<string, { a: string; b: string }> = {}
          refreshed.forEach((m) => {
            const bothSet = m.team_a_score != null && m.team_b_score != null
            sc2[m.id] = {
              a: bothSet ? String(m.team_a_score) : '',
              b: bothSet ? String(m.team_b_score) : '',
            }
          })
          setScores(sc2)
        }
      }
    } catch (e) {
      console.warn(e)
    } finally {
      setLoading(false)
    }
  }, [tournament, isCreator, showToast])

  useEffect(() => {
    load()
  }, [load])

  const saveRow = async (m: AmericanoMatchRow) => {
    const s = scores[m.id]
    if (!s) return
    let aStr = s.a.trim()
    let bStr = s.b.trim()
    if (aStr !== '' && bStr === '') {
      const o = complementFromOneSide(aStr, P, showToast)
      if (o == null) return
      bStr = String(o)
      setScores((prev) => ({ ...prev, [m.id]: { a: aStr, b: bStr } }))
    } else if (bStr !== '' && aStr === '') {
      const o = complementFromOneSide(bStr, P, showToast)
      if (o == null) return
      aStr = String(o)
      setScores((prev) => ({ ...prev, [m.id]: { a: aStr, b: bStr } }))
    }
    if (aStr === '' || bStr === '') {
      showToast(`Indtast mindst ét hold — det andet sættes til resten op til ${P}.`)
      return
    }
    const a = parseInt(aStr, 10)
    const b = parseInt(bStr, 10)
    if (!isValidAmericanoScore(a, b, P)) {
      showToast(`Summen skal være præcis ${P} point (format). Uafgjort er ok (fx 8–8 ved 16).`)
      return
    }
    setSaving(true)
    try {
      if (isCreator) {
        const { error } = await supabase
          .from('americano_matches')
          .update({
            team_a_score: a,
            team_b_score: b,
            results_locked: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', m.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.rpc('report_americano_match_score', {
          p_match_id: m.id,
          p_score_a: a,
          p_score_b: b,
        })
        if (error) throw error
        const res = data as { success?: boolean; error?: string } | null
        if (!res?.success) {
          const errMap: Record<string, string> = {
            already_locked: 'Resultatet er allerede indberettet.',
            not_on_court: 'Du spiller ikke på denne bane.',
            tournament_not_playing: 'Turneringen er ikke i gang.',
            invalid_score: `Summen skal være præcis ${P} point.`,
            not_authenticated: 'Du skal være logget ind.',
            match_not_found: 'Kampen blev ikke fundet.',
          }
          showToast(errMap[res?.error || ''] || 'Kunne ikke gemme resultatet.')
          return
        }
      }
      showToast('Resultat gemt.')
      await load()
      onProfileStatsRefresh?.()
      onSaved()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Kunne ikke gemme: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  const getDraftScore = useCallback(
    (matchId: string) => {
      const row = scores[matchId] || { a: '', b: '' }
      let aStr = row.a.trim()
      let bStr = row.b.trim()
      if (aStr === '' && bStr === '') return null

      if (aStr !== '' && bStr === '') {
        const a = parseInt(aStr, 10)
        if (!Number.isInteger(a) || a < 0 || a > P) return null
        bStr = String(P - a)
      } else if (bStr !== '' && aStr === '') {
        const b = parseInt(bStr, 10)
        if (!Number.isInteger(b) || b < 0 || b > P) return null
        aStr = String(P - b)
      }

      const a = parseInt(aStr, 10)
      const b = parseInt(bStr, 10)
      if (!Number.isInteger(a) || !Number.isInteger(b)) return null

      return {
        a,
        b,
        label: `${a}-${b}`,
        valid: isValidAmericanoScore(a, b, P),
      }
    },
    [scores, P]
  )

  const handleScoreBlur = (m: AmericanoMatchRow, side: 'a' | 'b') => {
    const row = scores[m.id] || { a: '', b: '' }
    if (row.a.trim() === '' && row.b.trim() === '') return

    let newA = row.a.trim()
    let newB = row.b.trim()

    if (side === 'a' && newA !== '' && newB === '') {
      const o = complementFromOneSide(newA, P, showToast)
      if (o != null) { newB = String(o) }
    } else if (side === 'b' && newB !== '' && newA === '') {
      const o = complementFromOneSide(newB, P, showToast)
      if (o != null) { newA = String(o) }
    }

    if (newA !== row.a.trim() || newB !== row.b.trim()) {
      setScores((prev) => ({ ...prev, [m.id]: { a: newA, b: newB } }))
    }
  }

  const completeTournament = async () => {
    const okConfirm = await ask({
      message: `Afslut ${formatLabel}? ${formatLabel}-ELO beregnes for alle spillere, og det kan ikke fortrydes.`,
      confirmLabel: 'Afslut og beregn',
      danger: true,
    })
    if (!okConfirm) return
    if (isMexicano && participantIdsOrdered.length > 0) {
      const passes = Number(tournament.opponent_passes) === 2 ? 2 : 1
      const total = getMexicanoTotalRounds(participantIdsOrdered.length, passes)
      const maxR = getMaxRoundNumber(matches)
      if (maxR < total) {
        showToast(
          `Mexicano: alle ${total} runder skal spilles før afslutning (nu ${maxR}/${total}).`,
        )
        return
      }
    }

    const incomplete = matches.some((m) => {
      const s = scores[m.id]
      if (!s) return true
      const aStr = s.a.trim()
      const bStr = s.b.trim()
      if (aStr === '' || bStr === '') return true
      const a = parseInt(aStr, 10)
      const b = parseInt(bStr, 10)
      return !isValidAmericanoScore(a, b, P)
    })
    if (incomplete) {
      showToast('Alle kampe skal have gyldige resultater før afslutning.')
      return
    }
    setSaving(true)
    try {
      let eloData: AmericanoEloRpcData | null = null
      let eloErrorMessage: string | null = null
      let usedLegacyFallback = false

      const atomicRes = await supabase.rpc('complete_americano_tournament', {
        p_tournament_id: tournament.id,
      })

      if (atomicRes.error && isMissingRpcFunctionError(String(atomicRes.error.message || ''))) {
        usedLegacyFallback = true
        // Backward-compatible fallback if DB migration is not applied yet.
        const nowIso = new Date().toISOString()
        const { error } = await supabase
          .from('americano_tournaments')
          .update({ status: 'completed', updated_at: nowIso, completed_at: nowIso })
          .eq('id', tournament.id)
        if (error) throw error

        const legacyRes = await supabase.rpc('apply_americano_elo_for_tournament', {
          p_tournament_id: tournament.id,
        })
        eloData = legacyRes.data as AmericanoEloRpcData | null
        eloErrorMessage = legacyRes.error?.message ?? null
      } else {
        eloData = atomicRes.data as AmericanoEloRpcData | null
        eloErrorMessage = atomicRes.error?.message ?? null
      }

      if (eloErrorMessage) {
        console.warn('Americano ELO rpc error:', eloErrorMessage)
        if (usedLegacyFallback) {
          showToast(`Americano/Mexicano afsluttet. ${TOURNAMENT_ELO_LABEL} blev ikke opdateret endnu (mangler DB-migration).`)
        } else {
          throw new Error(eloErrorMessage)
        }
      } else if (eloData?.error) {
        showToast(`Americano/Mexicano afsluttet. ${TOURNAMENT_ELO_LABEL} kunne ikke beregnes: ` + String(eloData.error))
      } else if (eloData?.success) {
        const playersUpdated = Number(eloData.players_updated) || 0
        if (eloData.already_applied) {
          showToast(`Americano/Mexicano afsluttet. ${TOURNAMENT_ELO_LABEL} var allerede beregnet.`)
        } else {
          showToast(`Americano/Mexicano afsluttet. ${TOURNAMENT_ELO_LABEL} opdateret for ${playersUpdated} spillere.`)
        }
      } else {
        showToast('Americano/Mexicano afsluttet.')
      }
      onProfileStatsRefresh?.()
      void notifyAmericanoTournamentCompleted(tournament, currentUserId)
      onSaved()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Kunne ikke afslutte: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  const userIdByPartId = new Map<string, string>()
  participants.forEach((p) => userIdByPartId.set(p.id, p.user_id))

  const matchesDisplay = [...matches].sort((a, b) => {
    if (a.round_number !== b.round_number) return a.round_number - b.round_number
    return a.court_index - b.court_index
  })

  const activeRoundNumber = matchesDisplay.reduce((activeRound, m) => {
    if (activeRound !== null) return activeRound
    // If not locked, or locked but unlocked in UI temporarily
    if (!isMatchResultLocked(m) || unlockedIds.has(m.id)) return m.round_number
    return null
  }, null as number | null)

  const activeRoundRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && activeRoundRef.current) {
      activeRoundRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [loading, activeRoundNumber])

  const leaderboard = buildLeaderboard(participants, matches, scores, P)

  if (loading) {
    return <div style={{ fontSize: 12, color: c.muted, marginTop: 12 }}>Henter kampe…</div>
  }

  // ── Afledte værdier til faner og "Din bane"-kort ──
  const myPartId = participants.find((p) => String(p.user_id) === String(currentUserId))?.id ?? null
  const isMyMatch = (m: AmericanoMatchRow) =>
    myPartId != null && [m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2].includes(myPartId)
  const myMatchesDisplay = matchesDisplay
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => isMyMatch(m))
  const activeRoundMatches = activeRoundNumber != null
    ? matchesDisplay.filter((m) => m.round_number === activeRoundNumber)
    : []
  const activeRoundSaved = activeRoundMatches.filter((m) => isMatchResultLocked(m) && !unlockedIds.has(m.id)).length
  const myActiveMatchIdx = activeRoundNumber != null
    ? matchesDisplay.findIndex((m) => m.round_number === activeRoundNumber && isMyMatch(m))
    : -1
  const myActiveMatch = myActiveMatchIdx >= 0 ? matchesDisplay[myActiveMatchIdx] : null
  const myOnCourtNow = myActiveMatch
    ? userIsOnCourtInAmericanoMatch(myActiveMatch, userIdByPartId, currentUserId)
    : false

  const avatarOfPart = (pid: string) => {
    const uid = userIdByPartId.get(pid)
    return (uid && avatarByUserId[String(uid)]) || '🎾'
  }
  const firstName = (pid: string) => {
    const full = nameByPartId(pid)
    if (myPartId != null && pid === myPartId) return 'Dig'
    return String(full).trim().split(/\s+/)[0]
  }

  // Point i seneste afsluttede runde pr. spiller → "Sidste kamp: ±X"
  const lockedRoundNums = matchesDisplay.filter((m) => isMatchResultLocked(m)).map((m) => m.round_number)
  const lastRoundNum = lockedRoundNums.length ? Math.max(...lockedRoundNums) : null
  const lastDeltaByPartId = new Map<string, number>()
  if (lastRoundNum != null) {
    for (const m of matchesDisplay.filter((m) => m.round_number === lastRoundNum)) {
      const r = resolvedMatchScores(m, scores, P)
      if (!r) continue
      const add = (pid: string, pts: number) => lastDeltaByPartId.set(pid, (lastDeltaByPartId.get(pid) ?? 0) + pts)
      add(m.team_a_p1, r.a); add(m.team_a_p2, r.a)
      add(m.team_b_p1, r.b); add(m.team_b_p2, r.b)
    }
  }

  /** On-court-spiller (ikke opretter) må indberette egen bane i aktiv, ulåst runde. */
  const canPlayerReport = (m: AmericanoMatchRow) =>
    !isCreator &&
    m.round_number === activeRoundNumber &&
    !isMatchResultLocked(m) &&
    userIsOnCourtInAmericanoMatch(m, userIdByPartId, currentUserId)

  const TeamTile = ({ p1, p2, dim = false, highlight = false }: { p1: string; p2: string; dim?: boolean; highlight?: boolean }) => (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex' }}>
        <AvatarCircle avatar={avatarOfPart(p1)} size={34} emojiSize="14px" style={{ border: '2px solid var(--pm-surface)', background: 'var(--pm-border)' }} />
        <AvatarCircle avatar={avatarOfPart(p2)} size={34} emojiSize="14px" style={{ border: '2px solid var(--pm-surface)', background: 'var(--pm-border)', marginLeft: -10 }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: highlight ? 800 : 700, color: dim ? c.muted : c.text, textAlign: 'center', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
        {firstName(p1)} & {firstName(p2)}
      </div>
    </div>
  )

  // Mockup-trofast score-/VS-kort. Bruges på tværs af faner og i "Din bane".
  const renderScoreCard = (m: AmericanoMatchRow, displayIdx: number, opts: { hideHeader?: boolean } = {}) => {
    const locked = isMatchResultLocked(m) && !unlockedIds.has(m.id)
    const canEdit = (canManage && !locked) || canPlayerReport(m)
    const editing = canEdit && entryOpenId === m.id
    const resolved = resolvedMatchScores(m, scores, P)
    const aWins = resolved != null && resolved.a > resolved.b
    const bWins = resolved != null && resolved.b > resolved.a
    const onCourt = userIsOnCourtInAmericanoMatch(m, userIdByPartId, currentUserId)
    const isActiveRound = m.round_number === activeRoundNumber
    const isFirstInActiveRound =
      isActiveRound && displayIdx === matchesDisplay.findIndex((x) => x.round_number === activeRoundNumber)
    const s = scores[m.id] || { a: '', b: '' }
    const draftScore = getDraftScore(m.id)
    const canConfirmSave = Boolean(draftScore?.valid)
    const scorePreview = draftScore?.label || `${s.a.trim() || '—'}-${s.b.trim() || '—'}`
    const statusTag = locked
      ? { label: 'Afsluttet', bg: 'var(--pm-success-bg)', color: 'var(--pm-success)' }
      : isActiveRound
        ? { label: 'Aktiv nu', bg: 'var(--pm-warning-bg)', color: 'var(--pm-warning)' }
        : { label: 'Afventer', bg: 'var(--pm-surface-muted)', color: c.muted }

    return (
      <div
        key={m.id}
        ref={isFirstInActiveRound ? activeRoundRef : null}
        style={{
          background: 'var(--pm-surface)',
          border: onCourt && isActiveRound ? '2px solid var(--pm-accent)' : `1px solid ${c.line}`,
          borderRadius: 14,
          padding: '12px 14px',
          marginBottom: 12,
          boxShadow: onCourt && isActiveRound ? 'var(--pm-shadow-soft)' : 'none',
        }}
      >
        {!opts.hideHeader && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.muted }}>
              Bane {m.court_index + 1} · Runde {m.round_number}
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: statusTag.bg, color: statusTag.color }}>
              {statusTag.label}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TeamTile p1={m.team_a_p1} p2={m.team_a_p2} dim={bWins} highlight={aWins} />
          <div style={{ flexShrink: 0, minWidth: 64, textAlign: 'center' }}>
            {editing ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <input
                  type="text" inputMode="numeric" pattern="[0-9]*" value={s.a}
                  onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); setScores((prev) => ({ ...prev, [m.id]: { a: v, b: prev[m.id]?.b ?? '' } })) }}
                  onBlur={() => handleScoreBlur(m, 'a')}
                  aria-label="Point hold A"
                  style={{ width: 40, padding: '6px 2px', borderRadius: 8, border: `2px solid ${c.accent}`, fontSize: 16, fontWeight: 800, textAlign: 'center', fontFamily: font, color: c.accent, background: 'var(--pm-accent-bg)', outline: 'none' }}
                />
                <span style={{ fontWeight: 800, color: c.muted }}>-</span>
                <input
                  type="text" inputMode="numeric" pattern="[0-9]*" value={s.b}
                  onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); setScores((prev) => ({ ...prev, [m.id]: { a: prev[m.id]?.a ?? '', b: v } })) }}
                  onBlur={() => handleScoreBlur(m, 'b')}
                  aria-label="Point hold B"
                  style={{ width: 40, padding: '6px 2px', borderRadius: 8, border: `2px solid ${c.accent}`, fontSize: 16, fontWeight: 800, textAlign: 'center', fontFamily: font, color: c.accent, background: 'var(--pm-accent-bg)', outline: 'none' }}
                />
              </div>
            ) : resolved != null ? (
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: c.text, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                  {resolved.a} - {resolved.b}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, color: c.muted, letterSpacing: '0.08em' }}>SCORE</div>
              </div>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, border: `1px solid ${c.line}`, borderRadius: 999, padding: '3px 0' }}>vs</div>
            )}
          </div>
          <TeamTile p1={m.team_b_p1} p2={m.team_b_p2} dim={aWins} highlight={bWins} />
        </div>

        {editing && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={saving || !canConfirmSave}
              onClick={() => { void saveRow({ ...m } as AmericanoMatchRow).then(() => setEntryOpenId(null)) }}
              style={{ flex: 2, fontFamily: font, fontSize: 13, fontWeight: 700, padding: '10px', borderRadius: 10, border: 'none', background: canConfirmSave ? 'var(--pm-accent)' : 'var(--pm-surface-muted)', color: canConfirmSave ? c.onAccent : c.muted, cursor: saving || !canConfirmSave ? 'not-allowed' : 'pointer' }}
            >
              Gem ({scorePreview})
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => { setEntryOpenId(null); setScores((prev) => ({ ...prev, [m.id]: { a: m.team_a_score != null ? String(m.team_a_score) : '', b: m.team_b_score != null ? String(m.team_b_score) : '' } })) }}
              style={{ flex: 1, fontFamily: font, fontSize: 13, fontWeight: 600, padding: '10px', borderRadius: 10, border: `1px solid ${c.line}`, background: 'var(--pm-surface)', color: c.muted, cursor: 'pointer' }}
            >
              Annullér
            </button>
          </div>
        )}

        {!editing && canEdit && (
          <button
            type="button"
            onClick={() => setEntryOpenId(m.id)}
            style={{ marginTop: 12, width: '100%', fontFamily: font, fontSize: 13, fontWeight: 700, padding: '11px', borderRadius: 10, border: 'none', background: 'var(--pm-accent)', color: c.onAccent, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <ClipboardEdit size={16} aria-hidden />
            {resolved != null ? 'Ret resultat' : 'Indberet Resultat'}
          </button>
        )}

        {canManage && locked && entryOpenId !== m.id && (
          <button
            type="button"
            disabled={saving}
            onClick={() => { setUnlockedIds((prev) => new Set(prev).add(m.id)); setScores((prev) => ({ ...prev, [m.id]: { a: '', b: '' } })); setEntryOpenId(m.id) }}
            style={{ marginTop: 10, width: '100%', fontFamily: font, fontSize: 12, fontWeight: 600, padding: '8px', borderRadius: 10, border: `1px solid ${c.accent}`, background: 'var(--pm-surface)', color: c.accent, cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Pencil size={14} aria-hidden /> Ret resultat
          </button>
        )}
      </div>
    )
  }

  const roundStatusLabel = activeRoundNumber != null
    ? `Runde ${activeRoundNumber} · ${activeRoundSaved}/${activeRoundMatches.length} baner indberettet`
    : (matchesDisplay.length > 0 ? 'Alle runder spillet' : 'Ingen runder endnu')

  const rankCircleStyle = (idx: number): CSSProperties => {
    const medal = idx === 0
      ? { bg: 'var(--pm-podium-gold)', fg: '#fff' }
      : idx === 1
        ? { bg: 'var(--pm-podium-silver)', fg: '#fff' }
        : idx === 2
          ? { bg: 'var(--pm-podium-bronze)', fg: '#fff' }
          : { bg: 'var(--pm-surface-muted)', fg: c.muted }
    return {
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 800, background: medal.bg, color: medal.fg,
    }
  }

  const leaderboardList = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {leaderboard.length === 0 ? (
        <div className="pm-data-empty-note">Ingen spillere endnu.</div>
      ) : (
        leaderboard.map((row, idx) => {
          const isMe = myPartId != null && row.id === myPartId
          const delta = lastDeltaByPartId.get(row.id)
          return (
            <div
              key={row.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 12,
                background: isMe ? 'var(--pm-accent-bg)' : 'var(--pm-surface)',
                border: `1px solid ${isMe ? 'var(--pm-accent)' : c.line}`,
              }}
            >
              <div style={rankCircleStyle(idx)}>{idx + 1}</div>
              <AvatarCircle avatar={avatarOfPart(row.id)} size={34} emojiSize="14px" style={{ background: 'var(--pm-border)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: isMe ? 800 : 700, color: c.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                  {isMe ? <span style={{ fontSize: 9, fontWeight: 800, color: c.onAccent, background: c.accent, padding: '1px 6px', borderRadius: 999, letterSpacing: '0.04em' }}>DIG</span> : null}
                </div>
                {delta != null ? (
                  <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>Sidste runde: {delta >= 0 ? '+' : ''}{delta}</div>
                ) : null}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: isMe ? c.accent : c.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{row.points}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: c.muted, letterSpacing: '0.08em' }}>PTS</div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  const creatorActions = canManage ? (
    <>
      {pendingNextMexicanoRound ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            void (async () => {
              setSaving(true)
              try {
                const { error } = await supabase
                  .from('americano_matches')
                  .insert(pendingNextMexicanoRound!)
                if (error) throw error
                const roundNum = Array.isArray(pendingNextMexicanoRound) ? pendingNextMexicanoRound[0]?.round_number : (pendingNextMexicanoRound as { round_number?: number })?.round_number
                showToast(`Runde ${roundNum} er genereret.`)
                await load()
                onSaved()
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e)
                showToast('Kunne ikke generere runde: ' + msg)
              } finally {
                setSaving(false)
              }
            })()
          }}
          style={{
            marginTop: 12,
            fontFamily: font,
            fontSize: 13,
            fontWeight: 700,
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--pm-accent)',
            color: c.onAccent,
            cursor: saving ? 'wait' : 'pointer',
            width: '100%',
          }}
        >
          Generér runde {Array.isArray(pendingNextMexicanoRound) ? pendingNextMexicanoRound[0]?.round_number : (pendingNextMexicanoRound as { round_number?: number } | null)?.round_number}
        </button>
      ) : null}
      <button
        type="button"
        disabled={saving}
        onClick={completeTournament}
        style={{
          marginTop: 14,
          fontFamily: font,
          fontSize: 12,
          fontWeight: 600,
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid var(--pm-border)',
          background: 'var(--pm-surface)',
          color: 'var(--pm-text-mid)',
          cursor: saving ? 'wait' : 'pointer',
        }}
      >
        Afslut Americano/Mexicano (alle resultater indtastet)
      </button>
    </>
  ) : null

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${c.line}`, fontFamily: font }}>
      {/* Header + rundestatus (erstatter nedtællings-ur) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>Resultater ({formatLabel}-ELO)</div>
        <div style={{ fontSize: 11.5, color: c.muted, marginTop: 2 }}>
          {roundStatusLabel}{mexicanoProgress ? ` · ${mexicanoProgress}` : ''}
        </div>
      </div>

      {/* Faner */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: 'var(--pm-surface-muted)', borderRadius: 10, padding: 4 }}>
        {([['stilling', 'Stilling'], ['mine', 'Mine Kampe'], ['alle', 'Alle Resultater']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: font,
              fontSize: 12.5,
              fontWeight: 700,
              background: tab === id ? 'var(--pm-surface)' : 'transparent',
              color: tab === id ? c.text : c.muted,
              boxShadow: tab === id ? 'var(--pm-shadow-soft)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── STILLING ── */}
      {tab === 'stilling' ? (
        <>
          {myActiveMatch ? (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 8 }}>
                {myOnCourtNow ? `🎾 Din bane: Bane ${myActiveMatch.court_index + 1}` : 'Din runde'}
              </div>
              {myOnCourtNow ? (
                renderScoreCard(myActiveMatch, myActiveMatchIdx, { hideHeader: true })
              ) : (
                <div style={{ padding: '18px', textAlign: 'center', color: c.muted, fontSize: 13, background: 'var(--pm-surface)', border: `1px solid ${c.line}`, borderRadius: 14 }}>
                  ☕ Du sidder over i denne runde
                </div>
              )}
            </div>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: c.text, fontSize: 14 }}>Live Stilling</div>
            <div style={{ fontSize: 11, color: c.muted }}>Sum af kampoint</div>
          </div>
          {leaderboardList}
        </>
      ) : null}

      {/* ── MINE KAMPE ── */}
      {tab === 'mine' ? (
        <div>
          {myMatchesDisplay.length === 0 ? (
            <div className="pm-data-empty-note">Du har ingen kampe endnu.</div>
          ) : (
            myMatchesDisplay.map(({ m, i }) => renderScoreCard(m, i))
          )}
        </div>
      ) : null}

      {/* ── ALLE RESULTATER ── */}
      {tab === 'alle' ? (
        <>
          {matchesDisplay.length === 0 ? (
            <div className="pm-data-empty-note" style={{ marginBottom: 8 }}>
              {isMexicano
                ? 'Ingen kampe endnu — start Americano/Mexicano for at oprette runde 1.'
                : 'Kampplan er ikke genereret endnu.'}
            </div>
          ) : (
            [...new Set(matchesDisplay.map((m) => m.round_number))]
              .sort((a, b) => b - a)
              .map((roundNum) => {
                const isLatest = roundNum === Math.max(...matchesDisplay.map((m) => m.round_number))
                return (
                  <div key={roundNum} style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>Runde {roundNum}</div>
                      {isLatest ? (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--pm-warning-bg)', color: 'var(--pm-warning)' }}>Seneste</span>
                      ) : null}
                    </div>
                    {matchesDisplay
                      .map((m, i) => ({ m, i }))
                      .filter(({ m }) => m.round_number === roundNum)
                      .map(({ m, i }) => renderScoreCard(m, i))}
                  </div>
                )
              })
          )}
        </>
      ) : null}

      {creatorActions}
    </div>
  )
}

