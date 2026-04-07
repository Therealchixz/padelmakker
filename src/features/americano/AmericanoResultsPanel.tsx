import { useCallback, useEffect, useState } from 'react'
import { Check, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { AmericanoMatchRow, AmericanoParticipant, AmericanoTournament } from './types'

const font = "'Inter', sans-serif"

const c = {
  line: '#E8ECF1',
  muted: '#94A3B8',
  text: '#0F172A',
  softBg: '#F8FAFC',
  avatarBg: '#E2E8F0',
  avatarText: '#64748B',
  accent: '#2563EB',
} as const

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
          fontSize: scoreSize,
          fontWeight: scoreWeight,
          letterSpacing: '-0.03em',
          color: scoreColor,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
          minWidth: 36,
          textAlign: 'right',
          fontFamily: font,
        }}
      >
        {scoreStr}
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
        sc[m.id] = {
          a: m.team_a_score != null ? String(m.team_a_score) : '',
          b: m.team_b_score != null ? String(m.team_b_score) : '',
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

  const completeTournament = async () => {
    const incomplete = matches.some((m) => {
      const s = scores[m.id]
      if (!s) return true
      let aStr = s.a.trim()
      let bStr = s.b.trim()
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
        <strong style={{ color: '#475569' }}>Format {P} point:</strong> De to tal skal give <strong>{P} i alt</strong> (fx 10–6 eller 8–8). Skriver du kun ét hold, udfyldes det andet. Efter{' '}
        <strong>Gem</strong> er kampen låst — tryk på blyanten for at rette. Uafgjort tæller ikke som V/T på profilen.
      </p>
      <div
        style={{
          background: c.softBg,
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 8,
          border: `1px solid ${c.line}`,
          fontFamily: font,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10, color: c.text, fontSize: 12 }}>Stilling (sum af kampoint)</div>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.65, fontSize: 13, color: '#334155' }}>
          {leaderboard.map((row) => (
            <li key={row.id}>
              <span style={{ color: c.text }}>{row.name}</span>{' '}
              <span style={{ color: c.muted, fontWeight: 500 }}>—</span>{' '}
              <strong style={{ color: c.text }}>{row.points}</strong> point
            </li>
          ))}
        </ol>
        {leaderboard.length === 0 && <div style={{ fontSize: 12, color: c.muted }}>Ingen spillere endnu.</div>}
      </div>

      <div style={{ fontFamily: font }}>
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

          return (
            <div key={m.id} style={{ borderBottom: `1px solid ${c.line}` }}>
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
                  <div style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>
                    Runde {m.round_number}
                    {isCreator ? ' · Registreret af dig' : ''}
                  </div>
                </div>
                {isCreator && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    {locked ? (
                      <button
                        type="button"
                        disabled={saving}
                        title="Ret resultat"
                        aria-label="Ret resultat"
                        onClick={() => setUnlockedIds((prev) => new Set(prev).add(m.id))}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          border: `2px solid ${c.accent}`,
                          background: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: saving ? 'wait' : 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <Pencil size={18} color={c.accent} strokeWidth={2} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => saveRow(m)}
                        style={{
                          fontFamily: font,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: 'none',
                          background: c.accent,
                          color: '#fff',
                          cursor: saving ? 'wait' : 'pointer',
                        }}
                      >
                        Gem
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={{ paddingBottom: locked ? 8 : 4 }}>
                {hasDisplayScores && isTie && (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 4,
                    }}
                  >
                    Uafgjort
                  </div>
                )}
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
                />
              </div>

              {!locked && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 10,
                    paddingBottom: 12,
                    paddingTop: 4,
                  }}
                >
                  <input
                    type="number"
                    min={0}
                    max={P}
                    value={s.a}
                    onChange={(e) =>
                      setScores((prev) => ({ ...prev, [m.id]: { ...prev[m.id], a: e.target.value, b: prev[m.id]?.b ?? '' } }))
                    }
                    onBlur={() => {
                      const row = scores[m.id]
                      if (!row || row.a.trim() === '') return
                      if (row.b.trim() !== '') return
                      const o = complementFromOneSide(row.a, P, showToast)
                      if (o != null) {
                        setScores((prev) => ({
                          ...prev,
                          [m.id]: { ...prev[m.id], a: prev[m.id]?.a?.trim() ?? row.a.trim(), b: String(o) },
                        }))
                      }
                    }}
                    placeholder="Hold A"
                    aria-label="Hold A point"
                    style={{
                      width: 72,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${c.line}`,
                      fontSize: 15,
                      fontWeight: 600,
                      fontFamily: font,
                    }}
                  />
                  <span style={{ fontWeight: 700, color: c.muted }}>—</span>
                  <input
                    type="number"
                    min={0}
                    max={P}
                    value={s.b}
                    onChange={(e) =>
                      setScores((prev) => ({ ...prev, [m.id]: { ...prev[m.id], a: prev[m.id]?.a ?? '', b: e.target.value } }))
                    }
                    onBlur={() => {
                      const row = scores[m.id]
                      if (!row || row.b.trim() === '') return
                      if (row.a.trim() !== '') return
                      const o = complementFromOneSide(row.b, P, showToast)
                      if (o != null) {
                        setScores((prev) => ({
                          ...prev,
                          [m.id]: { a: String(o), b: prev[m.id]?.b?.trim() ?? row.b.trim() },
                        }))
                      }
                    }}
                    placeholder="Hold B"
                    aria-label="Hold B point"
                    style={{
                      width: 72,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${c.line}`,
                      fontSize: 15,
                      fontWeight: 600,
                      fontFamily: font,
                    }}
                  />
                  <span style={{ fontSize: 11, color: c.muted, flexBasis: '100%' }}>Sum = {P} (auto)</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
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
          border: '1px solid #D5DDE8',
          background: '#fff',
          color: '#3E4C63',
          cursor: saving ? 'wait' : 'pointer',
        }}
      >
        Afslut turnering (alle resultater indtastet)
      </button>
    </div>
  )
}
