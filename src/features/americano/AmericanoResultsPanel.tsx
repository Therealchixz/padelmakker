import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { AmericanoMatchRow, AmericanoParticipant, AmericanoPoints, AmericanoTournament } from './types'

const font = "'Inter', sans-serif"

type Props = {
  tournament: AmericanoTournament
  onSaved: () => void
  showToast: (msg: string) => void
  onProfileStatsRefresh?: () => void
}

function isValidAmericanoScore(a: number, b: number, target: AmericanoPoints): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false
  if (a === b) return false
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  return hi === target && lo < target
}

export function AmericanoResultsPanel({ tournament, onSaved, showToast, onProfileStatsRefresh }: Props) {
  const [participants, setParticipants] = useState<AmericanoParticipant[]>([])
  const [matches, setMatches] = useState<AmericanoMatchRow[]>([])
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const P = tournament.points_per_match

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
    if (!isValidAmericanoScore(a, b, P)) {
      showToast(`Ugyldigt: vinderhold skal have præcis ${P} point, taber færre (ikke uafgjort).`)
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('americano_matches')
        .update({ team_a_score: a, team_b_score: b, updated_at: new Date().toISOString() })
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

  if (loading) {
    return <div style={{ fontSize: 12, color: '#8494A7', marginTop: 12 }}>Henter kampe…</div>
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #E2E8F0' }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: '#0B1120' }}>
        Resultater (første til {P} point vinder — ingen ELO)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {matches.map((m) => {
          const s = scores[m.id] || { a: '', b: '' }
          const n1 = nameByPartId(m.team_a_p1)
          const n2 = nameByPartId(m.team_a_p2)
          const n3 = nameByPartId(m.team_b_p1)
          const n4 = nameByPartId(m.team_b_p2)
          return (
            <div
              key={m.id}
              style={{
                background: '#F8FAFC',
                borderRadius: 8,
                padding: 10,
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6, color: '#3E4C63' }}>
                Runde {m.round_number} · Bane {m.court_index + 1}
              </div>
              <div style={{ marginBottom: 8, lineHeight: 1.4 }}>
                <span style={{ color: '#1D4ED8' }}>
                  {n1} + {n2}
                </span>
                <span style={{ margin: '0 6px', color: '#8494A7' }}>vs</span>
                <span style={{ color: '#2563EB' }}>
                  {n3} + {n4}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  min={0}
                  max={P}
                  value={s.a}
                  onChange={(e) =>
                    setScores((prev) => ({ ...prev, [m.id]: { ...prev[m.id], a: e.target.value, b: prev[m.id]?.b ?? '' } }))
                  }
                  placeholder="Hold A"
                  style={{ width: 72, padding: 6, borderRadius: 6, border: '1px solid #D5DDE8', fontSize: 13 }}
                />
                <span style={{ fontWeight: 700 }}>—</span>
                <input
                  type="number"
                  min={0}
                  max={P}
                  value={s.b}
                  onChange={(e) =>
                    setScores((prev) => ({ ...prev, [m.id]: { ...prev[m.id], a: prev[m.id]?.a ?? '', b: e.target.value } }))
                  }
                  placeholder="Hold B"
                  style={{ width: 72, padding: 6, borderRadius: 6, border: '1px solid #D5DDE8', fontSize: 13 }}
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => saveRow(m)}
                  style={{
                    fontFamily: font,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#1D4ED8',
                    color: '#fff',
                    cursor: saving ? 'wait' : 'pointer',
                  }}
                >
                  Gem
                </button>
              </div>
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
