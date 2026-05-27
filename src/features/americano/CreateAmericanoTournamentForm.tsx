import { useState, useEffect, useMemo, useCallback } from 'react'
import { americanoBaseRounds, americanoTotalRounds, benchCountPerRound } from '../../lib/americanoRoundRobinSchedule'
import { MIN_PER_ROUND } from './americanoDisplayUtils'

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
import { theme, btn } from '../../lib/platformTheme'
import type { AmericanoPlayerSlots, AmericanoPoints, AmericanoOpponentPasses, AmericanoTournamentFormat } from './types'
import {
  getMatchVenueOptions,
  courtIdFromVenueSelection,
  AMERICANO_VENUE_NONE,
} from '../../lib/matchVenueOptions'
import { VenueRegionPicker } from '../../components/VenueRegionPicker'

type CourtOption = { id: string; name: string }

type Props = {
  userId: string
  displayName: string
  courts: CourtOption[]
  onCreated?: (tournamentId: string) => void
  onCancel?: () => void
}

const PLAYER_OPTIONS: AmericanoPlayerSlots[] = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
const POINT_OPTIONS: AmericanoPoints[] = [16, 24, 32]

/** Særlig værdi når ingen bane i DB — turnering kan stadig oprettes */
export const AMERICANO_COURT_NONE = AMERICANO_VENUE_NONE

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
      { id: AMERICANO_COURT_NONE, label: 'Ikke valgt / anden bane', courtId: null as string | null },
      ...venueOptions,
    ],
    [venueOptions]
  )
  const [courtId, setCourtId] = useState(AMERICANO_COURT_NONE)
  const [playerSlots, setPlayerSlots] = useState<AmericanoPlayerSlots>(6)
  const [courtsPerRound, setCourtsPerRound] = useState(1)
  const [pointsPerMatch, setPointsPerMatch] = useState<AmericanoPoints>(16)
  const [opponentPasses, setOpponentPasses] = useState<AmericanoOpponentPasses>(1)
  const [tournamentFormat, setTournamentFormat] = useState<AmericanoTournamentFormat>('americano')

  const maxCourts = Math.floor(playerSlots / 4)
  const COURT_OPTIONS = Array.from({ length: maxCourts }, (_, i) => i + 1)

  const schedulePreview = useMemo(() => {
    if (tournamentFormat !== 'americano') return null
    const base = americanoBaseRounds(playerSlots, courtsPerRound)
    const total = americanoTotalRounds(playerSlots, courtsPerRound, opponentPasses === 2 ? 2 : 1)
    const bench = benchCountPerRound(playerSlots, courtsPerRound)
    return { base, total, estMinutes: total * MIN_PER_ROUND, bench }
  }, [tournamentFormat, playerSlots, courtsPerRound, opponentPasses])

  const handlePlayerSlotsChange = useCallback((n: AmericanoPlayerSlots) => {
    setPlayerSlots(n)
    setCourtsPerRound((prev) => Math.min(prev, Math.floor(n / 4)))
  }, [])
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCourtId((prev: string) => {
      const ids = new Set(selectOptions.map((o) => o.id))
      if (ids.has(prev)) return prev
      return AMERICANO_COURT_NONE
    })
  }, [selectOptions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const n = name.trim()
    if (!n) {
      setError('Angiv et navn.')
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
          courts_per_round: courtsPerRound,
          points_per_match: pointsPerMatch,
          opponent_passes: opponentPasses,
          format: tournamentFormat,
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
        background: 'var(--pm-surface)',
        borderRadius: 12,
        padding: 'clamp(16px, 3vw, 22px)',
        border: '1px solid var(--pm-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        maxWidth: 520,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Opret Americano/Mexicano</h3>
      <p style={{ fontSize: 13, color: 'var(--pm-text-mid)', marginBottom: 14, lineHeight: 1.5 }}>
        Individuelt format med skiftende makkere. <strong>Separat Americano/Mexicano ELO</strong> beregnes ved afslutning (adskilt fra normal 2v2-ELO). Du tilmeldes automatisk som første spiller.
      </p>

      <div style={{ marginBottom: 14 }}>
        <label style={labelSmall}>Format</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setTournamentFormat('americano')}
            style={{
              ...btn(tournamentFormat === 'americano'),
              fontSize: 13,
              padding: '8px 14px',
            }}
          >
            Americano
          </button>
          <button
            type="button"
            onClick={() => setTournamentFormat('mexicano')}
            style={{
              ...btn(tournamentFormat === 'mexicano'),
              fontSize: 13,
              padding: '8px 14px',
            }}
          >
            Mexicano
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--pm-text-light)', marginTop: 8, lineHeight: 1.45 }}>
          {tournamentFormat === 'mexicano' ? (
            <>
              <strong>Mexicano:</strong> Efter hver runde parres næste kamp ud fra stilling (1.+4. vs 2.+3. på banen). Runder genereres løbende når resultater er gemt.
            </>
          ) : (
            <>
              <strong>Americano:</strong> Hele rundeplanen genereres når Americano startes — alle møder er planlagt på forhånd.
            </>
          )}
        </p>
      </div>

      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--pm-text)' }}>
        Navn
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
        <VenueRegionPicker
          value={courtId}
          onChange={setCourtId}
          options={selectOptions}
          placeholder="Ikke valgt / anden bane"
          ariaLabel="Vælg bane til Americano/Mexicano"
        />
        <p style={{ fontSize: 11, color: 'var(--pm-text-light)', marginTop: 6, lineHeight: 1.45 }}>
          Samme steder som under fanen Baner. Matcher automatisk til baner i databasen når navnet stemmer overens.
        </p>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={labelSmall}>Antal spillere</label>
        <select
          value={playerSlots}
          onChange={(e) => handlePlayerSlotsChange(Number(e.target.value) as AmericanoPlayerSlots)}
          style={inputStyle}
        >
          {PLAYER_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p} spillere
            </option>
          ))}
        </select>
        <p style={{ fontSize: 11, color: 'var(--pm-text-light)', marginTop: 6 }}>
          Start når præcis dette antal har tilmeldt sig. Ved ulige antal sidder én spiller over pr. runde.
        </p>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={labelSmall}>Antal baner pr. runde</label>
        <select
          value={courtsPerRound}
          onChange={(e) => setCourtsPerRound(Number(e.target.value))}
          style={inputStyle}
          disabled={maxCourts <= 1}
        >
          {COURT_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c} bane{c !== 1 ? 'r' : ''} ({benchCountPerRound(playerSlots, c)} sidder over)
            </option>
          ))}
        </select>
        <p style={{ fontSize: 11, color: 'var(--pm-text-light)', marginTop: 6 }}>
          Maks {maxCourts} {maxCourts === 1 ? 'bane' : 'baner'} (floor({playerSlots}/4)). Vælg flere baner for at minimere bænk ved mange spillere.
        </p>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={labelSmall}>Længde</label>
        <select
          value={opponentPasses}
          onChange={(e) => setOpponentPasses(Number(e.target.value) as AmericanoOpponentPasses)}
          style={inputStyle}
        >
          <option value={1}>Normal — én gennemgang af alle runder</option>
          <option value={2}>Lang — samme rundeplan to gange (dobbelt så mange kampe)</option>
        </select>
        <p style={{ fontSize: 11, color: 'var(--pm-text-light)', marginTop: 6, lineHeight: 1.45 }}>
          {schedulePreview ? (
            <>
              <strong>Americano:</strong> Normal = {schedulePreview.base} runder
              {schedulePreview.bench > 0
                ? ` (${schedulePreview.bench} sidder over pr. runde)`
                : ' (alle på banen)'}
              — planlagt så I når makker og modstander med alle. Lang = {schedulePreview.total} runder
              (ca. {schedulePreview.estMinutes} min). Mexicano bruger samme længde, men parres efter stilling.
            </>
          ) : (
            <>
              Ved &quot;Lang&quot; gentages hele rotationsplanen. Mexicano parres efter stilling runde for runde.
            </>
          )}
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
        <p style={{ fontSize: 11, color: 'var(--pm-text-light)', marginTop: 6 }}>
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
        <p style={{ color: theme.red, fontSize: 13, marginTop: 12 }}>{error}</p>
      )}

      <div className="pm-form-submit pm-form-submit-actions">
        <button
          type="submit"
          disabled={submitting}
          style={{
            ...btn(true, { size: 'md', fontWeight: 600 }),
            cursor: submitting ? 'wait' : 'pointer',
          }}
        >
          {submitting ? 'Opretter…' : 'Opret Americano/Mexicano'}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            style={btn(false, { size: 'md', fontWeight: 600 })}
          >
            Annullér
          </button>
        ) : null}
      </div>
    </form>
  )
}

const labelSmall: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  color: 'var(--pm-text)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  height: 42,
  lineHeight: '20px',
  borderRadius: 8,
  border: '1px solid var(--pm-border)',
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
  background: 'var(--pm-surface)',
}
