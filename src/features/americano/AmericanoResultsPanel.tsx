import { useCallback, useEffect, useState, useRef } from 'react'
import { Check, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { AmericanoMatchRow, AmericanoParticipant, AmericanoTournament } from './types'
import {
  americanoOutcomeColors,
  americanoOutcomeForUserInMatch,
  americanoViewerStatusLabel,
  userIsOnCourtInAmericanoMatch,
} from './americanoOutcomeColors'

const font = 'var(--pm-font)'

const c = {
  line: 'var(--pm-border)',
  muted: 'var(--pm-text-light)',
  text: 'var(--pm-text)',
  avatarBg: 'var(--pm-border)',
  avatarText: 'var(--pm-text-light)',
  accent: 'var(--pm-accent)',
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
          border: '2px solid #fff',
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
          border: '2px solid #fff',
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
  showCheckForUser: boolean
  userIdByPartId: Map<string, string>
  currentUserId: string
  inputElement?: React.ReactNode
  teamLabel?: string
}) {
  const scoreStr = score != null && !Number.isNaN(score) ? String(score) : '—'
  const nameColor = outcome === 'loss' ? c.muted : c.text
  const scoreColor = outcome === 'loss' ? c.muted : c.text
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

export function AmericanoResultsPanel({
  tournament,
  currentUserId,
  onSaved,
  showToast,
  onProfileStatsRefresh,
}: Props) {
  const [participants, setParticipants] = useState<AmericanoParticipant[]>([])
  const [matches, setMatches] = useState<AmericanoMatchRow[]>([])
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  /** Midlertidigt ulåst af opretter — nulstilles ved genindlæsning */
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(() => new Set())

  const ppm = Number(tournament.points_per_match)
  const P: 16 | 24 | 32 =
    ppm === 16 || ppm === 24 || ppm === 32 ? ppm : 16
  const isCreator = String(tournament.creator_id) === String(currentUserId)

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
    } catch (e) {
      console.warn(e)
    } finally {
      setLoading(false)
    }
  }, [tournament.id])

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

    if (newA !== '' && newB !== '') {
      const valA = parseInt(newA, 10)
      const valB = parseInt(newB, 10)
      if (isValidAmericanoScore(valA, valB, P)) {
        saveRow({ ...m } as AmericanoMatchRow)
      }
    }
  }

  const completeTournament = async () => {
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
      const { error } = await supabase
        .from('americano_tournaments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', tournament.id)
      if (error) throw error
      showToast('Turnering afsluttet.')
      onProfileStatsRefresh?.()
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
    return <div style={{ fontSize: 12, color: '#8494A7', marginTop: 12 }}>Henter kampe…</div>
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${c.line}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: c.text, fontFamily: font }}>
        Resultater (ingen ELO)
      </div>
      <p style={{ fontSize: 11, color: c.muted, margin: '0 0 14px', lineHeight: 1.55, fontFamily: font }}>
        {isCreator ? (
          <>
            <strong style={{ color: '#475569' }}>Format {P} point:</strong> De to tal skal give <strong>{P} i alt</strong> (fx 10–6 eller 8–8). Skriver du kun ét hold, udfyldes det andet. Efter{' '}
            <strong>Gem</strong> er kampen låst — tryk på blyanten for at rette. Uafgjort tæller ikke som V/T på profilen.
          </>
        ) : (
          <>
            <strong style={{ color: '#475569' }}>Format {P} point:</strong> Her ser du stilling og alle kampe. Kun{' '}
            <strong>opretteren</strong> kan indtaste og rette resultater.
          </>
        )}
      </p>
      <div className="pm-card-subpanel" style={{ padding: '14px 16px', marginBottom: 8, fontFamily: font }}>
        <div style={{ fontWeight: 700, marginBottom: 10, color: c.text, fontSize: 12 }}>Stilling (sum af kampoint)</div>
        <div className="pm-data-table" style={{ ['--pm-table-cols']: '30px 1fr 64px' }}>
          <div className="pm-data-table-head">
            <div className="pm-data-table-cell-head" style={{ textAlign: 'center' }}>#</div>
            <div className="pm-data-table-cell-head">Spiller</div>
            <div className="pm-data-table-cell-head" style={{ textAlign: 'center' }}>Point</div>
          </div>
          {leaderboard.map((row, idx) => (
            <div key={row.id} className="pm-data-table-row">
              <div className="pm-data-table-cell" style={{ textAlign: 'center', color: idx < 3 ? '#D97706' : c.muted, fontWeight: 700 }}>
                {idx + 1}
              </div>
              <div className="pm-data-table-cell" style={{ fontSize: 13, fontWeight: 600 }}>
                {row.name}
              </div>
              <div className="pm-data-table-cell" style={{ textAlign: 'center', fontWeight: 700, color: c.text }}>
                {row.points}
              </div>
            </div>
          ))}
        </div>
        {leaderboard.length === 0 && (
          <div className="pm-data-empty-note" style={{ marginTop: 10 }}>
            Ingen spillere endnu.
          </div>
        )}
      </div>

      <div style={{ fontFamily: font }}>
        {matchesDisplay.length === 0 && (
          <div className="pm-data-empty-note" style={{ marginBottom: 8 }}>
            Kampplan er ikke genereret endnu.
          </div>
        )}
        {matchesDisplay.map((m, displayIdx) => {
          const s = scores[m.id] || { a: '', b: '' }
          const locked = isMatchResultLocked(m) && !unlockedIds.has(m.id)
          const n1 = nameByPartId(m.team_a_p1)
          const n2 = nameByPartId(m.team_a_p2)
          const n3 = nameByPartId(m.team_b_p1)
          const n4 = nameByPartId(m.team_b_p2)
          const resolved = resolvedMatchScores(m, scores, P)
          const displayA = resolved?.a ?? null
          const displayB = resolved?.b ?? null
          const hasDisplayScores = resolved != null
          const isTie = hasDisplayScores && displayA === displayB
          const aWins = hasDisplayScores && resolved.a > resolved.b
          const bWins = hasDisplayScores && resolved.b > resolved.a
          const outcomeA: TeamOutcome = !hasDisplayScores ? 'tie' : isTie ? 'tie' : aWins ? 'win' : 'loss'
          const outcomeB: TeamOutcome = !hasDisplayScores ? 'tie' : isTie ? 'tie' : bWins ? 'win' : 'loss'
          const matchNum = displayIdx + 1
          const isLastInPlan = displayIdx === matchesDisplay.length - 1
          const effectiveM =
            resolved != null
              ? { ...m, team_a_score: resolved.a, team_b_score: resolved.b }
              : m
          const viewerOutcome = americanoOutcomeForUserInMatch(effectiveM, userIdByPartId, currentUserId, P)
          const onCourt = userIsOnCourtInAmericanoMatch(m, userIdByPartId, currentUserId)
          const statusLabel = americanoViewerStatusLabel(viewerOutcome, onCourt)
          const palKey =
            viewerOutcome === 'win' ? 'win' : viewerOutcome === 'loss' ? 'loss' : viewerOutcome === 'tie' ? 'tie' : 'neutral'
          const matchPal = americanoOutcomeColors[palKey]
          const isActiveRound = m.round_number === activeRoundNumber
              const isPastRound = activeRoundNumber !== null && m.round_number < activeRoundNumber
              const isFirstInActiveRound = isActiveRound && displayIdx === matchesDisplay.findIndex(x => x.round_number === activeRoundNumber)
              
              let containerOpacity = isPastRound ? 0.6 : 1
              if (locked && !isActiveRound) containerOpacity = 0.65 

          return (
            <div
              key={m.id}
              ref={isFirstInActiveRound ? activeRoundRef : null}
              style={{
                marginBottom: 14,
                padding: isActiveRound ? '14px 14px 6px' : '12px 12px 4px',
                borderRadius: 10,
                background: isActiveRound ? '#FFFBEB' : matchPal.bg,
                border: isActiveRound ? `2px solid #F59E0B` : `1px solid ${matchPal.border}`,
                boxShadow: isActiveRound ? '0 4px 14px rgba(245, 158, 11, 0.15)' : 'none',
                opacity: containerOpacity,
                transition: 'opacity 0.2s',
              }}
            >
              {isActiveRound && (
                <div style={{
                  background: onCourt ? '#10B981' : '#E2E8F0',
                  color: onCourt ? '#fff' : '#475569',
                  padding: '6px 12px',
                  borderRadius: '6px 6px 0 0',
                  margin: '-14px -14px 10px -14px',
                  fontSize: 13,
                  fontWeight: 800,
                  textAlign: 'center',
                  letterSpacing: '0.02em',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  {onCourt ? '🎾 DU SPILLER NU (Bane ' + (m.court_index+1) + ')' : '☕ DU SIDDER OVER I DENNE RUNDE'}
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 10,
                  paddingTop: 16,
                  paddingBottom: 4,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: c.text, lineHeight: 1.3 }}>
                    #{matchNum}
                    {isLastInPlan ? ' · Sidste i plan' : ''}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: matchPal.text,
                      marginTop: 6,
                      lineHeight: 1.35,
                    }}
                  >
                    Runde {m.round_number} - {statusLabel}
                    {isCreator ? (
                      <span style={{ fontWeight: 500, color: c.muted }}> · Registreret af dig</span>
                    ) : null}
                  </div>
                </div>
                {isCreator && locked && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      disabled={saving}
                      title="Ret resultat"
                      aria-label="Ret resultat"
                      onClick={() => {
                        setUnlockedIds((prev) => new Set(prev).add(m.id))
                        setScores((prev) => ({ ...prev, [m.id]: { a: '', b: '' } }))
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: `2px solid ${c.accent}`,
                        background: 'var(--pm-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: saving ? 'wait' : 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <Pencil size={18} color={c.accent} strokeWidth={2} />
                    </button>
                  </div>
                )}
                {isCreator && !locked && (
                  <div style={{ fontSize: 10, color: c.muted, fontWeight: 600, fontStyle: 'italic', textAlign: 'right', flexShrink: 0 }}>
                    Skriv point →<br />auto-gem
                  </div>
                )}
              </div>

              <div style={{ paddingBottom: locked ? 8 : 4 }}>
                <TeamBlock
                  name1={n1}
                  name2={n2}
                  pid1={m.team_a_p1}
                  pid2={m.team_a_p2}
                  score={displayA}
                  outcome={outcomeA}
                  showCheckForUser
                  userIdByPartId={userIdByPartId}
                  currentUserId={currentUserId}
                  teamLabel={`Hold A · ${n1.split(' ')[0]} & ${n2.split(' ')[0]}`}
                  inputElement={
                    isCreator && !locked ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={s.a}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9]/g, '')
                          setScores((prev) => ({ ...prev, [m.id]: { ...prev[m.id], a: v, b: prev[m.id]?.b ?? '' } }))
                        }}
                        onBlur={() => handleScoreBlur(m, 'a')}
                        placeholder="—"
                        aria-label={`Point for ${n1} & ${n2}`}
                        style={{
                          width: 56,
                          padding: '6px 4px',
                          borderRadius: 8,
                          border: `2px solid ${c.accent}`,
                          fontSize: 18,
                          fontWeight: 800,
                          textAlign: 'center',
                          fontFamily: font,
                          color: c.accent,
                          background: '#F0F7FF',
                          outline: 'none',
                        }}
                      />
                    ) : undefined
                  }
                />
                <div style={{ height: 1, background: c.line, marginLeft: 56 }} />
                <TeamBlock
                  name1={n3}
                  name2={n4}
                  pid1={m.team_b_p1}
                  pid2={m.team_b_p2}
                  score={displayB}
                  outcome={outcomeB}
                  showCheckForUser
                  userIdByPartId={userIdByPartId}
                  currentUserId={currentUserId}
                  teamLabel={`Hold B · ${n3.split(' ')[0]} & ${n4.split(' ')[0]}`}
                  inputElement={
                    isCreator && !locked ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={s.b}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9]/g, '')
                          setScores((prev) => ({ ...prev, [m.id]: { ...prev[m.id], a: prev[m.id]?.a ?? '', b: v } }))
                        }}
                        onBlur={() => handleScoreBlur(m, 'b')}
                        placeholder="—"
                        aria-label={`Point for ${n3} & ${n4}`}
                        style={{
                          width: 56,
                          padding: '6px 4px',
                          borderRadius: 8,
                          border: `2px solid ${c.accent}`,
                          fontSize: 18,
                          fontWeight: 800,
                          textAlign: 'center',
                          fontFamily: font,
                          color: c.accent,
                          background: '#F0F7FF',
                          outline: 'none',
                        }}
                      />
                    ) : undefined
                  }
                />
              </div>
            </div>
          )
        })}
      </div>
      {isCreator && (
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
          Afslut turnering (alle resultater indtastet)
        </button>
      )}
    </div>
  )
}
