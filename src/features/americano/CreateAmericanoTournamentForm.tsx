import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { AmericanoPlayerSlots, AmericanoPoints } from './types'

type CourtOption = { id: string; name: string }

type Props = {
  userId: string
  displayName: string
  courts: CourtOption[]
  onCreated?: (tournamentId: string) => void
  onCancel?: () => void
}

const PLAYER_OPTIONS: AmericanoPlayerSlots[] = [5, 6, 7]
const POINT_OPTIONS: AmericanoPoints[] = [16, 24, 32]

export function CreateAmericanoTournamentForm({
  userId,
  displayName,
  courts,
  onCreated,
  onCancel,
}: Props) {
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [timeSlot, setTimeSlot] = useState('18:00')
  const [courtId, setCourtId] = useState(courts[0]?.id ?? '')
  const [playerSlots, setPlayerSlots] = useState<AmericanoPlayerSlots>(5)
  const [pointsPerMatch, setPointsPerMatch] = useState<AmericanoPoints>(16)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const n = name.trim()
    if (!n) {
      setError('Angiv et turneringsnavn.')
      return
    }
    if (!courtId && courts.length > 0) {
      setError('Vælg en bane.')
      return
    }
    setSubmitting(true)
    try {
      const { data: row, error: insErr } = await supabase
        .from('americano_tournaments')
        .insert({
          creator_id: userId,
          name: n,
          tournament_date: date,
          time_slot: timeSlot,
          court_id: courtId || null,
          player_slots: playerSlots,
          points_per_match: pointsPerMatch,
          description: description.trim() || null,
          status: 'registration',
        })
        .select('id')
        .single()

      if (insErr) throw insErr
      if (!row?.id) throw new Error('Ingen id returneret')

      const { error: partErr } = await supabase.from('americano_participants').insert({
        tournament_id: row.id,
        user_id: userId,
        display_name: displayName.trim() || 'Spiller',
      })
      if (partErr) throw partErr

      onCreated?.(row.id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(
        msg.includes('americano')
          ? msg
          : `${msg} — Har du kørt americano_schema.sql i Supabase?`
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 'clamp(16px, 3vw, 22px)',
        border: '1px solid #D5DDE8',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        maxWidth: 520,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Opret Americano</h3>
      <p style={{ fontSize: 13, color: '#3E4C63', marginBottom: 18, lineHeight: 1.5 }}>
        Individuel turnering med skiftende makkere. <strong>Ingen ELO</strong> — kun separat Americano V/T på profilen (som i Padelboard-lignende apps). Du tilmeldes automatisk som første spiller.
      </p>

      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#0B1120' }}>
        Turneringsnavn
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="F.eks. Fredags Americano"
        style={inputStyle}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <div>
          <label style={labelSmall}>Dato</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelSmall}>Tid</label>
          <input type="time" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={labelSmall}>Bane</label>
        <select value={courtId} onChange={(e) => setCourtId(e.target.value)} style={inputStyle}>
          {courts.length === 0 ? (
            <option value="">Ingen baner i systemet</option>
          ) : (
            courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))
          )}
        </select>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={labelSmall}>Antal spillere</label>
        <select
          value={playerSlots}
          onChange={(e) => setPlayerSlots(Number(e.target.value) as AmericanoPlayerSlots)}
          style={inputStyle}
        >
          {PLAYER_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p} spillere
            </option>
          ))}
        </select>
        <p style={{ fontSize: 11, color: '#8494A7', marginTop: 6 }}>
          Én bane: fire på banen, resten sidder over (5: én over, 6: to over, 7: tre over). Start når præcis dette antal har tilmeldt sig.
        </p>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={labelSmall}>Point per kamp</label>
        <select
          value={pointsPerMatch}
          onChange={(e) => setPointsPerMatch(Number(e.target.value) as AmericanoPoints)}
          style={inputStyle}
        >
          {POINT_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p} point (vinder ved først til {p})
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={labelSmall}>Beskrivelse (valgfrit)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Regler, niveau, osv."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {error && (
        <p style={{ color: '#DC2626', fontSize: 13, marginTop: 12 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={submitting || courts.length === 0}
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            padding: '10px 20px',
            borderRadius: 10,
            border: 'none',
            background: '#1D4ED8',
            color: '#fff',
            cursor: submitting ? 'wait' : 'pointer',
            opacity: courts.length === 0 ? 0.5 : 1,
          }}
        >
          {submitting ? 'Opretter…' : 'Opret turnering'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              padding: '10px 20px',
              borderRadius: 10,
              border: '1px solid #D5DDE8',
              background: '#fff',
              color: '#3E4C63',
              cursor: 'pointer',
            }}
          >
            Annullér
          </button>
        )}
      </div>
    </form>
  )
}

const labelSmall: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  color: '#0B1120',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #D5DDE8',
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
}
