import { useCallback, useEffect, useMemo, useState } from 'react'
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

function TeamBlock({
  name1,
  name2,
  pid1,
  pid2,
  score,
  won,
  showCheckForUser,
  userIdByPartId,
  currentUserId,
}: {
  name1: string
  name2: string
  pid1: string
  pid2: string
  score: number | null
  won: boolean
  showCheckForUser: boolean
  userIdByPartId: Map<string, string>
  currentUserId: string
}) {
  const scoreStr = score != null && !Number.isNaN(score) ? String(score) : '—'
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
            color: won ? c.text : c.muted,
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
            color: won ? c.text : c.muted,
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
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: won ? c.text : c.muted,
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

/** Faktiske kampoint (hvert vundet rally = 1 til holdet). Ikke krav om at vinderen rammer målet P — det er spillets format på banen (fx først til 16), slutstilling kan være 10–6. */
function isValidAmericanoScore(a: number, b: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false
  return a !== b
}

function resolvedMatchScores(
  m: AmericanoMatchRow,
  sc: Record<string, { a: string; b: string }>
): { a: number; b: number } | null {
  const row = sc[m.id]
  if (row && row.a !== '' && row.b !== '') {
    const a = parseInt(row.a, 10)
    const b = parseInt(row.b, 10)
    if (isValidAmericanoScore(a, b)) return { a, b }
  }
  if (m.team_a_score != null && m.team_b_score != null) {
    const a = m.team_a_score
    const b = m.team_b_score
    if (isValidAmericanoScore(a, b)) return { a, b }
  }
  return null
}

function buildLeaderboard(
  participants: AmericanoParticipant[],
  matches: AmericanoMatchRow[],
  scores: Record<string, { a: string; b: string }>
): { id: string; name: string; points: number }[] {
  const totals = new Map<string, number>()
  participants.forEach((p) => totals.set(p.id, 0))
  for (const m of matches) {
    const r = resolvedMatchScores(m, scores)
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

  const P = tournament.points_per_match
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
    const a = parseInt(s.a, 10)
    const b = parseInt(s.b, 10)
    if (s.a === '' || s.b === '') {
      showToast('Udfyld begge point.')
      return
    }
    if (!isValidAmericanoScore(a, b)) {
      showToast('Ugyldigt: to hele tal ≥ 0, og ikke uafgjort.')
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
      const a = parseInt(s.a, 10)
      const b = parseInt(s.b, 10)
      return !isValidAmericanoScore(a, b)
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

  if (loading) {
    return <div style={{ fontSize: 12, color: '#8494A7', marginTop: 12 }}>Henter kampe…</div>
  }

  const leaderboard = buildLeaderboard(participants, matches, scores)

  const userIdByPartId = useMemo(() => {
    const m = new Map<string, string>()
    participants.forEach((p) => m.set(p.id, p.user_id))
    return m
  }, [participants])

  const matchesDisplay = useMemo(() => {
    return [...matches].sort((a, b) => {
      if (b.round_number !== a.round_number) return b.round_number - a.round_number
      return b.court_index - a.court_index
    })
  }, [matches])

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${c.line}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: c.text, fontFamily: font }}>
        Resultater (ingen ELO)
      </div>
      <p style={{ fontSize: 11, color: c.muted, margin: '0 0 14px', lineHeight: 1.55, fontFamily: font }}>
        <strong style={{ color: '#475569' }}>Format {P} point:</strong> Indtast den faktiske slutstilling (fx 10–6). Summen vises ovenfor. Efter{' '}
        <strong>Gem</strong> er kampen låst — tryk på blyanten for at rette.
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
          const a = parseInt(s.a, 10)
          const b = parseInt(s.b, 10)
          const hasValid = isValidAmericanoScore(a, b)
          const aWins = hasValid && a > b
          const bWins = hasValid && b > a
          const matchNum = matchesDisplay.length - displayIdx
          const showScores = hasValid

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
                    {displayIdx === 0 ? `Seneste kamp — #${matchNum}` : `#${matchNum}`}
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
                    value={s.a}
                    onChange={(e) =>
                      setScores((prev) => ({ ...prev, [m.id]: { ...prev[m.id], a: e.target.value, b: prev[m.id]?.b ?? '' } }))
                    }
                    placeholder="Hold A"
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
                    value={s.b}
                    onChange={(e) =>
                      setScores((prev) => ({ ...prev, [m.id]: { ...prev[m.id], a: prev[m.id]?.a ?? '', b: e.target.value } }))
                    }
                    placeholder="Hold B"
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
                </div>
              )}

              {locked && showScores && (
                <div style={{ paddingBottom: 8 }}>
                  <TeamBlock
                    name1={n1}
                    name2={n2}
                    pid1={m.team_a_p1}
                    pid2={m.team_a_p2}
                    score={a}
                    won={aWins}
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
                    score={b}
                    won={bWins}
                    showCheckForUser
                    userIdByPartId={userIdByPartId}
                    currentUserId={currentUserId}
                  />
                </div>
              )}

              {locked && !showScores && (
                <div style={{ fontSize: 12, color: c.muted, paddingBottom: 16 }}>Ingen resultat endnu.</div>
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
