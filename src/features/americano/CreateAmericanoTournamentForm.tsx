import { useState, useEffect, useMemo } from 'react'

function nearestHalfHour(): string {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  if (m < 15) return `${String(h).padStart(2, '0')}:00`
  if (m < 45) return `${String(h).padStart(2, '0')}:30`
  return `${String((h + 1) % 24).padStart(2, '0')}:00`
}

const TIME_OPTIONS: string[] = []
for (let h = 6; h <= 23; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}
import { supabase } from '../../lib/supabase'
import { theme as pmTheme } from '../../lib/platformTheme'
import type { AmericanoPlayerSlots, AmericanoPoints, AmericanoOpponentPasses } from './types'
import {
  getMatchVenueOptions,
  courtIdFromVenueSelection,
} from '../../lib/matchVenueOptions'

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

/** Særlig select-værdi når ingen bane i DB — turnering kan stadig oprettes */
export const AMERICANO_COURT_NONE = '__none'

export function CreateAmericanoTournamentForm({
  userId,
  displayName,
  courts,
  onCreated,
  onCancel,
}: Props) {
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [timeSlot, setTimeSlot] = useState(() => nearestHalfHour())
  const venueOptions = useMemo(() => getMatchVenueOptions(courts), [courts])
  const selectOptions = useMemo(
    () => [
      ...venueOptions,
      { id: AMERICANO_COURT_NONE, label: 'Ikke valgt / anden bane', courtId: null as string | null },
    ],
    [venueOptions]
  )
  const [courtId, setCourtId] = useState(
    () => getMatchVenueOptions([])[0]?.id ?? AMERICANO_COURT_NONE
  )
  const [playerSlots, setPlayerSlots] = useState<AmericanoPlayerSlots>(5)
  const [pointsPerMatch, setPointsPerMatch] = useState<AmericanoPoints>(16)
  const [opponentPasses, setOpponentPasses] = useState<AmericanoOpponentPasses>(1)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCourtId((prev: string) => {
      const ids = new Set(selectOptions.map((o) => o.id))
      if (ids.has(prev)) return prev
      return selectOptions[0]?.id ?? AMERICANO_COURT_NONE
    })
  }, [selectOptions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const n = name.trim()
    if (!n) {
      setError('Angiv et turneringsnavn.')
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
          court_id: courtIdFromVenueSelection(courtId, selectOptions),
          player_slots: playerSlots,
          points_per_match: pointsPerMatch,
          opponent_passes: opponentPasses,
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
        background: pmTheme.surface,
        borderRadius: 12,
        padding: 'clamp(16px, 3vw, 22px)',
        border: `1px solid ${pmTheme.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        maxWidth: 520,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Opret Americano</h3>
      <p style={{ fontSize: 13, color: pmTheme.textMid, marginBottom: 18, lineHeight: 1.5 }}>
        Individuel turnering med skiftende makkere. <strong>Ingen ELO</strong> — kun separat Americano V/T på profilen (som i Padelboard-lignende apps). Du tilmeldes automatisk som første spiller.
      </p>

      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: pmTheme.text }}>
        Turneringsnavn
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="F.eks. Fredags Americano"
        style={inputStyle}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
        <div style={{ flex: '1 1 150px', minWidth: 0 }}>
          <label style={labelSmall}>Dato</label>
          <input type="date" value={date} min={new Date().toISOString().split('T')[0]} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none' }} />
        </div>
        <div style={{ flex: '1 1 100px', minWidth: 0 }}>
          <label style={labelSmall}>Tid</label>
          <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} style={inputStyle}>
            {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={labelSmall}>Bane</label>
        <select value={courtId} onChange={(e) => setCourtId(e.target.value)} style={inputStyle}>
          {selectOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 11, color: pmTheme.textLight, marginTop: 6, lineHeight: 1.45 }}>
          Samme steder som under fanen Baner. Matcher automatisk til baner i databasen når navnet stemmer overens.
        </p>
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
        <p style={{ fontSize: 11, color: pmTheme.textLight, marginTop: 6 }}>
          Én bane: fire på banen, resten sidder over (5: én over, 6: to over, 7: tre over). Start når præcis dette antal har tilmeldt sig.
        </p>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={labelSmall}>Turneringens længde</label>
        <select
          value={opponentPasses}
          onChange={(e) => setOpponentPasses(Number(e.target.value) as AmericanoOpponentPasses)}
          style={inputStyle}
        >
          <option value={1}>Normal — én gennemgang af alle runder</option>
          <option value={2}>Lang — samme rundeplan to gange (dobbelt så mange kampe)</option>
        </select>
        <p style={{ fontSize: 11, color: pmTheme.textLight, marginTop: 6 }}>
          Ved &quot;Lang&quot; gentages hele rotationsplanen; du møder de andre oftere som modstander og makker uden at oprette en ny turnering.
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
              {p} point (spil til {p} på banen)
            </option>
          ))}
        </select>
        <p style={{ fontSize: 11, color: pmTheme.textLight, marginTop: 6 }}>
          Efter hver kamp skal de to hold tilsammen give formatet (fx 10+6 eller 8+8 ved 16). Du kan skrive kun ét hold — app’en udfylder resten.
        </p>
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
        <p style={{ color: pmTheme.red, fontSize: 13, marginTop: 12 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            padding: '10px 20px',
            borderRadius: 10,
            border: 'none',
            background: pmTheme.accent,
            color: '#fff',
            cursor: submitting ? 'wait' : 'pointer',
            opacity: 1,
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
              border: `1px solid ${pmTheme.border}`,
              background: pmTheme.surface,
              color: pmTheme.textMid,
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
  color: pmTheme.text,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  height: 42,
  lineHeight: '20px',
  borderRadius: 8,
  border: `1px solid ${pmTheme.border}`,
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
  background: pmTheme.surface,
}
